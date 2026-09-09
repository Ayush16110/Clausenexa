# ClauseNexa — Service-Level Architecture

## 1. Overview

ClauseNexa uses a service-oriented backend architecture with three major services:

1. **Core API Service**
2. **Document Processing Service**
3. **RAG / AI Service**

Heavy document processing is asynchronous through Redis/BullMQ. Normal application requests and AI queries are synchronous.

---

## 2. Service-Level Architecture

```text
                           ┌──────────────┐
                           │   Frontend   │
                           └──────┬───────┘
                                  │ HTTPS
                                  ▼
                         ┌─────────────────┐
                         │  Load Balancer  │
                         └────────┬────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐
                    │        Core API          │
                    │                          │
                    │ Auth                     │
                    │ User                     │
                    │ Contract                 │
                    │ Document                 │
                    │ Job                      │
                    │ HTTP / API Layer         │
                    └──────┬──────┬───────┬─────┘
                           │      │       │
                           ▼      ▼       ▼
                       MongoDB  Object   Redis /
                                Storage  BullMQ
                                           │
                                      Async Jobs
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │ Document Processing      │
                              │                          │
                              │ Job Management           │
                              │ Document Management      │
                              │ Document Processing      │
                              │ Vector DB Interaction    │
                              └────────────┬─────────────┘
                                           │
                                           ▼
                                       Vector DB


                    Core API
                       │
                       │ Contract ID + User Prompt
                       │ Synchronous
                       ▼
             ┌──────────────────────────────┐
             │        RAG / AI Service      │
             │                              │
             │ Data Ingestion              │
             │ Data Retrieval              │
             │ Prompt Designing            │
             │ LLM Management              │
             └───────┬──────────┬───────────┘
                     │          │
                     ▼          ▼
                  MongoDB    Vector DB
                     │          │
                     └────┬─────┘
                          ▼
                        LLM
                          │
                    AI Response
                          ▼
                     Core API
                          ▼
                       Frontend
```

---

## 3. Core API Service

### Responsibilities

- Authentication: registration, login, logout, password handling, token/session creation and verification, authorization.
- User management.
- Contract CRUD, metadata, ownership/access, and lifecycle/status.
- Document/file handling: receive, validate, store original PDFs in Object Storage, retrieve files, create processing jobs.
- Job management: create jobs, submit to BullMQ, retrieve status/progress, handle job information.
- HTTP request handling: routing, validation, and responses.

### Boundaries

The Core API does **not**:

- Extract document text.
- Chunk documents.
- Generate embeddings.
- Access the Vector DB for embedding storage/retrieval.
- Contact the LLM directly.
- Perform heavy AI/document processing.

### Internal Modules

```text
Core API
├── Authentication Module
├── User Module
├── Contract Module
├── Document Module
├── Job Module
└── HTTP/API Layer
```

### Entry Point

```text
Frontend → HTTPS Request → Core API
```

---

## 4. Document Processing Service

### Responsibilities

- Consume document-processing jobs.
- Fetch required document metadata.
- Fetch original documents.
- Extract and prepare text.
- Chunk documents.
- Generate embeddings.
- Store/update/delete vectors.
- Report job progress, completion, and failure.
- Run through multiple worker instances when required.

### Boundaries

The Document Processing Service does **not**:

- Modify original documents.
- Own application-level document CRUD.
- Contact the LLM.
- Communicate directly with RAG / AI.
- Handle normal application HTTP requests.
- Own authentication or user management.

### Internal Modules

```text
Document Processing Service
├── Job Management
│   └── BullMQ Interaction
├── Document Management
│   ├── Fetch Metadata
│   └── Fetch Original Document
├── Document Processing
│   ├── Extract Text
│   ├── Prepare Text
│   ├── Chunk Document
│   └── Generate Embeddings
└── Vector Database Interaction
    ├── Store Vectors
    ├── Update Vectors
    └── Delete Vectors
```

### Entry Point

```text
Redis / BullMQ → Async Job → Document Processing Worker
```

---

## 5. RAG / AI Service

### Responsibilities

- Receive contract ID and user prompt.
- Retrieve contract metadata.
- Retrieve relevant contract context.
- Retrieve previous chat history.
- Perform vector search.
- Build contextual prompts.
- Send prompts to the LLM.
- Handle LLM responses and errors.
- Return AI responses with relevant source/clause/page references.

### Boundaries

The RAG / AI Service does **not**:

- Handle authentication.
- Manage users.
- Perform contract CRUD.
- Ingest/process original documents.
- Generate or store embeddings.
- Create document-processing jobs.
- Store original PDFs.
- Communicate directly with Document Processing.

### Internal Modules

```text
RAG / AI Service
├── Data Ingestion
│   └── Receive AI Request
├── Data Retrieval
│   ├── Contract Metadata
│   ├── Chat History
│   └── Vector Search
├── Prompt Designing
│   └── Build Contextual Prompt
└── LLM Management
    ├── LLM Communication
    ├── Response Handling
    └── Error Handling
```

### Entry Point

```text
Core API → Contract ID + User Prompt → RAG / AI
```

This interaction is synchronous.

---

## 6. Service Dependencies

