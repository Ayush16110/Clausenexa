# ClauseNexa

> An AI-powered legal contract analysis platform designed to process, understand, and query complex legal documents.

ClauseNexa is a production-oriented legal contract analysis platform built around asynchronous document processing, Retrieval-Augmented Generation (RAG), vector search, and AI-powered contract analysis.

> **Project Status:** ðŸš§ Active Development â€” Backend in Progress

---

## ðŸ“Œ Problem Statement

Legal contracts can contain hundreds of pages of complex clauses, obligations, liabilities, and conditions. Manually reviewing these documents is time-consuming and inefficient.

ClauseNexa addresses the engineering challenges of large-document processing through asynchronous processing, object storage, background workers, vector search, and a RAG-based AI pipeline.

---

# ðŸŽ¯ Project Goals

- Upload and manage legal contract documents.
- Process large PDF documents asynchronously.
- Extract, clean, and chunk document text.
- Generate and store vector embeddings.
- Enable contextual AI-powered contract Q&A.
- Retrieve relevant clauses and document sections.
- Provide page and clause references where available.
- Perform automated contract risk analysis.
- Maintain document processing and version information.
- Design services that can scale independently.

---

# ðŸ—ï¸ Architecture

```text
                         Frontend
                            â”‚
                            â–¼
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚   Core API   â”‚
                    â”‚    :5000     â”‚
                    â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
                           â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚            â”‚            â”‚
              â–¼            â–¼            â–¼
          MongoDB         R2       Processing API
                                      :8000
                                        â”‚
                                        â–¼
                                  Redis / BullMQ
                                        â”‚
                                        â–¼
                              Document Worker
                                        â”‚
                                        â–¼
                                  Vector DB


                    Core API
                       â”‚
                       â–¼
                RAG / AI Service
                    :3000
                       â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”
              â–¼                 â–¼
          Vector DB          MongoDB
              â”‚
              â–¼
          LLM Provider
```

### Service responsibilities

#### Core API â€” `:5000`

Responsible for:

- Authentication and authorization
- User management
- Contract management
- Document management
- PDF upload handling
- Cloudflare R2 integration
- Document metadata
- Calling the Document Processing Service
- Returning processing status

The Core API does **not** perform heavy PDF processing or AI context construction.

#### Document Processing Service â€” `:8000`

Responsible for:

- Creating document processing jobs
- BullMQ queue management
- Background workers
- PDF extraction
- Text cleaning
- Document chunking
- Embedding generation
- Vector database storage
- Processing status updates

#### RAG / AI Service â€” `:3000`

Responsible for:

- Query embedding
- Vector retrieval
- Contract-aware context construction
- Prompt construction
- LLM interaction
- AI-powered contract Q&A
- Contract audit analysis

---

# ðŸ”„ Document Processing Workflow

Document processing is intentionally asynchronous.

```text
User
  â”‚
  â–¼
Frontend
  â”‚
  â–¼
Core API :5000
  â”‚
  â”œâ”€â”€ Validate request
  â”œâ”€â”€ Upload PDF â†’ Cloudflare R2
  â”œâ”€â”€ Store metadata â†’ MongoDB
  â”‚
  â–¼
Document Processing Service :8000
  â”‚
  â”œâ”€â”€ Create BullMQ job
  â”‚
  â–¼
202 Accepted
  â”‚
  â–¼
Redis / BullMQ
  â”‚
  â–¼
Worker
  â”‚
  â”œâ”€â”€ Fetch PDF from R2
  â”œâ”€â”€ Extract text
  â”œâ”€â”€ Clean text
  â”œâ”€â”€ Chunk document
  â”œâ”€â”€ Generate embeddings
  â””â”€â”€ Store vectors
```

The API does not wait for the entire document to be processed.

```json
{
  "documentId": "...",
  "jobId": "...",
  "processingStatus": "queued"
}
```

---

# ðŸ“„ Document Management

### API Endpoints

```text
POST   /api/v1/contracts/:contractId/documents
GET    /api/v1/contracts/:contractId/documents
GET    /api/v1/documents/:documentId
DELETE /api/v1/documents/:documentId
```

### Current capabilities

- PDF-only upload
- 25 MB upload limit
- Cloudflare R2 object storage
- SHA-256 file hashing
- Duplicate document detection
- Document metadata persistence
- Processing job tracking
- Processing state tracking
- Soft deletion
- Active document handling
- Ownership validation
- Contract ownership validation

