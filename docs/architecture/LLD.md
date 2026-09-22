# ClauseNexa — Low-Level Design (LLD)

## 1. Purpose

This is the authoritative V1 low-level design for ClauseNexa. It consolidates the Core API, Document Processing, RAG/AI, data model, service boundaries, storage ownership, failure handling, security, and implementation structure.

## 2. System Architecture

```text
Frontend
   │ HTTPS
   ▼
Load Balancer
   │
   ▼
Core API
 ┌─┼──────────────┬──────────────┐
 ▼ ▼              ▼              ▼
MongoDB      Object Storage   Redis/BullMQ
                                  │
                                  ▼
                         Document Processing
                           │            │
                           ▼            ▼
                     Object Storage   Vector DB

Core API ───────────────► RAG/AI
                           │       │
                           ▼       ▼
                       Vector DB   LLM
```

### Core API
Owns authentication, authorization, users, contracts, document metadata/upload coordination, jobs, chat API, and conversation/message persistence.

Does not own PDF extraction, chunking, embeddings, vector search, or LLM reasoning.

### Document Processing
Owns queue consumption, PDF retrieval/parsing, text extraction, cleaning, chunking, embeddings, vector writes, processing state, progress, and reprocessing.

### RAG/AI
Owns query embedding, vector retrieval, filtering, relevance checks, context construction, prompt construction, LLM communication, response parsing, and source validation.

## 3. Storage Ownership

| Storage | Role |
|---|---|
| MongoDB | Permanent application source of truth |
| Object Storage | Original PDF files |
| Redis/BullMQ | Temporary background jobs |
| Vector DB | Derived semantic-search index |

PDF binaries never enter Redis/BullMQ.

Vector DB is not the source of truth; vectors can be regenerated from the original PDF.

## 4. Document Upload Flow

```text
Frontend
  ↓ POST /api/v1/documents
Core API
  ├─ Authenticate
  ├─ Validate upload
  ├─ Store PDF
  ├─ Create Document
  └─ Enqueue PROCESS_DOCUMENT
  ↓
202 Accepted { documentId, jobId, status }
  ↓
BullMQ
  ↓
Document Worker
  ├─ Fetch PDF
  ├─ Extract text
  ├─ Clean text
  ├─ Chunk
  ├─ Generate embeddings
  ├─ Store vectors
  └─ Update MongoDB
```

Document processing is asynchronous so the upload request does not wait for heavy processing.

## 5. Document Processing Pipeline

```text
Original PDF
 ↓
PDF Parsing
 ↓
Text Extraction
 ↓
Text Cleaning
 ↓
Chunking
 ↓
Embedding Generation
 ↓
Vector DB
```

Text extraction preserves page boundaries, paragraphs, headings, section numbering, and order.

OCR is excluded from MVP. A document with no usable text fails in V1.

Text cleaning may normalize whitespace, repair obvious line breaks, clean encoding artifacts, and remove confidently detected repeated headers/footers.

It must never summarize, paraphrase, rewrite legal meaning, or remove numbers, dates, money values, clause identifiers, or negations.

### Chunking

- Target: approximately 500 tokens
- Overlap: approximately 10–15%
- Values are configurable
- Boundary priority: section/clause → paragraph → sentence → token

Example:

```json
{
  "documentId": "...",
  "chunkId": "...",
  "chunkIndex": 12,
  "text": "...",
  "pageStart": 42,
  "pageEnd": 43,
  "section": "7.2",
  "processingVersion": 1
}
```

### Embeddings

Only final chunk text is embedded. Metadata is stored separately.

Embedding requests are batched where possible. Transient failures use bounded exponential-backoff retries.

The document and query embedding models must be compatible.

### Vector Records

```json
{
  "id": "documentId:processingVersion:chunkIndex",
  "vector": [0.018, -0.42, 0.13],
  "metadata": {
    "documentId": "...",
    "contractId": "...",
    "userId": "...",
    "chunkIndex": 42,
    "pageStart": 18,
    "pageEnd": 19,
    "section": "7.2",
    "processingVersion": 1,
    "embeddingModel": "model-v1"
  }
}
```

Deterministic vector IDs make processing idempotent.

## 6. Processing State

```text
queued
 ↓
processing
 ↓
extracting
 ↓
chunking
 ↓
embedding
 ↓
storing_vectors
 ↓
completed
```

