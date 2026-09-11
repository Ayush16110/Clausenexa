# ClauseNexa — Document Processing Service LLD

## 1. Purpose

The Document Processing Service converts an uploaded legal PDF into structured, searchable vector representations that can later be retrieved by the RAG/AI service.

```text
Original PDF → Text Extraction → Text Preparation → Chunking → Embeddings → Vector DB
```

The service is worker-oriented and processes documents asynchronously through BullMQ.

## 2. Responsibilities

### Owns
- Consume document-processing jobs from BullMQ.
- Fetch the original PDF from Object Storage.
- Validate and parse the PDF.
- Extract text page-by-page.
- Normalize extracted text without changing legal meaning.
- Split prepared text into meaningful chunks.
- Generate embeddings in batches.
- Store/update vectors in the Vector DB.
- Report processing progress.
- Update permanent document processing state in MongoDB.
- Handle retries and failures.
- Ensure reprocessing is idempotent.

### Does NOT own
- Authentication/authorization.
- Contract CRUD.
- User-facing HTTP APIs.
- Original PDF persistence.
- LLM reasoning or legal analysis.
- User-question retrieval.
- Chat history.
- RAG prompt construction.

## 3. Service Architecture

```text
                         BullMQ / Redis
                              │
                    PROCESS_DOCUMENT job
                              │
                ┌─────────────┴─────────────┐
                │      Document Worker      │
                │                           │
                │  Document Fetcher         │
                │  PDF Processor            │
                │  Text Processor           │
                │  Chunker                  │
                │  Embedding Generator      │
                │  Vector Repository        │
                └──────┬──────┬──────┬──────┘
                       │      │      │
                       ↓      ↓      ↓
                  Object    MongoDB  Embedding
                  Storage            Provider
                                      │
                                      ↓
                                  Vector DB
```

Multiple worker instances consume the same queue for horizontal scalability.

## 4. Entry Point

There is no normal user-facing HTTP entry point.

The primary entry point is a BullMQ Worker:

```text
BullMQ Queue → Worker → processDocument(job)
```

One BullMQ job represents one document-processing operation in V1.

## 5. Job Contract

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

Rules:
- PDF binary is never stored in Redis/BullMQ.
- `storageKey` is included directly in the job payload.
- Required fields are validated before processing.
- Invalid payloads are non-retryable failures.
- MongoDB remains the source of truth for permanent document state.

## 6. Dependencies

| Dependency | Access | Purpose |
|---|---|---|
| BullMQ / Redis | Read / update | Consume jobs and report progress |
| Object Storage | Read | Fetch original PDF |
| MongoDB | Read / update | Metadata and permanent processing state |
| Embedding Provider | Request | Generate embeddings |
| Vector DB | Write / update / delete | Store searchable vectors |

## 7. Worker Lifecycle

```text
Worker starts
 ↓
Connect to dependencies
 ↓
Listen to BullMQ
 ↓
Receive job
 ↓
Validate payload
 ↓
Fetch PDF
 ↓
Validate / parse
 ↓
Extract text
 ↓
Prepare text
 ↓
Create chunks
 ↓
Generate embeddings
 ↓
Store vectors
 ↓
Finalize MongoDB state
 ↓
Complete job
```

Any unrecoverable processing error transitions the document to `failed`.

## 8. Processing State

Permanent processing state is stored in MongoDB.

```text
queued → processing → extracting → chunking → embedding
                                             ↓
                                      storing_vectors
                                             ↓
                                         completed

Any processing stage → failed
```

BullMQ state is temporary operational state, not the permanent source of truth.

Completed/failed BullMQ jobs should be retained only for a limited operational/debugging period and then automatically removed.

## 9. Progress Reporting

Stages:

```text
queued
processing
extracting
chunking
embedding
storing_vectors
completed
failed
```

Progress is informational. A progress-update failure must not fail the entire document processing operation.

Updates can occur periodically or per batch rather than after every chunk.

## 10. PDF Fetching and Validation

The worker fetches the PDF using the `storageKey`.

Core API/upload middleware performs basic validation:
- File exists.
- Multipart upload succeeded.
- MIME type is acceptable.
- File size is within limits.

Document Processing performs deep validation:
- PDF can be parsed.
- PDF is readable.
- Extracted content is usable.

Failure behavior:

