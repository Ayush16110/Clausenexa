# ClauseNexa --- Service Communication & Data Flow

**Document Type:** Architecture Documentation\
**Phase:** Week 2 --- Day 2\
**Status:** Finalized

------------------------------------------------------------------------

## 1. Purpose

This document defines how the major ClauseNexa components communicate,
what data flows between them, and whether each interaction is
synchronous or asynchronous.

The architecture follows one key principle:

> **Only the document-processing workflow is asynchronous. All other
> primary service interactions are synchronous.**

------------------------------------------------------------------------

# 2. Major Components

-   Frontend
-   Core API Service
-   MongoDB
-   Object Storage
-   Redis + BullMQ
-   Document Processing Service
-   Vector Database
-   RAG / AI Service
-   LLM Provider

------------------------------------------------------------------------

# 3. Communication Patterns

## 3.1 Synchronous Communication

The following interactions use a request-response pattern:

-   Frontend ↔ Core API
-   Core API ↔ MongoDB
-   Core API ↔ Object Storage
-   Core API ↔ RAG / AI Service
-   Document Processing Service ↔ Object Storage
-   Document Processing Service ↔ Vector Database
-   RAG / AI Service ↔ MongoDB
-   RAG / AI Service ↔ Vector Database
-   RAG / AI Service ↔ LLM Provider

## 3.2 Asynchronous Communication

The document-processing workflow is asynchronous:

``` text
Core API
   ↓
Redis / BullMQ Queue
   ↓
Document Processing Worker
```

The Core API creates a processing job and immediately returns
`202 Accepted`. The user does not wait for document extraction,
chunking, embedding generation, or vector storage.

------------------------------------------------------------------------

# 4. Component Communication and Data Flow

## 4.1 Frontend ↔ Core API Service

**Communication:** HTTPS\
**Pattern:** Synchronous

### Frontend → Core API

Data can include:

-   Authentication credentials
-   JSON request data
-   Contract metadata
-   PDF documents during upload
-   User input
-   Contract-related queries
-   AI prompts

Document uploads use `multipart/form-data`.

### Core API → Frontend

Data can include:

-   JSON responses
-   Success or error information
-   Contract data
-   Processing status
-   AI analysis results
-   Contract Q&A responses

------------------------------------------------------------------------

## 4.2 Core API Service ↔ MongoDB

**Pattern:** Synchronous

The Core API performs application-level CRUD operations for:

-   User data
-   Contract data
-   Document metadata
-   Processing status
-   Chat history
-   User prompts
-   AI responses
-   Contract analysis results

The actual PDF is not stored in MongoDB.

------------------------------------------------------------------------

## 4.3 Core API Service ↔ Object Storage

**Pattern:** Synchronous

### Core API → Object Storage

-   Original PDF document

### Object Storage → Core API

-   Original PDF document
-   Document file stream

Primary purposes:

-   Document addition
-   Original document retrieval

``` text
Original PDF → Object Storage
Document Metadata → MongoDB
```

------------------------------------------------------------------------

## 4.4 Core API Service ↔ Redis + BullMQ

**Pattern:** Asynchronous workflow boundary

After the contract is uploaded, the Core API creates a lightweight
processing job.

Job data can include:

-   Contract ID
-   Document storage reference
-   User ID, if required
-   Job type
-   Processing instructions
-   Job metadata

The actual PDF is **not placed inside Redis**.

Example:

``` json
{
  "contractId": "contract_id",
  "documentKey": "contracts/contract_id.pdf",
  "jobType": "DOCUMENT_PROCESSING"
}
```

The job lifecycle may be:

``` text
Waiting
   ↓
Active
   ↓
Completed / Failed
```

The Core API returns `202 Accepted` after the job is created.

------------------------------------------------------------------------

## 4.5 Redis + BullMQ ↔ Document Processing Service

**Pattern:** Asynchronous

### BullMQ → Worker

-   Job data
-   Contract reference
-   Document storage reference
-   Processing instructions

### Worker → BullMQ

-   Job progress
-   Completion information
-   Failure information
-   Job status

------------------------------------------------------------------------

## 4.6 Document Processing Service ↔ Object Storage

**Pattern:** Synchronous from the worker's perspective

The worker:

1.  Receives a job containing a document reference.
2.  Fetches the original PDF.
3.  Processes the document.

Processing includes:

``` text
Extract Text
   ↓
Create Chunks
   ↓
Generate Embeddings
   ↓
Store Embeddings
```

------------------------------------------------------------------------

## 4.7 Document Processing Service ↔ Vector Database

**Pattern:** Synchronous from the worker's perspective

Operations include:

-   Store embeddings
-   Retrieve embeddings when required
-   Update embeddings during reprocessing
-   Delete embeddings when a contract is deleted

The stored information can include:

``` text
Embedding Vectors
+
Chunk Metadata
+
Contract Reference
+
Page / Clause References
```

------------------------------------------------------------------------

## 4.8 Core API Service ↔ RAG / AI Service

**Pattern:** Synchronous

### Core API → RAG / AI Service

Primary data:

-   Contract ID
-   User prompt / question

Optional additional context:

-   User ID
-   Conversation ID

The Core API does not construct the complete AI context.

### RAG / AI Service → Core API

The service returns:

-   AI-generated answer
-   Relevant sources
-   Clause references
-   Page references
-   Response metadata

------------------------------------------------------------------------

## 4.9 RAG / AI Service ↔ MongoDB

**Pattern:** Synchronous

The RAG / AI Service can read:

-   Contract information
-   Contract metadata
-   Previous chat history
-   Conversation context

The RAG / AI Service does not own general application CRUD operations.

------------------------------------------------------------------------

## 4.10 RAG / AI Service ↔ Vector Database

