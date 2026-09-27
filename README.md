# ClauseNexa

> An AI-powered legal contract analysis platform designed to process, understand, and query complex legal documents.

ClauseNexa enables users to upload legal contracts and interact with them using natural language. The system is designed to process large PDF documents asynchronously, convert relevant document content into embeddings, and use a Retrieval-Augmented Generation (RAG) pipeline to provide contextual AI-powered answers with clause and page references.

> **Project Status: 🚧 Active Development**

---

## 📌 Problem Statement

Legal contracts can contain hundreds of pages of complex clauses, obligations, liabilities, and conditions. Manually reviewing these documents is time-consuming and inefficient.

Processing large documents also introduces engineering challenges:

- Large PDF processing can take significant time.
- Synchronous processing can block application resources.
- Multiple documents may need to be processed simultaneously.
- AI models require relevant context instead of an entire document.
- Large AI requests can introduce latency and reliability issues.

ClauseNexa is designed to address these challenges using asynchronous document processing, vector search, and a RAG-based AI pipeline.

---

## 🎯 Project Goals

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

Background processing:

```text
BullMQ
   ↓
Document Processing Service
   ↓
Fetch Original PDF
   ↓
Extract Text
   ↓
Clean Text
   ↓
Chunk Document
   ↓
Generate Embeddings
   ↓
Store in Vector Database
   ↓
Update Processing State
```

## 🤖 AI Contract Q&A

```text
User Prompt + Contract ID
          ↓
       Core API
          ↓
    RAG / AI Service
          │
          ├── Validate Query
          ├── Retrieve Contract / Chat Context
          ├── Generate Query Embedding
          ├── Search Relevant Document Chunks
          ├── Apply Contract / Version Filters
          └── Build Contextual Prompt
                    ↓
                LLM Provider
                    ↓
                AI Response
                    ↓
                 Core API
                    ↓
                 Frontend
```

The AI response may include contextual answers, relevant contract information, clause references, page references, and retrieved source information.

---

# 🧠 Key Architectural Decisions

### 1. Asynchronous Document Processing

Large documents are processed through background jobs instead of blocking the Core API request lifecycle.

```text
Core API
   ↓
BullMQ
   ↓
Worker
```

The upload endpoint can immediately return `202 Accepted` while processing continues in the background.

### 2. Lightweight Queue Jobs

Large PDF files are not stored inside Redis.

```text
PDF → Object Storage

Document Reference + Job Metadata → BullMQ
```

Queue jobs contain lightweight information such as:

- Contract ID
- Document storage reference
- Job type
- Processing metadata

### 3. RAG Service Owns AI Context Construction

The Core API provides the RAG service with the required contract/query boundary.

The RAG / AI Service is responsible for retrieving:

- Contract context
- Bounded conversation history
- Relevant document chunks
- Active document / processing version context

It then constructs the final prompt sent to the LLM.

### 4. Controlled Service Data Access

| Service | MongoDB | Object Storage | Redis/BullMQ | Vector DB |
|---|---|---|---|---|
| Core API | Read / Write | Read / Write | Read / Write | — |
| Document Processing | Read / Write* | Read | Consume Jobs | Read / Write |
| RAG / AI Pipeline | Read | — | — | Read |

*Required processing state is persisted back to MongoDB.

### 5. MongoDB Is the Source of Truth

The vector database contains derived search data. Original documents and permanent application state remain outside the vector database, allowing vector data to be regenerated when necessary.

### 6. Document and Processing Versioning

Each uploaded file is represented as a document version, while processing versions allow the system to distinguish the currently active searchable representation from previous processing results.

---

# 🛠️ Technology Stack

## Core API — Implemented

- Node.js
- Express.js
- JavaScript (ES Modules)
- MongoDB
- Mongoose
- JWT
- bcrypt
- express-validator
- Nodemailer
- Mailgen
- Jest
- Prettier

## Planned / Upcoming Infrastructure

- Redis
- BullMQ
- Object Storage
- PDF processing
- Embedding model
- Vector Database
- LLM Provider
- Docker
- Reverse Proxy / Load Balancer
- Cloud Deployment

## Frontend — Planned

- React
- TypeScript
- Tailwind CSS

---

# 🔐 Core API

The Core API is the primary application backend responsible for authentication, authorization, user-facing API operations, metadata management, and coordination with asynchronous processing services.

## Authentication

The authentication module currently supports:

- User registration
- Email verification
- Login
- JWT access-token authentication
- Refresh-token rotation
- Logout and refresh-token invalidation
- Resend verification email
- Forgot-password flow
- Password reset
- Change password
- Protected routes
- Request validation
- Secure temporary token hashing
- Password hashing with bcrypt

## Authentication Security

- Access and refresh tokens are stored in HttpOnly cookies.
- Refresh tokens are stored server-side in hashed form.
- Refresh tokens are rotated during refresh.
- Temporary email-verification and password-reset tokens are hashed before storage.
- Passwords are hashed with bcrypt.
- Protected routes validate the access token and load the authenticated user.
- Sensitive token/password fields are excluded from user responses.

## Testing

Authentication includes Jest unit tests covering the user model, JWT generation, temporary tokens, authentication middleware, registration, login, email verification, refresh-token rotation, logout, resend verification, forgot password, reset password, and change password.

Current test result:

```text
Test Suites: 3 passed, 3 total
Tests:       46 passed, 46 total
```

Postman smoke testing is also used for API-level verification.

---

# 📁 Project Structure

```text
ClauseNexa/
│
├── backend/
│   ├── core-api/
│   │   ├── src/
│   │   ├── tests/
│   │   ├── package.json
│   │   └── ...
│   │
│   ├── document-processing/
│   │
│   └── rag-service/
│
├── docs/
│   ├── architecture/
│   └── diagrams/
│
├── client/
│
├── README.md
└── .gitignore
```

The project structure will evolve as additional services are implemented.

---

# 📚 Architecture Documentation

Architecture is designed before implementation.

Current documentation includes:

- High-Level Design
- Service Communication & Data Flow
- Service-Level Architecture
- Core API Low-Level Design
- Document Processing Low-Level Design
- Data Modeling
- RAG / AI Low-Level Design
- Overall Low-Level Design

Architecture documentation is available under [`docs/`](./docs/).

---

# 🗺️ Development Roadmap

## Phase 1 — System Design & Architecture

- [x] Project problem definition
- [x] Functional requirements
- [x] User capabilities design
- [x] Data flow design
- [x] High-Level Design
- [x] Service communication design
- [x] Service data-access boundaries
- [x] Low-Level Design

## Phase 2 — Project Foundation

- [x] Repository setup
- [x] Development environment setup
- [x] Core API service setup
- [x] Database configuration
- [x] Docker environment setup

## Phase 3 — Core Application

- [x] Authentication and authorization
- [ ] User management
- [ ] Contract management
- [ ] Document upload
- [ ] Job management

## Phase 4 — Document Processing

- [ ] Redis setup
- [ ] BullMQ queue
- [ ] Background workers
- [ ] PDF text extraction
- [ ] Text cleaning
- [ ] Document chunking
- [ ] Embedding generation
- [ ] Vector database integration
- [ ] Processing state management
- [ ] Document reprocessing

## Phase 5 — RAG & AI

- [ ] Query embedding
- [ ] Context retrieval
- [ ] Contract-aware AI queries
- [ ] Prompt construction
- [ ] LLM integration
- [ ] Source / citation handling
- [ ] Conversation history

## Phase 6 — Production Engineering

- [ ] Centralized error handling improvements
- [ ] Retry mechanisms
- [ ] Circuit breakers
- [ ] Rate limiting
- [ ] Structured logging
- [ ] Monitoring
- [ ] Integration testing
- [ ] Containerization
- [ ] Deployment
- [ ] Production hardening

---

# 📊 Current Project Status

| Component | Status |
|---|---|
| System Architecture | ✅ Completed |
| Overall LLD | ✅ Completed |
| Core API Foundation | ✅ Completed |
| Authentication | ✅ Completed |
| User Management | 🚧 Next |
| Contract Management | ⏳ Planned |
| Document Upload | ⏳ Planned |
| Document Processing | ⏳ Planned |
| RAG / AI Pipeline | ⏳ Planned |
| Frontend | ⏳ Planned |
| Production Engineering | ⏳ Planned |

---

# 🎓 Learning Objectives

ClauseNexa is being built as a production-oriented engineering project with a focus on:

- Backend architecture
- Authentication and authorization
- Asynchronous processing
- Distributed system concepts
- Queue-based workloads
- Background workers
- AI integration
- Retrieval-Augmented Generation
- Vector databases
- Service boundaries
- Data ownership
- System scalability
- Fault tolerance
- Production reliability
- Testing and code quality

---

# 📄 License

This project is currently being developed for educational and portfolio purposes.

---

# 👨‍💻 Author

**Ayush Narayan Gupta**

Built as part of the **Zero to FAANG** engineering journey.