| Failure | Behavior |
|---|---|
| Temporary Object Storage outage | Retry |
| Storage timeout/network failure | Retry |
| File missing | Fail; user should re-upload |
| Persistent access failure | Fail |
| Unsupported format | Fail; request valid PDF |
| Corrupt/unreadable PDF | Fail; request re-upload |

Technical details remain in internal logs; user-facing errors remain safe and actionable.

## 11. Text Extraction

Text is extracted page-by-page.

```json
{
  "pages": [
    {"pageNumber": 1, "text": "This Agreement..."},
    {"pageNumber": 2, "text": "Section 1..."}
  ]
}
```

Preserve:
- Page boundaries.
- Paragraphs.
- Headings.
- Section/clause numbering.
- Text order.
- Useful structural signals.

### OCR

OCR is excluded from MVP.

```text
PDF → Normal extraction → usable? yes → continue
                         → no → fail/re-upload
```

Scanned/image-only PDFs therefore fail in MVP. OCR is deferred to V1.5/V2.

## 12. Text Preparation

Goal:

> Normalize extraction artifacts while preserving original legal meaning.

Perform:
- Whitespace normalization.
- Tab/blank-line normalization.
- Obvious broken-line repair.
- Obvious encoding-artifact cleanup.
- Confident repeated-header/footer removal.
- Preservation of page boundaries as metadata.
- Preservation of legal structure.

Do NOT:
- Summarize.
- Paraphrase.
- Correct legal grammar.
- Semantically rewrite.
- Remove legal terminology.
- Remove numbers, dates, monetary values, clause identifiers, or negations.

Core principle:

> Text preparation may clean representation, but must never change legal meaning.

## 13. Chunking Strategy

Use **semantic-first, target-sized, overlapping chunks**.

Target: approximately **500 tokens**, configurable and not an exact fixed size.

Boundary priority:

```text
Section / Clause
      ↓
Paragraph
      ↓
Sentence
      ↓
Token boundary
```

Keep meaningful legal units together whenever possible.

If a clause is too large:

```text
Clause → Paragraphs → Sentences → Token boundary
```

Use approximately **10–15% overlap** initially. For a ~500-token target, this is roughly 50–75 tokens.

Overlap should not blindly duplicate large semantic units.

## 14. Chunk Metadata

Conceptual representation:

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

Preserve section/clause identity where available, including when one clause spans multiple chunks.

This enables later citations such as Section 7.2, pages 42–43.

## 15. Embedding Strategy

Only final chunk text is embedded.

Metadata is stored alongside the vector but is not independently embedded.

Use batched embedding requests:

```text
Chunks → Batch 1 → Embedding API
       → Batch 2 → Embedding API
       → Batch 3 → Embedding API
```

Exact batch size is configurable according to provider limits.

Retry transient failures:
- Timeout.
- Network failure.
- Temporary 5xx.
- Rate limit.

Use bounded retries with exponential backoff.

Do not endlessly retry permanent failures:
- Invalid request.
- Invalid model configuration.
- Authentication/configuration failure.
- Unsupported input.
- Invalid vector configuration.

Store:
- Embedding model/version.
- Embedding dimension.
- Processing version.

Exact provider/model is implementation-specific.

## 16. Vector DB Design

Vector DB is a searchable index, not the source of truth.

Conceptual record:

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

RAG retrieval can filter by:
- `userId`
- `contractId`
- active `processingVersion`

Metadata filtering is defense-in-depth and does not replace Core API authorization.

V1 uses one logical collection/index with metadata filtering rather than separate collections per user.

Abstract behind:

```text
VectorRepository
├── upsert()
├── search()
├── deleteByDocument()
└── deleteByProcessingVersion()
```

The specific Vector DB technology is not locked by this LLD.

## 17. Idempotency

Use deterministic vector IDs:

```text
documentId:processingVersion:chunkIndex
```

Example:

```text
doc_123:v1:chunk_42
```

First processing and retries both use `upsert` against the same logical ID.

Therefore:

> Duplicate execution is acceptable; uncontrolled duplicate data is not.

## 18. Reprocessing Strategy

If processing configuration changes:

```text
V1 → 1000 chunks
V2 → 800 chunks
```

Do not modify the active version in-place.

```text
Create V2
 ↓
Process V2
 ↓
Generate V2 vectors
 ↓
Verify completion
 ↓
Mark V2 active
 ↓
Remove old V1 vectors
```

An incomplete version is never treated as active.

## 19. Partial Vector Writes

Example:

```text
Chunks 1–700 → stored
Chunks 701–1000 → failure
```

Do not mark the document completed.

