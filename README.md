# ClauseNexa

> An AI-powered legal contract analysis platform designed to process, understand, and query complex legal documents.

ClauseNexa enables users to upload legal contracts and interact with them using natural language. The system processes large PDF documents asynchronously, converts relevant document content into embeddings, and uses a Retrieval-Augmented Generation (RAG) pipeline to provide contextual AI-powered answers with clause and page references.

> **Project Status:** 🚧 Architecture & Development Phase

---

## 📌 Problem Statement

Legal contracts can contain hundreds of pages of complex clauses, obligations, liabilities, and conditions. Manually reviewing these documents is time-consuming and inefficient.

Processing such large documents also introduces engineering challenges:

- Large PDF processing can take significant time.
- Synchronous processing can block application resources.
- Multiple documents may need to be processed simultaneously.
- AI models require relevant context instead of an entire document.
- Large AI requests can introduce latency and reliability issues.

ClauseNexa is designed to address these challenges using asynchronous document processing, vector search, and a RAG-based AI pipeline.

---

## 🎯 Project Goals

The primary goals of ClauseNexa are to:

- Upload and manage legal contract documents.
- Process large PDF documents asynchronously.
- Extract and chunk contract content.
- Generate and store vector embeddings.
- Enable contextual AI-powered contract Q&A.
- Retrieve relevant clauses and document sections.
- Provide page and clause references where available.
- Maintain contract-related conversation history.
- Design services that can scale independently.

---

# 🏗️ High-Level Architecture

ClauseNexa is divided into three primary application services:

```text
Frontend
    │
    ▼
Core API Service
    │
    ├──────────────► MongoDB
    │
    ├──────────────► Object Storage
    │
    ├──────────────► Redis + BullMQ
    │                       │
    │                       ▼
    │              Document Processing Service
    │                       │
    │                       ▼
    │                 Vector Database
    │
    └──────────────► RAG / AI Service
                            │
                    ┌───────┴────────┐
                    ▼                ▼
                 MongoDB        Vector Database
                                         │
                                         ▼
                                    LLM Provider
```

The Core API remains lightweight by delegating heavy document processing and AI context construction to dedicated services.

---

# 🔄 System Workflows

## 📄 Contract Upload and Processing

Document processing is asynchronous.

```text
User
  ↓
Frontend
  ↓
Core API
  ├── Store Metadata → MongoDB
  ├── Store PDF → Object Storage
  └── Create Job → Redis / BullMQ
                        ↓
                  202 Accepted
```

The document is then processed in the background:

```text
BullMQ
   ↓
Document Processing Service
   ↓
Fetch Original PDF
   ↓
Extract Text
   ↓
Chunk Document
   ↓
Generate Embeddings
   ↓
Store in Vector Database
```

---

## 🤖 AI Contract Q&A

The RAG / AI pipeline processes contract-related questions synchronously.

```text
User Prompt + Contract ID
          ↓
       Core API
          ↓
    RAG / AI Service
          │
          ├── Retrieve Contract / Chat Context
          │
          ├── Search Relevant Document Chunks
          │
          └── Build Contextual Prompt
                    ↓
                LLM Provider
                    ↓
                AI Response
                    ↓
                 Frontend
```

The AI response may include:

- Contextual answers
- Relevant contract information
- Clause references
- Page references

---

# 🧠 Key Architectural Decisions

### 1. Asynchronous Document Processing

Large documents are processed through a background job queue instead of blocking the Core API request lifecycle.

```text
Core API
   ↓
BullMQ
   ↓
Worker
```

The upload endpoint can immediately return `202 Accepted` while processing continues in the background.

---

### 2. Lightweight Queue Jobs

Large PDF files are not stored inside Redis.

Instead:

```text
PDF → Object Storage

Document Reference → BullMQ Job
```

Queue jobs contain lightweight information such as:

- Contract ID
- Document storage reference
- Job type
- Processing metadata

---

### 3. RAG Service Owns AI Context Construction

The Core API sends:

```text
Contract ID + User Prompt
```