---

# ðŸ” Document Processing States

```text
queued
  â†“
processing
  â†“
extracting
  â†“
chunking
  â†“
embedding
  â†“
storing_vectors
  â†“
completed
```

Failures are tracked using:

```text
processingStatus = failed
processingError = ...
```

---

# ðŸ§  Document Versioning

ClauseNexa treats uploaded documents as independent document versions.

The document tracks:

```text
processingVersion
activeProcessingVersion
```

The contract tracks:

```text
activeDocumentId
```

A new document does not immediately become active.

```text
Current:
Contract
 â””â”€â”€ activeDocumentId â†’ Document A

New upload:
Contract
 â”œâ”€â”€ activeDocumentId â†’ Document A
 â””â”€â”€ Document B â†’ processing

If Document B fails:
 â””â”€â”€ Document A remains active

If Document B succeeds:
 â””â”€â”€ Document B becomes active
```

This prevents failed processing from replacing a working document.

---

# ðŸ¤– AI Contract Q&A

The planned RAG pipeline:

```text
User Question
      â”‚
      â–¼
RAG / AI Service
      â”‚
      â–¼
Generate Query Embedding
      â”‚
      â–¼
Vector Search
      â”‚
      â–¼
Retrieve Relevant Chunks
      â”‚
      â–¼
Build Context
      â”‚
      â–¼
LLM
      â”‚
      â–¼
Grounded Answer
```

Responses are designed to include relevant evidence such as contract information, relevant clauses, document sections, page references, and supporting text.

---

# âš–ï¸ Automated Contract Audit

The planned audit pipeline:

```text
Contract
   â†“
Retrieve Relevant Clauses
   â†“
AI Analysis
   â†“
Risk Detection
   â†“
Classification
   â†“
Evidence
   â†“
Recommendation
   â†“
Audit Report
```

Potential findings include:

- Missing clauses
- Risky clauses
- Ambiguous language
- Termination risks
- Payment risks
- Liability risks
- Indemnification risks
- Confidentiality issues
- Intellectual property concerns
- Non-compete / non-solicitation concerns
- Governing law and jurisdiction issues

Each finding is intended to contain:

```text
Risk Level
Finding
Explanation
Evidence
Page Reference
Recommendation
```

---

# ðŸ› ï¸ Technology Stack

## Current Backend

- Node.js
- Express.js
- MongoDB
- Mongoose
- Cloudflare R2
- Multer
- Jest

## Planned Backend Infrastructure

- Redis
- BullMQ
- Docker
- Vector Database
- Embedding Model
- LLM Provider

## Planned Frontend

- React
- TypeScript
- Tailwind CSS

---

# ðŸ“ Project Structure

```text
ClauseNexa/
â”‚
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ core-api/
â”‚   â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â””â”€â”€ tests/
â”‚   â”‚
â”‚   â”œâ”€â”€ document-processing/
â”‚   â”‚
â”‚   â””â”€â”€ rag-service/
â”‚
â”œâ”€â”€ client/
â”‚
â”œâ”€â”€ docs/
â”‚   â”œâ”€â”€ architecture/
â”‚   â””â”€â”€ diagrams/
â”‚
â”œâ”€â”€ README.md
â””â”€â”€ .gitignore
```

---

# ðŸ§ª Testing

Testing is being implemented alongside backend development.

### Current Document Controller coverage

```text
29 tests
29 passing
```

Tests cover:

- Invalid IDs
- Missing files
- Contract ownership
- Duplicate uploads
- Successful uploads
- R2 failures
- Database failures
- Processing service failures
- Cleanup failures
- Document retrieval
- Empty document collections
- Soft deletion
- Active document deletion
- Database error paths

Additional service and integration tests will be added as those services are implemented.

---

# ðŸ—ºï¸ Development Roadmap

## Weeks 1â€“3 â€” Core Backend âœ…

- [x] Project definition
- [x] Functional requirements
- [x] High-Level Design
- [x] Service boundaries
- [x] Low-Level Design
- [x] Repository setup
- [x] Authentication
- [x] Authorization
- [x] User management
- [x] Contract management
- [x] Document management
- [x] PDF upload
- [x] Cloudflare R2 integration
- [x] Duplicate document detection
- [x] Document soft deletion
- [x] Document processing integration point
- [x] Document controller tests