| Service | Dependency | Access | Purpose |
|---|---|---|---|
| Core API | MongoDB | Read / Write | Users, contracts, metadata, application data |
| Core API | Object Storage | Read / Write | Original PDF files |
| Core API | Redis / BullMQ | Read / Write | Processing jobs and job state |
| Core API | RAG / AI | Request / Response | AI query handling |
| Document Processing | Redis / BullMQ | Consume / Update | Background document jobs |
| Document Processing | MongoDB | Read | Required document metadata |
| Document Processing | Object Storage | Read | Fetch original PDFs |
| Document Processing | Vector DB | Read / Write | Embeddings and chunks |
| RAG / AI | MongoDB | Read | Contract metadata and chat history |
| RAG / AI | Vector DB | Read | Relevant contract context |
| RAG / AI | LLM | Request / Response | AI generation |

---

## 7. Communication Patterns

### Synchronous

```text
Frontend → Core API
Core API → RAG / AI
RAG / AI → LLM
Core API → MongoDB
Core API → Object Storage
RAG / AI → MongoDB
RAG / AI → Vector DB
```

### Asynchronous

Document processing uses Redis/BullMQ:

```text
Core API
   │
   │ Create Job
   ▼
Redis / BullMQ
   │
   │ Consume Job
   ▼
Document Processing Worker
```

The Core API does not wait for full document processing. It returns:

```text
HTTP 202 Accepted
+
Job / Tracking ID
```

---

## 8. Document Upload Flow

```text
User
 ↓
Frontend
 ↓
Core API
 ↓
Validate PDF
 ↓
Object Storage ← Original PDF
 ↓
MongoDB ← Contract / Document Metadata
 ↓
Redis / BullMQ ← Lightweight Job Reference
 ↓
Document Processing Worker
 ↓
Fetch PDF from Object Storage
 ↓
Extract Text
 ↓
Prepare Text
 ↓
Chunk
 ↓
Generate Embeddings
 ↓
Vector DB
 ↓
Job Completed
```

### Queue Rule

The actual PDF is **never placed inside Redis/BullMQ**.

The job contains lightweight references such as:

```text
{
  contractId,
  documentReference,
  jobType
}
```

The worker retrieves the PDF from Object Storage using the reference.

---

## 9. RAG Query Flow

```text
User Prompt
 ↓
Frontend
 ↓
Core API
 ↓
RAG / AI
 │
 ├── Contract Metadata → MongoDB
 ├── Chat History      → MongoDB
 └── Relevant Chunks   → Vector DB
 ↓
Contextual Prompt
 ↓
LLM
 ↓
AI Response
 ↓
Sources / Clause / Page References
 ↓
Core API
 ↓
Frontend
```

---

## 10. Architectural Rules

### Rule 1 — Core API owns application operations

Authentication, users, contracts, documents, jobs, and user-facing HTTP operations belong to Core API.

### Rule 2 — Document Processing owns heavy document work

PDF extraction, preparation, chunking, and embedding generation belong to Document Processing.

### Rule 3 — RAG owns AI query orchestration

Retrieval, context construction, prompt design, and LLM communication belong to RAG / AI.

### Rule 4 — Original documents belong to Object Storage

Large PDFs are not stored directly in MongoDB or Redis.

### Rule 5 — Embeddings belong to the Vector DB

Vectors and their chunk metadata are stored in the Vector DB.

### Rule 6 — Redis/BullMQ is the asynchronous boundary

Heavy document processing is decoupled from the normal request-response lifecycle.

### Rule 7 — Document Processing and RAG remain independent

There is no direct service-to-service dependency between them. Both interact with the Vector DB according to their responsibilities.

### Rule 8 — Core API does not directly call the LLM

All AI/LLM communication is isolated inside RAG / AI.

---

## 11. Scaling Strategy

### Core API

Can be horizontally scaled behind the Load Balancer:

```text
Load Balancer
 ├── Core API Instance
 ├── Core API Instance
 └── Core API Instance
```

### Document Processing

Workers can scale according to queue workload:

```text
Redis / BullMQ
 ├── Worker
 ├── Worker
 └── Worker
```

### RAG / AI

RAG instances can also scale independently:

```text
Load Balancer
 ├── RAG Instance
 ├── RAG Instance
 └── RAG Instance
```

This prevents heavy document-processing or AI workloads from unnecessarily slowing the Core API.

---

## 12. Final Service Boundary

```text
┌─────────────────────────────────────────────────────────┐
│                        CORE API                         │
│                                                         │
│ Auth • Users • Contracts • Documents • Jobs • HTTP     │
└─────────────────────────────────────────────────────────┘
              │                         │
              │ Async                   │ Sync
              ▼                         ▼
        Redis / BullMQ              RAG / AI
              │                         │
              ▼                         ├── MongoDB (Read)
    Document Processing                 ├── Vector DB (Read)
              │                         └── LLM
              ├── Object Storage
              ├── MongoDB (Read)
              └── Vector DB (Read/Write)
```

### Core Principle

> **Core API handles application operations, Document Processing handles asynchronous document intelligence preparation, and RAG / AI handles contextual AI reasoning.**

---

## 13. Week 2 Day 3 — Definition of Done

- [x] Service responsibilities finalized
- [x] Ownership boundaries finalized
- [x] Internal modules identified
- [x] Service entry points defined
- [x] Dependencies defined
- [x] Synchronous vs asynchronous communication defined
- [x] Service-level architecture diagram completed
- [x] Architecture rules documented

**Status: Week 2 Day 3 — Complete**
