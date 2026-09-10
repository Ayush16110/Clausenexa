# ClauseNexa — Core API LLD

**Day 4 — Low-Level Design**

## 1. Purpose

The Core API is the central HTTP entry point for ClauseNexa. It handles authentication, users, contracts, documents, job status, and AI-chat requests while delegating heavy document processing and AI work to separate services.

### Architecture Rules

- Core API remains lightweight and stateless.
- PDF processing, chunking, embeddings, vector search, and LLM calls are outside Core API.
- Original PDFs are stored in Object Storage.
- Application metadata/state is stored in MongoDB.
- BullMQ/Redis is used for asynchronous document-processing jobs.
- RAG/AI communication is synchronous.
- Database modelling is intentionally postponed to a dedicated design day.

## 2. Internal Structure

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
├── middlewares/
│   ├── auth.middleware.ts
│   ├── upload.middleware.ts
│   ├── requestLogger.middleware.ts
│   └── error.middleware.ts
└── utils/
    ├── ApiError.ts
    ├── ApiResponse.ts
    └── asyncHandler.ts
```

## 3. Request Lifecycle

```text
HTTP Request
    ↓
Request Logger
    ↓
Route
    ↓
Auth Middleware (protected routes)
    ↓
Upload Middleware (document upload only)
    ↓
Validator
    ↓
asyncHandler
    ↓
Controller
    ↓
Dependency Call
    ↓
ApiResponse
    ↓
HTTP Response
```

Errors:

```text
Controller / Middleware / Dependency
    ↓
ApiError / Error
    ↓
next(error)
    ↓
Error Middleware
    ↓
Standard Error Response
```

## 4. API Endpoints

Base path: `/api/v1`

### Auth

```text
POST /auth/register
POST /auth/login
POST /auth/logout
POST /auth/refresh
POST /auth/verify-email
POST /auth/resend-verification
POST /auth/forgot-password
POST /auth/reset-password
POST /auth/change-password
```

### Users

```text
GET    /users/me
PATCH  /users/me
DELETE /users/me
```

### Contracts

```text
POST   /contracts
GET    /contracts
GET    /contracts/:contractId
PATCH  /contracts/:contractId
DELETE /contracts/:contractId
POST   /contracts/:contractId/chat
```

### Documents

```text
POST   /documents
GET    /documents/:documentId
DELETE /documents/:documentId
```

### Jobs

```text
GET /jobs/:jobId
```

### Health

```text
GET /health
GET /health/ready
```

## 5. Middleware

### Auth Middleware
- Verifies authentication token/session.
- Attaches authenticated user information to the request.
- Returns `401` for missing/invalid authentication.

### Upload Middleware
- Ensures a file was received.
- Checks MIME type and file size.
- Handles multipart upload validation.
- Does not extract or process PDF content.

### Request Logger
Logs:
- HTTP method and path
- Request ID
- Status code
- Response time
- Timestamp

### Error Middleware
- Centralized error handling.
- Converts `ApiError` into consistent JSON.
- Logs unexpected errors internally.
- Returns safe generic `500` responses for unknown errors.

## 6. Validation

Validators check **request shape and format only**.

```text
auth.validator.ts       → authentication requests
user.validator.ts       → profile updates
contract.validator.ts   → contract data/IDs
document.validator.ts   → document request data/IDs
chat.validator.ts       → chat request
job.validator.ts        → job IDs/parameters
```

Validators do not query MongoDB. Existence and ownership checks belong to controllers.

## 7. Controllers

Controllers coordinate application workflows.

```text
Auth Controller      → authentication/account flows
User Controller      → current-user operations
Contract Controller  → contract CRUD + chat
Document Controller  → upload/retrieve/delete documents
Job Controller       → job status
Health Controller    → health/readiness checks
```

Controllers do **not** perform:
- PDF extraction
- Chunking
- Embedding generation
- Vector search
- Direct LLM calls

## 8. Standard Error/Response Handling

### Success

`ApiResponse` is used for successful responses.

```text
Controller
    ↓
ApiResponse
    ↓
