# ClauseNexa — High-Level Design (HLD)

**Version:** 1.0  
**Status:** Finalized  
**Architecture Style:** Service-oriented, asynchronous, independently scalable

---

## 1. Overview

ClauseNexa is an AI-powered contract intelligence platform designed to help users upload, process, analyze, and query legal contracts.

The primary architectural principle is:

> **Keep the Core API lightweight and responsive by delegating heavy document processing and AI-intensive workloads to specialized, independently scalable services.**

The system has three major backend boundaries:

1. **Core API Service**
2. **Document Processing Service**
3. **RAG / AI Service**

---

## 2. High-Level Architecture

> Save the final HLD image as `docs/architecture/diagrams/clausenexa-hld.png`.

```text
Users / Admin
      |
      | HTTPS
      v
React Frontend
      |
      | HTTPS
      v
Load Balancer
      |
      v
Core API Service
   |      |       |
   |      |       +----> Redis + BullMQ
   |      |
   |      +------------> File / Object Storage
   |
   +-------------------> MongoDB

Redis + BullMQ
      |
      v
Document Processing Service
      |
      v
Vector Database
      ^
      |
RAG / AI Service
      |
      v
LLM Provider
```

---

# 3. Architectural Principles

## 3.1 Lightweight Core API

The Core API focuses on:

- HTTP request handling
- Authentication and authorization
- Request validation
- Business logic
- Contract management
- Upload orchestration
- Job creation
- Status retrieval
- Returning results

The Core API should not directly perform:

- Large PDF processing
- Text extraction
- Document chunking
- Bulk embedding generation
- Long-running AI operations

## 3.2 Asynchronous Processing

Long-running document processing is handled through a background queue.

```text
User Upload
    |
    v
Core API
    |
    +--> Store PDF and metadata
    |
    +--> Create BullMQ job
    |
    v
Return 202 Accepted

--------- ASYNCHRONOUS ---------

BullMQ Queue
    |
    v
Document Processing Worker
    |
    v
Process Contract
```

## 3.3 Independent Scalability

| Component | Primary Workload | Scaling Trigger |
|---|---|---|
| Core API | HTTP requests and business logic | High user traffic |
| Document Processing Service | Background processing | Large job backlog |
| RAG / AI Service | AI and retrieval workloads | High query traffic |

---

# 4. Client Layer

## React Frontend

The frontend provides interfaces for:

- User registration and login
- Contract upload
- Contract management
- Processing status tracking
- Viewing contract analysis
- Contract Q&A
- Profile management
- Admin operations

The frontend communicates with the backend through HTTPS requests.

---

# 5. Load Balancer

The load balancer acts as the entry point for backend traffic.

```text
Users
   |
   v
Load Balancer
   |
   +----> Core API Instance #1
   |
   +----> Core API Instance #2
   |
   +----> Core API Instance #N
```

### Responsibilities

- Distribute incoming traffic
- Support horizontal scaling
- Prevent individual API instances from becoming overloaded
- Improve availability

---

# 6. Core API Service

The Core API Service is the primary business and orchestration layer.

## Responsibilities

### Authentication and Authorization

- User registration
- Login and logout
- Session/token management
- Role-based access control

### Contract Management

- Create contracts
- Retrieve contracts
- Update contract metadata
- Delete contracts
- Ownership validation

### Upload Orchestration

- Validate uploaded files
- Store contract metadata
- Store original documents
- Create processing jobs

### Status and Result Retrieval

- Retrieve processing status
- Retrieve completed analysis
- Return contract information

### Administration

- User management
- Contract monitoring
- Job monitoring
- System operations

---

# 7. MongoDB — Primary Database

MongoDB stores application and business data.

## Expected Data

```text
Users
Roles
Contract Metadata
Contract Ownership
Processing Status
Job References
AI Analysis Results
Conversation Metadata
Audit Logs
```

Original PDF documents are stored separately in object/file storage.

---

# 8. File / Object Storage

File/Object Storage stores:

- Original contract PDFs

Flow:

```text
User
  |
  v
Core API
  |
  v
File / Object Storage
```

The Document Processing Service retrieves the document from storage when processing begins.

---

# 9. Redis + BullMQ

Redis with BullMQ manages asynchronous background jobs.

```text
Core API
   |
   | Create Job
   v
BullMQ Queue
   |
   | Consume Job
   v
Available Worker
```

## Responsibilities

- Job queueing
- Worker coordination
- Controlled concurrency
- Retry handling
- Exponential backoff
- Failed-job management
- Job status tracking

---

# 10. Document Processing Service

This service handles heavy and long-running document workloads.

## Processing Pipeline

```text
BullMQ Job
    |
    v
Retrieve PDF
    |
    v
Extract Text
    |
    v
Clean / Normalize
    |
    v
Chunk Document
    |
    v
Generate Embeddings
    |
    v
Store Vectors
    |
    v
Update Processing Status
```