Failures transition to `failed`.

Permanent processing state lives on the MongoDB `Document`. BullMQ state is temporary.

Retryable failures include temporary storage/network failures, embedding timeouts/rate limits/5xx, and temporary Vector DB failures.

Non-retryable failures include invalid payloads, missing documents, unsupported/corrupt PDFs, no usable MVP text, invalid embedding configuration, and permanent authentication/configuration failures.

## 7. Reprocessing

Each uploaded file is a separate `Document`.

`Contract.activeDocumentId` identifies the active document.

Processing versions are separate from document versions:

```text
V1 active
 ↓
Process V2
 ↓
Store V2 vectors
 ↓
Verify V2
 ↓
Mark V2 active
 ↓
Delete V1 vectors
```

RAG retrieves only the active processing version.

## 8. RAG Architecture

```text
User Question
 ↓
Query Embedding
 ↓
Vector Similarity Search
 ↓
Metadata Filtering
 ↓
Top-K
 ↓
Relevance Threshold
 ↓
Context Assembly
 ↓
Prompt Construction
 ↓
LLM
 ↓
Response Parser
 ↓
Answer + Sources
```

Before retrieval, RAG reads the active contract/document metadata from MongoDB to determine:

- `activeDocumentId` from the Contract
- `activeProcessingVersion` from the active Document

RAG then applies these values to Vector DB retrieval.

Metadata filters:

- `userId`
- `contractId`
- active `processingVersion`

Core API authorization remains authoritative. Vector filtering is defense-in-depth.

If no chunk passes the relevance threshold, the LLM is not called; a controlled insufficient-information response is returned.

V1 intentionally excludes reranking, hybrid search, query expansion, multi-query, HyDE, agentic retrieval, neighbor expansion, semantic deduplication, automatic context summarization, and streaming.

## 9. RAG Contracts

Request:

```json
{
  "userId": "...",
  "contractId": "...",
  "conversationId": "...",
  "userPrompt": "What are the termination conditions?"
}
```

Response:

```json
{
  "answer": "...",
  "sources": [],
  "conversationId": "..."
}
```

### Context Builder

The context builder:

- removes exact duplicate chunk IDs
- preserves page/section metadata
- restores useful document order
- enforces `MAX_CONTEXT_TOKENS`
- preserves contract text unchanged
- prepares source metadata

Prompt structure:

```text
SYSTEM INSTRUCTIONS
CONTRACT CONTEXT
CONVERSATION HISTORY
USER QUESTION
```

Retrieved contract text is untrusted data. Instructions inside it must not override system instructions.

### LLM Failure Policy

V1 retries transient LLM failures such as:

- timeouts
- temporary network failures
- 5xx responses
- temporary rate limits

If retries are exhausted, the request fails safely.

V1 does not require automatic fallback to a second LLM provider/model. A fallback model can be considered in a future reliability iteration.

### LLM Output

Expected structure:

```json
{
  "answer": "...",
  "sourceIds": ["doc123:v1:chunk42"]
}
```

Source IDs must correspond to retrieved chunks. Final source metadata comes from trusted retrieval results, not blindly from the model.

## 10. Chat Persistence

```text
Frontend
 ↓
Core API
 ├─ Authenticate
 ├─ Authorize
 ├─ Validate
 └─ Persist user message
 ↓
RAG
 ├─ Load bounded history
 ├─ Embed query
 ├─ Retrieve
 ├─ Build context
 ├─ Build prompt
 ├─ Call LLM
 └─ Parse response
 ↓
Answer + Sources
 ↓
Core API
 ├─ Persist assistant message
 └─ Return
 ↓
Frontend
```

Core API owns primary chat persistence.

## 11. Core API Structure

```text
core-api/
├── controllers/
│   ├── auth.controller.ts
│   ├── user.controller.ts
│   ├── contract.controller.ts
│   ├── document.controller.ts
│   ├── job.controller.ts
│   └── health.controller.ts
├── models/
├── db/
├── validators/
│   ├── auth.validator.ts
│   ├── user.validator.ts
│   ├── contract.validator.ts
│   ├── document.validator.ts
│   ├── chat.validator.ts
│   └── job.validator.ts
├── routes/
├── utils/
├── middlewares/
│   ├── auth.middleware.ts
│   ├── upload.middleware.ts
│   ├── requestLogger.middleware.ts
│   └── error.middleware.ts
└── config/
```