**Pattern:** Synchronous

``` text
User Query
    ↓
RAG / AI Service
    ↓
Query Embedding
    ↓
Vector Database
    ↓
Relevant Document Chunks
    ↓
RAG / AI Service
```

Retrieved context can include:

-   Relevant text chunks
-   Contract references
-   Clause numbers
-   Page numbers

------------------------------------------------------------------------

## 4.11 RAG / AI Service ↔ LLM Provider

**Pattern:** Synchronous

The RAG / AI Service builds a contextual prompt containing:

-   User question
-   Relevant contract data
-   Retrieved document chunks
-   Clause information
-   Page references
-   Previous conversation context
-   System instructions

The LLM returns:

-   AI-generated answer
-   Explanation
-   Risk analysis when applicable
-   Relevant clause references
-   Page references

------------------------------------------------------------------------

# 5. Service Data Access Rules

## 5.1 Core API Service

  Resource          Access
  ----------------- ----------------------------
  MongoDB           Read / Write
  Object Storage    Read / Write
  Redis + BullMQ    Read / Write / Manage Jobs
  Vector Database   No direct access
  LLM Provider      No direct access

Main responsibilities:

-   User and contract CRUD
-   Authentication and authorization
-   Document metadata management
-   Document upload and retrieval
-   Job creation and monitoring
-   Application business logic
-   Calling the RAG / AI Service

------------------------------------------------------------------------

## 5.2 Document Processing Service

  Resource          Access
  ----------------- ---------------------------------
  MongoDB           Read
  Object Storage    Read
  Redis + BullMQ    Consume Jobs / Update Job State
  Vector Database   Read / Write
  LLM Provider      No direct access

Main workflow:

``` text
Read Contract Information
        ↓
Fetch Original PDF
        ↓
Extract Text
        ↓
Chunk Document
        ↓
Generate Embeddings
        ↓
Store / Update Vector Data
```

------------------------------------------------------------------------

## 5.3 RAG / AI Service

  Resource          Access
  ----------------- --------------------
  MongoDB           Read
  Object Storage    No direct access
  Redis + BullMQ    No direct access
  Vector Database   Read
  LLM Provider      Request / Response

Main responsibilities:

-   Retrieve contract information
-   Retrieve relevant chat history
-   Search relevant document context
-   Build contextual prompts
-   Call the LLM Provider
-   Return AI responses

------------------------------------------------------------------------

# 6. Complete System Data Flows

## 6.1 Contract Upload Flow

``` text
User
   ↓
Frontend
   ↓ HTTPS Request (PDF + Metadata)
Core API
   ├── Store Metadata → MongoDB
   ├── Store PDF → Object Storage
   └── Create Job → Redis / BullMQ
                         ↓
                   Return 202 Accepted
                         ↓
                    Frontend / User
```

Background processing:

``` text
BullMQ
   ↓
Document Processing Worker
   ↓
Fetch PDF from Object Storage
   ↓
Extract Text
   ↓
Chunk Document
   ↓
Generate Embeddings
   ↓
Store Embeddings in Vector Database
```

------------------------------------------------------------------------

## 6.2 Contract Question / RAG Flow

``` text
User
   ↓
Frontend
   ↓ Prompt + Contract ID
Core API
   ↓
RAG / AI Service
   ├── Read Contract / Chat Context → MongoDB
   ├── Retrieve Relevant Context → Vector Database
   └── Build Prompt
          ↓
       LLM Provider
          ↓
      AI Response
          ↓
    RAG / AI Service
          ↓
       Core API
          ↓
       Frontend
          ↓
         User
```

------------------------------------------------------------------------

# 7. Key Architectural Decisions

## Decision 1: Only Document Processing Is Asynchronous

Heavy document processing is separated from the user request lifecycle.

``` text
Core API
   ↓
Queue Job
   ↓
202 Accepted

Background:
Queue
   ↓
Worker
   ↓
Process Document
```

------------------------------------------------------------------------

## Decision 2: Large Documents Are Stored Outside Redis

``` text
PDF
 ↓
Object Storage

Document Reference
 ↓
Queue Job
```

Redis/BullMQ receives lightweight job information and references, not
the original PDF.

------------------------------------------------------------------------

## Decision 3: The Core API Remains Lightweight

The Core API owns:

-   Authentication
-   Application business logic
-   CRUD operations
-   Job creation
-   Request routing

It does not directly perform heavy PDF processing, embedding generation,
or AI context construction.

------------------------------------------------------------------------

## Decision 4: The RAG / AI Service Owns AI Context Construction

The Core API sends:

``` text
Contract ID + User Prompt
```

The RAG / AI Service retrieves contract information, previous chat
context, and relevant document chunks before constructing the final LLM
prompt.

------------------------------------------------------------------------

## Decision 5: Services Have Controlled Data Access

Each service receives only the data-store access required for its
responsibilities.

This keeps service boundaries clear and reduces unnecessary coupling.

------------------------------------------------------------------------

# 8. Final Summary

ClauseNexa uses a primarily synchronous architecture for normal
user-facing requests, with a dedicated asynchronous pipeline for heavy
document processing.

``` text
Frontend
    ↓
Core API
    ├── MongoDB
    ├── Object Storage
    ├── Redis / BullMQ → Document Processing Service → Vector DB
    └── RAG / AI Service
            ├── MongoDB
            ├── Vector DB
            └── LLM Provider
```

> **Keep user-facing requests fast, move heavy document processing to
> background workers, and isolate AI context construction inside the RAG
> / AI pipeline.**

------------------------------------------------------------------------

# 9. Status

**Architecture Decision:** Finalized\
**Week:** 2\
**Day:** 2\
**Next Step:** Continue Week 2 architecture and design work.
