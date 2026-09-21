# ClauseNexa — Data Model

## 1. Purpose

This document defines the finalized V1 data model for ClauseNexa, an automated legal contract auditor.

The model follows three DBMS-style design steps:
1. Identify entities
2. Identify attributes
3. Establish relationships and constraints

MongoDB is the source of truth for permanent application state. Original PDFs are stored in Object Storage, background jobs in Redis/BullMQ, and searchable chunks/embeddings in the Vector DB.

## 2. Storage Overview

| Data | Storage | Responsibility |
|---|---|---|
| Users | MongoDB | Authentication and user state |
| Contracts | MongoDB | Logical legal contracts |
| Documents | MongoDB | File metadata and processing state |
| Conversations | MongoDB | AI conversation metadata |
| Messages | MongoDB | Persistent chat messages |
| Original PDFs | Object Storage | Source files |
| Processing Jobs | Redis/BullMQ | Temporary background job state |
| Chunks + Embeddings | Vector DB | Derived searchable representation |

## 3. MongoDB Entities

### 3.1 User

```text
users [icon: user, color: blue] {

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

V1 supports one active refresh-token state per user. Refresh, email-verification, and password-reset tokens are stored as hashes with expiry timestamps. Raw tokens are never persisted.

### 3.2 Contract

```text
contracts [icon: file-text, color: blue] {

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

`status`: `draft | active | archived`.

`contractType` is intentionally excluded from V1 and can be added later.

### 3.3 Document

```text
documents [icon: file, color: orange] {

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

The PDF itself is stored in Object Storage. MongoDB stores its metadata and `storageKey`.

`processingStatus`: `queued | processing | completed | failed`.

`processingStage`: `queued | extracting | chunking | embedding | storing_vectors | completed`.

`processingProgress` ranges from `0` to `100`.

`processingVersion` represents the latest processing version/attempt. `activeProcessingVersion` represents the processing version currently used by RAG. During reprocessing, V2 can be processed while V1 remains active.

### 3.4 Conversation

```text
conversations [icon: message-circle, color: green] {

  id string pk

  userId string
  contractId string

  title string

  createdAt timestamp
  updatedAt timestamp
}
```

A conversation is contract-specific in V1.

### 3.5 Message

```text
messages [icon: messages-square, color: green] {

  id string pk

  conversationId string

  role string
  content string

  sources json

  createdAt timestamp
}
```

`role`: `user | assistant`.

`sources` is optional and stores references/metadata for contract chunks used by an assistant response. It does not duplicate vector data.

Messages are effectively immutable in V1, so `updatedAt` is not required.

## 4. Relationships

```text
users.id < contracts.userId

contracts.id < documents.contractId

users.id < documents.userId

contracts.activeDocumentId > documents.id

users.id < conversations.userId

contracts.id < conversations.contractId

conversations.id < messages.conversationId
```

### Cardinality

```text
User          1 : N  Contract
Contract      1 : N  Document
Contract      0 : 1  Active Document
User          1 : N  Conversation
Contract      1 : N  Conversation
Conversation  1 : N  Message
```

A user may have zero or more contracts and conversations. A contract may temporarily have zero documents. A conversation may temporarily have zero messages.

## 5. Core Constraints

### Ownership

```text
Contract.userId → existing User
Document.contractId → existing Contract
Conversation.contractId → existing Contract
Conversation.userId → existing User
```

Consistency rules:

```text
Document.userId == Contract.userId
Conversation.userId == Contract.userId
```

These are primarily application-level constraints because MongoDB does not provide traditional relational foreign-key enforcement.

### Active Document

If `Contract.activeDocumentId` exists, it must reference an existing Document belonging to that same Contract.

### Processing State

```text
0 <= processingProgress <= 100
activeProcessingVersion <= processingVersion
```

When processing succeeds:

```text
processingStatus = completed
processingProgress = 100
activeProcessingVersion = processingVersion
```

When processing fails:

```text
processingStatus = failed
processingError exists
```

### Authentication

`email` is unique. Passwords and tokens are never stored in plaintext.

### Message Sources

For an assistant message, every persisted source must correspond to a chunk actually retrieved during that RAG request. The LLM cannot introduce arbitrary source IDs. The actual chunk/vector representation remains in the Vector DB.

## 6. Deletion Strategy

Deletion is handled as an application workflow rather than MongoDB foreign-key cascades.

### Delete Contract

```text
Delete Contract
      ↓
Delete associated Documents
      ↓
Delete original PDFs from Object Storage
      ↓
Delete document vectors from Vector DB
      ↓
Delete Conversations
      ↓
Delete Messages
```

### Delete User

```text
Delete User
      ↓
Delete Contracts and associated Documents
      ↓
Delete Object Storage files
      ↓
Delete Vector DB records
      ↓
Delete Conversations
      ↓
Delete Messages
```

The Core API owns the application-level deletion workflow.

## 7. V1 Design Decisions

- **No separate Session entity:** one active refresh-token state per user.
- **No explicit Document Version entity:** each uploaded file is a separate Document.
- **No Processing Record entity:** permanent processing state stays on Document; BullMQ owns temporary job state.
- **No Contract Type:** `contractType` is deferred until a concrete V1 requirement exists.
- **Messages are separate documents:** they are not embedded inside Conversation to avoid unbounded document growth.
- **Advanced retrieval data stays outside MongoDB:** embeddings and searchable vector records belong to the Vector DB.

## 8. Final MongoDB Schema Overview

```text
MongoDB
│
├── users
│
├── contracts
│     └── activeDocumentId → documents
│
├── documents
│
├── conversations
│
└── messages
```

Relationships:

```text
User
 │
 ├──────── 1:N ────────> Contract
 │                         │
 │                         └──── 1:N ────> Document
 │
 └──────── 1:N ────────> Conversation
                            │
                            └──── 1:N ────> Message

Contract ───── 0:1 ────> Active Document
```

## 9. Storage Boundary

```text
                         ClauseNexa
                             │
             ┌───────────────┼───────────────┐
             │               │               │
          MongoDB      Object Storage    Redis/BullMQ
             │               │               │
       Permanent State   Original PDFs    Processing Jobs
             │
             └───────────────┐
                             │
                         Vector DB
                             │
                     Chunks + Embeddings
```

### Source of truth

```text
MongoDB       → Permanent application state
Object Store  → Original PDF files
Redis/BullMQ  → Temporary processing jobs
Vector DB     → Derived search index
```

## 10. V1 Completion Status

The conceptual data model is finalized:

```text
Entity identification       ✅
Attribute identification    ✅
Relationships               ✅
Cardinality                 ✅
Constraints                 ✅
Storage boundaries          ✅
V1 scope decisions          ✅
```

Mongoose implementation details, indexes, validators, repositories, and database configuration belong to the implementation phase.