The RAG / AI Service is responsible for retrieving:

- Contract context
- Previous chat history
- Relevant document chunks

It then constructs the final prompt sent to the LLM.

---

### 4. Controlled Service Data Access

Each service receives access only to the data stores required for its responsibilities.

| Service | MongoDB | Object Storage | Redis/BullMQ | Vector DB |
|---|---|---|---|---|
| Core API | Read / Write | Read / Write | Read / Write | — |
| Document Processing | Read | Read | Consume Jobs | Read / Write |
| RAG / AI Pipeline | Read | — | — | Read |

---

# 🛠️ Planned Technology Stack

> The final technology choices may evolve during implementation.

### Frontend

- React
- TypeScript
- Tailwind CSS

### Core Backend

- Node.js
- Express.js
- TypeScript

### Database

- MongoDB

### Background Processing

- Redis
- BullMQ

### Document Storage

- Object Storage

### AI / RAG

- Embedding Model
- Vector Database
- LLM Provider

### Infrastructure

- Docker
- Reverse Proxy / Load Balancer
- Cloud Deployment

---

# 📁 Planned Project Structure

```text
ClauseNexa/
│
├── frontend/
│
├── backend/
│   ├── core-api/
│   ├── document-processing/
│   └── rag-service/
│
├── docs/
│   ├── architecture/
│   └── diagrams/
│
├── docker/
│
├── README.md
└── .gitignore
```

The final monorepo structure may evolve as implementation begins.

---

# 📚 Architecture Documentation

The project's architecture is being designed before implementation.

Current documentation:

- [High-Level Design](docs/architecture/HLD.md)
- [Service Communication & Data Flow](docs/architecture/service-communication-data-flow.md)

---

# 🗺️ Development Roadmap

## Phase 1 — System Design & Architecture

- [x] Project problem definition
- [x] Functional requirements
- [x] User capabilities design
- [x] Data Flow Diagrams
- [x] High-Level Design
- [x] Service communication design
- [x] Service data-access boundaries
- [ ] Low-Level Design

## Phase 2 — Project Foundation

- [ ] Repository setup
- [ ] Development environment setup
- [ ] Backend service setup
- [ ] Database configuration
- [ ] Docker configuration

## Phase 3 — Core Application

- [ ] Authentication and authorization
- [ ] User management
- [ ] Contract management
- [ ] Document upload

## Phase 4 — Document Processing

- [ ] Redis setup
- [ ] BullMQ queue
- [ ] Background workers
- [ ] PDF text extraction
- [ ] Document chunking
- [ ] Embedding generation
- [ ] Vector database integration

## Phase 5 — RAG & AI

- [ ] Context retrieval
- [ ] Contract-aware AI queries
- [ ] Prompt construction
- [ ] LLM integration
- [ ] Conversation history

## Phase 6 — Production Engineering

- [ ] Error handling
- [ ] Retry mechanisms
- [ ] Circuit breakers
- [ ] Rate limiting
- [ ] Logging and monitoring
- [ ] Testing
- [ ] Containerization
- [ ] Deployment

---

# 📊 Current Project Status

```text
Project Architecture     ██████████░░  In Progress
Core Backend             ░░░░░░░░░░░░  Not Started
Document Processing      ░░░░░░░░░░░░  Not Started
RAG / AI Pipeline        ░░░░░░░░░░░░  Not Started
Frontend                 ░░░░░░░░░░░░  Not Started
Production Engineering   ░░░░░░░░░░░░  Not Started
```

---

# 🎓 Learning Objectives

ClauseNexa is being built as a production-oriented engineering project with a focus on:

- Backend architecture
- Asynchronous processing
- Distributed system concepts
- Queue-based workloads
- Background workers
- AI integration
- Retrieval-Augmented Generation
- Vector databases
- Service boundaries
- System scalability
- Production reliability

---

## 📄 License

This project is currently being developed for educational and portfolio purposes.

---

## 👨‍💻 Author

**Ayush Narayan Gupta**

Built as part of the **Zero to FAANG** engineering journey.