On retry:
- Existing vectors are safely upserted.
- Missing vectors are created.
- Deterministic IDs prevent uncontrolled duplication.

## 20. Failure and Retry Policy

### Retryable
- Object Storage timeout/outage.
- Embedding timeout.
- Embedding rate limit.
- Embedding 5xx.
- Vector DB temporary outage.
- Transient network/infrastructure errors.

### Non-retryable
- Invalid job payload.
- Missing document.
- Unsupported file.
- Corrupt/unreadable PDF.
- No usable text in MVP.
- Invalid embedding configuration.
- Invalid vector dimension.
- Permanent authentication/configuration failure.

Retries are bounded and use exponential backoff.

## 21. Distributed Consistency

### Vector DB succeeds, MongoDB final update fails

Retry the final MongoDB update. No re-embedding is required because vector writes are idempotent.

### MongoDB says failed but partial vectors exist

Partial vectors belong to a specific processing version and are not active. Retry can safely upsert them; abandoned versions can be cleaned up.

### Progress update fails

Continue processing because progress is informational.

### Worker crashes

BullMQ can make unfinished work available to another worker according to its lock/recovery behavior. Correctness does not depend on in-memory worker state.

## 22. Deletion

When a document is deleted:

```text
Document deletion workflow
        ↓
Vector DB
        ↓
Delete vectors for document
```

Vector DB does not independently decide document ownership or deletion.

Original PDF and permanent metadata are handled by their respective owners.

## 23. Internal Module Structure

```text
document-processing/
├── worker/
│   └── processDocument.worker.ts
├── fetcher/
│   └── documentFetcher.ts
├── pdf/
│   └── pdfProcessor.ts
├── text/
│   └── textProcessor.ts
├── chunking/
│   └── chunker.ts
├── embeddings/
│   └── embeddingGenerator.ts
├── vector/
│   └── vectorRepository.ts
├── validators/
│   └── job.validator.ts
├── config/
├── utils/
└── logs/
```

Exact folder names can evolve during implementation; architectural boundaries matter more than naming.

## 24. End-to-End Failure-Safe Pipeline

```text
                 BullMQ Job
                     │
                     ↓
              Validate Payload
                     │
                     ↓
              Fetch PDF
                     │
                     ↓
              Validate / Parse
                     │
                     ↓
              Extract Text
                     │
                     ↓
              Prepare Text
                     │
                     ↓
                 Chunking
                     │
                     ↓
             Batch Embeddings
                     │
                     ↓
              Upsert Vectors
                     │
                     ↓
          Finalize MongoDB State
                     │
                     ↓
                 COMPLETED
```

At every stage:

```text
Transient failure → bounded retry
Permanent failure → failed
Worker crash → safe re-execution
Retry → deterministic/idempotent writes
```

## 25. Key Engineering Decisions

1. Document processing is asynchronous.
2. One BullMQ job represents one document-processing operation in V1.
3. PDF binary never enters Redis/BullMQ.
4. `storageKey` is carried in the job payload.
5. Text extraction is page-aware.
6. OCR is excluded from MVP.
7. Text preparation preserves legal meaning.
8. Chunking is semantic-first rather than blindly fixed-size.
9. Chunk target is approximately 500 tokens.
10. Chunk overlap is approximately 10–15%.
11. Chunk metadata preserves page and clause/section context.
12. Embeddings are generated in batches.
13. Transient external failures are retried with exponential backoff.
14. Permanent failures are not endlessly retried.
15. Vector IDs are deterministic.
16. Processing versions isolate reprocessing.
17. MongoDB stores permanent processing state.
18. BullMQ stores temporary execution state.
19. Vector DB stores searchable representations, not source-of-truth application state.
20. Vector DB is abstracted behind a repository interface.
21. Duplicate execution is acceptable; uncontrolled duplicate data is not.
22. OCR, advanced deduplication, and sophisticated distributed coordination are deferred.

## 26. Final Service Boundary

```text
                    CLAUSENEXA
                         │
        ┌────────────────┴────────────────┐
        │                                 │
     Core API                     Document Processing
        │                                 │
        │ BullMQ Job                      │
        └────────────────────────────────>│
                                          │
                                          ├── Object Storage
                                          ├── MongoDB
                                          ├── Embedding Provider
                                          └── Vector DB
```

Document Processing is an independent asynchronous processing service whose responsibility is transforming the original legal document into a reliable, versioned, searchable vector representation for downstream RAG.