Request lifecycle:

```text
HTTP Request
 ↓
Request Logger
 ↓
Route
 ↓
Middleware
 ↓
Validator
 ↓
Controller
 ↓
Dependency Call
 ↓
ApiResponse
 ↓
HTTP Response
```

## 12. Core API Endpoints

```text
/api/v1
├── /auth
│   ├── POST /register
│   ├── POST /login
│   ├── POST /logout
│   ├── POST /refresh
│   ├── POST /verify-email
│   ├── POST /resend-verification
│   ├── POST /forgot-password
│   ├── POST /reset-password
│   └── POST /change-password
├── /users
│   ├── GET /me
│   ├── PATCH /me
│   └── DELETE /me
├── /contracts
│   ├── POST /
│   ├── GET /
│   ├── GET /:contractId
│   ├── PATCH /:contractId
│   ├── DELETE /:contractId
│   └── POST /:contractId/chat
├── /documents
│   ├── POST /
│   ├── GET /:documentId
│   └── DELETE /:documentId
├── /jobs
│   └── GET /:jobId
└── /health
    ├── GET /
    └── GET /ready
```

## 13. Upload Handling

```text
POST /api/v1/documents
 → authMiddleware
 → upload.single("file")
 → validator
 → documentController
 → Object Storage + MongoDB + BullMQ
 → 202
```

Multer handles multipart upload and basic constraints only.

For large PDFs, V1 should avoid `memoryStorage`; temporary disk storage can be used before uploading to Object Storage and deleting the temporary file.

## 14. API Error Model

```js
class ApiError extends Error {
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = "",
    ) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.success = false;
        this.data = null;
        this.errors = errors;

        if (stack) this.stack = stack;
        else Error.captureStackTrace(this, this.constructor);
    }
}
```

```js
class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400;
    }
}
```

Central error middleware handles known errors and returns a generic 500 response for unexpected failures.

## 15. MongoDB Data Model

### User

```text
users {
  id string pk
  email string
  passwordHash string
  name string
  emailVerified boolean

  refreshTokenHash string
  refreshTokenExpiresAt timestamp

  emailVerificationTokenHash string
  emailVerificationTokenExpiresAt timestamp

  passwordResetTokenHash string
  passwordResetTokenExpiresAt timestamp

  createdAt timestamp
  updatedAt timestamp
}
```

### Contract

```text
contracts {
  id string pk
  userId string
  title string
  description string
  status string
  activeDocumentId string
  createdAt timestamp
  updatedAt timestamp
}
```

### Document

```text
documents {
  id string pk
  contractId string
  userId string

  fileName string
  mimeType string
  fileSize number
  storageKey string

  processingStatus string
  processingStage string
  processingProgress number
  processingError string

  processingVersion number
  activeProcessingVersion number

  createdAt timestamp
  updatedAt timestamp
}
```

### Conversation

```text
conversations {
  id string pk
  userId string
  contractId string
  title string
  createdAt timestamp
  updatedAt timestamp
}
```

### Message

```text
messages {
  id string pk
  conversationId string
  role string
  content string
  sources json
  createdAt timestamp
}
```

## 16. Relationships

```text
User 1:N Contract
Contract 1:N Document
Contract 0:1 Active Document
User 1:N Conversation
Contract 1:N Conversation
Conversation 1:N Message
```

Important constraints:

- `Document.userId == Contract.userId`
- active document must belong to its contract
- conversation user must match contract user
- message must reference an existing conversation
- role must be `user` or `assistant`
- processing progress must be 0–100
- `activeProcessingVersion <= processingVersion`
- completed processing has progress 100 and active version set
- failed processing has an error
- email is unique
- raw passwords/tokens are never stored

## 17. Deletion

Deletion is an explicit application workflow.

Contract deletion:

```text
Contract
 ↓
Documents
 ↓
Object Storage PDFs
 ↓
Vector records
 ↓
Conversations
 ↓
Messages
```

User deletion follows the same ownership chain.

## 18. Failure Boundaries

### Storage succeeds, MongoDB fails

Attempt to delete the uploaded object and return an error.