res.json()
```

### Known Error

```text
throw new ApiError(...)
    ↓
asyncHandler
    ↓
next(error)
    ↓
errorMiddleware
```

Typical status codes:

```text
400 → Bad request
401 → Unauthenticated
403 → Forbidden
404 → Resource not found
409 → Conflict / duplicate
500 → Internal server error
```

## 9. External Dependency Contracts

### Core API ↔ MongoDB

Synchronous request/response.

```text
Create → success / duplicate or other failure
Read   → entry found / not found
Update → success / entry not found
Delete → success / entry not found
```

MongoDB stores application data and metadata, not PDF binaries or vector embeddings.

### Core API ↔ Object Storage

```text
Save file
    → success: storageKey
    → failure: storage/upload error

Retrieve file
    → success: file
    → not found / storage failure

Delete file
    → success / storage failure
```

Object Storage stores the original PDF. Deep PDF validation/processing belongs to Document Processing.

### Core API ↔ Redis/BullMQ

Asynchronous communication.

Core API creates a lightweight job containing references such as:

```json
{
  "jobType": "PROCESS_DOCUMENT",
  "userId": "...",
  "contractId": "...",
  "documentId": "...",
  "storageKey": "...",
  "metadata": {}
}
```

The PDF itself is never placed in Redis/BullMQ.

Workers update job state. Core API exposes the current state through:

```text
GET /api/v1/jobs/:jobId
```

BullMQ holds temporary job execution state; permanent document processing state belongs in MongoDB.

### Core API ↔ RAG/AI

Synchronous request/response.

Request:

```json
{
  "userId": "...",
  "contractId": "...",
  "conversationId": "...",
  "userPrompt": "..."
}
```

Response concept:

```json
{
  "answer": "...",
  "sources": [],
  "conversationId": "..."
}
```

RAG/AI owns:
- Contract-context retrieval
- Chat-history retrieval
- Vector search
- Prompt construction
- LLM communication

## 10. Document Upload Flow

```text
Frontend
   ↓ PDF
Core API
   ↓
Validate file
   ↓
Object Storage
   ↓
Create document metadata
   ↓
BullMQ Job
   ↓
202 Accepted
   ↓
Frontend polls GET /jobs/:jobId
```

If storage succeeds but metadata creation fails, the uploaded file should be cleaned up.

If job creation fails after metadata creation, the document should be marked failed and the system should attempt cleanup/retry as appropriate.

An outbox pattern can be considered later if stronger delivery guarantees are required.

## 11. Contract ↔ Document ↔ Job

```text
Contract
  │
  └── Document
        │
        └── Processing Job
```

- **Contract** = logical legal/domain entity.
- **Document** = actual uploaded file associated with a contract.
- **Job** = temporary background processing operation.

Exact database relationships, versioning, indexes, and cascade behavior will be finalized during the dedicated database-design phase.

## 12. Final Architecture Boundary

```text
                    ┌──────────────┐
                    │  Frontend    │
                    └──────┬───────┘
                           ↓
                    ┌──────────────┐
                    │   Core API   │
                    └──┬──┬──┬──┬──┘
                       │  │  │  │
                       ↓  ↓  ↓  ↓
                      DB Storage Queue RAG/AI
                       │         │      │
                       │         ↓      ├── Vector DB
                       │    Document    ├── MongoDB
                       │    Processing  └── LLM
                       │
                  MongoDB / Object
                     Storage
```

### Core API owns:
Authentication, users, contracts, document metadata/file operations, job orchestration/status, HTTP API, and request/error handling.

### Core API does not own:
Document processing, embeddings, vector search, or LLM execution.

## 13. Day 4 Status

**Core API LLD: LOCKED**

Completed:
- HTTP/API layer
- Endpoint design
- Middleware
- Validators
- Controllers
- Error/response architecture
- External dependency boundaries
- Upload workflow
- Failure strategy
- Service boundaries

**Postponed:**
- Database modelling and relationships → dedicated database-design day after Document Processing + RAG/AI LLD.

**Next:** Day 5 — Document Processing LLD + RAG/AI LLD