## Worker Model

```text
BullMQ Queue
    |
    +----> Worker #1
    |
    +----> Worker #2
    |
    +----> Worker #3
    |
    +----> Worker #N
```

This enables document-processing capacity to scale independently from the Core API.

---

# 11. Vector Database

The Vector Database stores embeddings generated from contract content.

Each vector should include metadata such as:

- Contract ID
- User ID
- Chunk ID
- Page number
- Section or clause information

## Responsibilities

- Semantic similarity search
- Relevant context retrieval
- RAG support

---

# 12. RAG / AI Service

The RAG / AI Service handles AI-intensive operations.

## Responsibilities

- Query processing
- Query embedding
- Vector retrieval
- Context assembly
- Prompt construction
- LLM communication
- Structured output processing
- AI error handling

The service can be deployed and scaled independently from the Core API.

---

# 13. LLM Provider

The LLM Provider is an external AI service responsible for generating AI-powered responses.

Potential use cases:

- Contract summaries
- Clause extraction
- Risk analysis
- Obligation identification
- Contract Q&A

The RAG / AI Service communicates with the LLM provider rather than exposing this responsibility directly through the Core API.

---

# 14. Major System Flows

## 14.1 Contract Upload Flow

```text
User
  |
  | HTTPS Request
  v
Load Balancer
  |
  v
Core API
  |
  +--> Validate request
  |
  +--> Store metadata in MongoDB
  |
  +--> Store PDF in Object Storage
  |
  +--> Create job in BullMQ
  |
  v
Return 202 Accepted
  |
  v
User
```

The API does not wait for the contract to finish processing.

---

## 14.2 Asynchronous Document Processing Flow

```text
BullMQ Queue
    |
    v
Worker Picks Job
    |
    v
Retrieve PDF from Object Storage
    |
    v
Extract Text
    |
    v
Clean Text
    |
    v
Chunk Document
    |
    v
Generate Embeddings
    |
    v
Store Embeddings in Vector Database
    |
    v
Update Processing Status in MongoDB
```

---

## 14.3 AI Analysis Flow

```text
User Requests Analysis
    |
    v
Core API
    |
    v
RAG / AI Service
    |
    v
Retrieve Relevant Context
    |
    v
LLM Provider
    |
    v
Structured Analysis
    |
    v
Store Results in MongoDB
    |
    v
Core API
    |
    v
User
```

Generated analysis can include:

- Contract summary
- Extracted clauses
- Risk analysis
- Important obligations
- Key dates
- Potential issues

---

## 14.4 Contract Q&A Flow

```text
User Question
    |
    v
Core API
    |
    v
RAG / AI Service
    |
    v
Generate Query Embedding
    |
    v
Vector Database
    |
    v
Retrieve Relevant Chunks
    |
    v
Context Assembly
    |
    v
LLM Provider
    |
    v
Answer + Sources
    |
    v
Core API
    |
    v
User
```

---

# 15. Service Communication Overview

| Source | Destination | Communication / Data |
|---|---|---|
| User | React Frontend | User interaction |
| Frontend | Load Balancer | HTTPS |
| Load Balancer | Core API | HTTPS |
| Core API | MongoDB | Application data |
| Core API | Object Storage | Contract PDFs |
| Core API | Redis/BullMQ | Processing jobs |
| Document Worker | BullMQ | Job consumption |
| Document Worker | Object Storage | Document retrieval |
| Document Worker | Vector Database | Embeddings + metadata |
| RAG Service | Vector Database | Similarity search |
| RAG Service | LLM Provider | Prompt and context |
| RAG Service | Core API | AI response / result |

---

# 16. Scaling Strategy

## Core API

Scale when:

- HTTP traffic increases
- Concurrent users increase

## Document Processing Service

Scale when:

- Contract uploads increase
- Queue backlog grows
- Processing time increases

## RAG / AI Service

Scale when:

- AI analysis requests increase
- Contract Q&A traffic increases

---

# 17. Final Architecture Summary

ClauseNexa is designed around three major backend boundaries.

## Core API Service

Responsible for:

> User-facing business operations, request handling, orchestration, and application state.

## Document Processing Service

Responsible for:

> Heavy asynchronous contract processing, including text extraction, chunking, and embedding generation.

## RAG / AI Service

Responsible for:

> Context retrieval and LLM-powered contract intelligence.

---

## Final Architectural Principle

```text
                    Core API
              Lightweight & Responsive
                       |
          +------------+------------+
          |                         |
          v                         v
Document Processing Service     RAG / AI Service
 Heavy Background Work          AI-intensive Work
```

This architecture keeps the Core API manageable while allowing heavy document-processing and AI workloads to scale independently.

---

**ClauseNexa | High-Level Design | Version 1.0**