### Storage + MongoDB succeed, queue fails

Mark processing failed and attempt recovery/re-enqueue. A transactional outbox is a future option if required.

### Worker crash

BullMQ retry/recovery handles the job.

### Partial vector writes

Deterministic vector IDs make repeated execution safe.

### LLM failures

Retry temporary timeout, network, 5xx, and rate-limit failures. Fail safely on invalid request, authentication/configuration, or malformed output.

## 19. Security

- Core API authenticates requests.
- Controllers enforce resource ownership in V1.
- Vector DB filters by user, contract, and active processing version.
- Passwords and security tokens are stored only as hashes.
- Secrets are environment configuration.
- Contract content and sensitive values must not be logged.
- LLM output is validated before source metadata is accepted.
- Retrieved contract text is treated as untrusted data.

## 20. Observability

Core API logs:

- request ID
- method
- path
- status
- response time
- timestamp

Document processing tracks:

- job ID
- document ID
- stage
- progress
- retry information
- failure reason

Never log passwords, tokens, provider secrets, or full contract contents.

## 21. Repository Structure

```text
ClauseNexa/
├── client/
├── backend/
│   ├── core-api/
│   ├── document-processing/
│   └── rag-service/
├── docs/
│   ├── architecture/
│   │   └── lld.md
│   └── diagrams/
├── docker/
├── README.md
└── .gitignore
```

## 22. Critical Invariants

1. Core API is the application boundary.
2. Original PDFs live only in Object Storage.
3. PDF binaries never enter Redis/BullMQ.
4. Document processing is asynchronous.
5. Chat/RAG is synchronous in V1.
6. MongoDB is the source of truth for permanent state.
7. Vector DB is a derived search index.
8. RAG retrieves only the active processing version.
9. Document version and processing version are different concepts.
10. Core API owns chat persistence.
11. Document Processing owns ingestion.
12. RAG owns AI execution.
13. LLM output is never blindly trusted.
14. Source IDs must correspond to retrieved chunks.
15. Advanced retrieval is intentionally deferred.
16. Authorization is enforced at the Core API boundary.
17. RAG reads the active document and active processing version from MongoDB before vector retrieval.
18. V1 does not depend on automatic LLM fallback models/providers.
19. Cross-storage deletion is explicit.

## 23. Implementation Order

```text
Week 3 Day 2 → Backend Foundation
Week 3 Day 3 → Core API Infrastructure
Week 3 Day 4 → Authentication
Week 3 Day 5 → Contract + Document Management
Week 3 Day 6 → Queue + Document Processing
Week 3 Day 7 → Embeddings + Vector DB
```

RAG implementation follows after the ingestion pipeline is functional.

## 24. Intentionally Deferred

V1 does not require:

- OCR
- Streaming LLM responses
- Hybrid BM25 + vector retrieval
- Reranking
- Query expansion
- Multi-query retrieval
- HyDE
- Agentic retrieval
- Advanced semantic deduplication
- Neighbor chunk expansion
- Automatic context summarization
- Automatic fallback LLM/provider routing
- Transactional outbox
- Distributed transactions
- Complex authorization service
- Per-user vector collections
- Dedicated processing-record entity
- Dedicated session entity

These can be introduced only when implementation requirements justify them.

## 25. Final End-to-End Flows

### Upload

```text
User
 ↓
Frontend
 ↓
Core API
 ↓
Auth + Validation
 ↓
Object Storage
 ↓
MongoDB
 ↓
BullMQ
 ↓
202 Accepted
 ↓
Document Worker
 ↓
Extract → Clean → Chunk → Embed
 ↓
Vector DB
 ↓
MongoDB processing state
 ↓
Completed
```

### Chat

```text
User
 ↓
Frontend
 ↓
Core API
 ↓
Auth + Authorization
 ↓
Persist User Message
 ↓
RAG
 ↓
Embed → Retrieve → Filter → Context → Prompt → LLM
 ↓
Validate Sources
 ↓
Core API
 ↓
Persist Assistant Message
 ↓
Frontend
```

## 26. Status

**Week 3 Day 1 — Overall LLD: Complete**

This document is the implementation-level source of truth for ClauseNexa V1. Any implementation decision that conflicts with this document should trigger an explicit design review rather than silently changing the architecture.