## Week 4 â€” Document Processing Service

- [ ] Document Processing Service
- [ ] Redis
- [ ] BullMQ
- [ ] Job producer
- [ ] Background worker
- [ ] Processing service API
- [ ] Job retry strategy
- [ ] Processing service tests

## Week 5 â€” PDF Processing Pipeline

- [ ] PDF extraction
- [ ] Text cleaning
- [ ] Document chunking
- [ ] Chunk metadata
- [ ] Processing status updates
- [ ] Failure handling
- [ ] Retry support

## Week 6 â€” Embeddings + Vector DB

- [ ] Embedding generation
- [ ] Vector database
- [ ] Vector indexing
- [ ] Metadata filtering
- [ ] Processing versioning
- [ ] Active document activation

## Week 7 â€” RAG Service

- [ ] RAG Service
- [ ] Query embeddings
- [ ] Semantic retrieval
- [ ] Contract-aware retrieval
- [ ] Prompt construction
- [ ] LLM integration
- [ ] Citation handling
- [ ] AI Q&A testing

## Week 8 â€” AI Audit + Backend Completion

- [ ] Automated contract audit engine
- [ ] Risk classification
- [ ] Evidence extraction
- [ ] Recommendations
- [ ] Backend integration testing
- [ ] Security hardening
- [ ] Reliability improvements
- [ ] Production-readiness review

> **Backend milestone:** At the end of Week 8, the complete backend should be usable independently without the frontend.

## Week 9 â€” Frontend Core

- [ ] React application
- [ ] Authentication UI
- [ ] Dashboard
- [ ] Contract management UI
- [ ] Document upload
- [ ] Processing status
- [ ] Contract workspace

## Week 10 â€” Frontend AI + UX

- [ ] AI chat
- [ ] Citation UI
- [ ] Audit report UI
- [ ] Risk visualization
- [ ] Loading states
- [ ] Error states
- [ ] Responsive UI
- [ ] UX polish

## Week 11 â€” Beta Testing + Improvements

- [ ] End-to-end testing
- [ ] Large PDF testing
- [ ] Concurrent processing testing
- [ ] AI response testing
- [ ] RAG accuracy testing
- [ ] Security testing
- [ ] Performance testing
- [ ] Bug fixing
- [ ] Regression testing

## Week 12 â€” Production Deployment

- [ ] Production infrastructure
- [ ] Environment configuration
- [ ] Backend deployment
- [ ] Document Processing deployment
- [ ] RAG deployment
- [ ] Database deployment
- [ ] Redis deployment
- [ ] Vector database deployment
- [ ] Frontend deployment
- [ ] Domain and HTTPS
- [ ] Production testing
- [ ] Final release

---

# ðŸ“… 12-Week Plan

```text
Week 1â€“3   â–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆâ–ˆ  Core Backend       âœ…
Week 4     â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  Processing Service
Week 5     â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  PDF Pipeline
Week 6     â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  Embeddings + Vector DB
Week 7     â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  RAG Service
Week 8     â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  AI Audit + Hardening

Week 9     â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  Frontend Core
Week 10    â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  Frontend AI + UX

Week 11    â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  Beta Testing
Week 12    â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘â–‘  Production Deployment
```

---

# ðŸ“š Architecture Documentation

Current architecture documentation includes:

- High-Level Design
- Service Communication & Data Flow
- Low-Level Design

These documents define service responsibilities, communication boundaries, data ownership, and the processing architecture.

---

# ðŸŽ“ Engineering Objectives

ClauseNexa is being built as a production-oriented engineering project with a focus on:

- Backend architecture
- REST API design
- Asynchronous processing
- Distributed systems
- Queue-based workloads
- Background workers
- Object storage
- Vector databases
- Retrieval-Augmented Generation
- LLM integration
- Service boundaries
- Data consistency
- Document versioning
- Fault tolerance
- Testing
- Security
- Scalability
- Production deployment

---

# âš ï¸ Project Status

ClauseNexa is currently under active development.

The **Core API foundation and document management system are implemented**. The Document Processing Service, RAG pipeline, AI audit engine, frontend, beta testing, and production deployment are being developed according to the roadmap above.

This project is currently intended for **educational and portfolio purposes**.

---

# ðŸ‘¨â€ðŸ’» Author

**Ayush Narayan Gupta**

Built as part of the **Zero to FAANG** engineering journey.
