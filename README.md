# Knowledge Base RAG API

A Node.js REST API that powers a conversational knowledge base using Retrieval-Augmented Generation (RAG). It ingests PDF, DOCX, and text documents, stores them as vector embeddings, and answers user queries with context-grounded responses — maintaining conversation history across turns within a session.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Running with Docker](#running-with-docker)
- [API Reference](#api-reference)
- [Architectural Decisions](#architectural-decisions)
- [Known Limitations & Production Improvements](#known-limitations--production-improvements)

---

## Getting Started

### Prerequisites

- Node.js 22+
- Docker & Docker Compose
- An OpenAI API key

### Install dependencies

```bash
npm install --legacy-peer-deps
```

---

## Environment Variables

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-...
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=knowledge_base
PORT=3000
NODE_ENV=development
```

---

## Running Locally

### Start Qdrant

```bash
docker compose up qdrant -d
```

This spins up Qdrant on `http://localhost:6333`. A web dashboard is available at `http://localhost:6333/dashboard` where you can browse ingested vectors and inspect payloads.

### Start the API server

```bash
npm run dev
```

The server starts on `http://localhost:3000` with hot-reload enabled.

---

## Running with Docker

The entire application stack can be run with Docker Compose:

```bash
docker compose up -d
```

This starts both Qdrant and the Node.js API in containers on a shared network. The API automatically connects to Qdrant using the service name `qdrant:6333`.

**Access:**
- API: `http://localhost:3000`
- Qdrant Dashboard: `http://localhost:6333/dashboard`

**View logs:**
```bash
docker compose logs -f app
```

**Stop all services:**
```bash
docker compose down
```

**Remove volumes (deletes all data):**
```bash
docker compose down -v
```

---

## API Reference

### `POST /api/rag/ingest`

Accepts a single `.pdf`, `.docx`, or `.txt` file, chunks it, generates embeddings, and stores them in Qdrant.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | A single `.pdf`, `.docx`, or `.txt` file (max 10MB) |

**Response:**

```json
{
  "message": "File processed and embeddings created successfully",
  "file": {
    "name": "getting-started.txt",
    "type": "text/plain",
    "size": 15420,
    "chunksCount": 12,
    "embeddingsCount": 12,
    "sampleChunk": "To get started with DataGroomr..."
  }
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/rag/ingest \
  -F "file=@docs/getting-started.txt"
```

---

### `POST /api/rag/chat`

Accepts a user question and an optional session ID. Retrieves the most relevant chunks, assembles them as context, and returns an LLM-generated answer with source references.

**Request:** `application/json`

| Field | Type | Description |
|-------|------|-------------|
| question | string | The user's question (1-1000 characters) |
| sessionId | string (optional) | UUID of existing session; omit to create new session |

**Response:**

```json
{
  "sessionId": "abc-123-def-456",
  "isNewSession": false,
  "question": "How do I access DataGroomr from Salesforce?",
  "answer": "You can access DataGroomr directly from Salesforce by opening the App Launcher and searching for DataGroomr [1].",
  "sources": [
    {
      "text": "To access DataGroomr from within Salesforce...",
      "source": "/tmp/how-to-access.pdf",
      "page": 1,
      "score": 0.9124
    }
  ]
}
```

**Example (new conversation):**

```bash
curl -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I access DataGroomr from Salesforce?"}'
```

**Example (continuing conversation):**

```bash
curl -X POST http://localhost:3000/api/rag/chat \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What if my org uses SSO?",
    "sessionId": "abc-123-def-456"
  }'
```

---

### `GET /api/rag/session/:sessionId`

Retrieves the complete conversation history for a given session.

**Response:**

```json
{
  "sessionId": "abc-123-def-456",
  "messageCount": 4,
  "conversation": [
    {
      "role": "user",
      "content": "How do I access DataGroomr?",
      "timestamp": "2026-03-05T18:30:00.000Z"
    },
    {
      "role": "assistant",
      "content": "You can access DataGroomr by...",
      "timestamp": "2026-03-05T18:30:02.000Z"
    }
  ]
}
```

**Example:**

```bash
curl http://localhost:3000/api/rag/session/abc-123-def-456
```

---

### `DELETE /api/rag/knowledge-base`

Clears the entire knowledge base by deleting and recreating the Qdrant collection. All ingested documents and their embeddings will be permanently removed.

**Response:**

```json
{
  "success": true,
  "message": "Knowledge base cleared successfully. Collection has been reset."
}
```

**Example:**

```bash
curl -X DELETE http://localhost:3000/api/rag/knowledge-base
```

**Warning:** This operation is destructive and cannot be undone. All vectors and metadata will be permanently deleted.

---

## Architectural Decisions

### Framework — Express.js

Express was chosen for its maturity, extensive middleware ecosystem, and widespread adoption. While newer frameworks like Fastify offer performance advantages, Express provides a stable foundation with well-understood patterns and extensive community support. For a production RAG API, the bottleneck is typically LLM inference and vector search rather than the web framework itself.

The application uses a clean separation of concerns with dedicated directories for routes, controllers, services, middlewares, and utilities. The `catchAsync` utility wraps all async route handlers, eliminating repetitive try-catch blocks and forwarding errors to a centralized error handler.

---

### Input Validation — Express-validator

All API endpoints use `express-validator` for request validation. Validation rules are defined as middleware arrays in `middlewares/validation.middleware.js` and applied at the route level. This ensures malformed requests are rejected before reaching business logic, with consistent error responses across all endpoints.

For file uploads, `multer` enforces file type restrictions (PDF, DOCX, TXT only) and size limits (10MB) at the middleware layer. Invalid files are rejected immediately with clear error messages.

---

### Vector Database — Qdrant

Qdrant was selected for its ease of setup (single Docker container), excellent JavaScript client support, and payload metadata capabilities. The entire vector store can be spun up with `docker compose up qdrant` with no cloud accounts or API keys required beyond OpenAI.

Each stored vector includes a rich metadata payload — `text` (the chunk content), `source` (filename), `page` (for PDFs), and `type` (MIME type). This metadata is returned alongside similarity scores during retrieval, enabling accurate source citations without additional database lookups.

The Qdrant service layer (`services/qdrant.service.js`) handles collection initialization automatically on server startup, creates the collection if it doesn't exist, and provides clean abstractions for upserting vectors and performing similarity searches.

Alternative options like Pinecone require cloud accounts and API keys (friction for local development), while ChromaDB's JavaScript client is community-maintained and lags behind its Python counterpart in features and stability.

---

### Embedding Model — `text-embedding-3-small`

OpenAI's `text-embedding-3-small` produces 1536-dimensional vectors and strikes an optimal balance between quality, speed, and cost. Critically, the same model is used for both document ingestion and query embedding — embedding asymmetry (using different models for indexing vs. querying) severely degrades retrieval quality.

Embeddings are generated via the OpenAI service layer (`services/embedding.service.js`), which wraps the OpenAI client with proper error handling and retry logic.

---

### Document Processing — LangChain

Document chunking and text extraction is handled by LangChain's document loaders and text splitters:

- **PDFLoader** (`@langchain/community/document_loaders/fs/pdf`) — Extracts text from PDFs page-by-page, preserving page numbers in chunk metadata
- **Mammoth** (for `.docx` files) — Converts Word documents to plain text while maintaining structure
- **TextLoader** (manual implementation) — Handles plain text files directly

The **RecursiveCharacterTextSplitter** splits documents using a hierarchy of natural language boundaries:
1. Paragraphs (`\n\n`)
2. Lines (`\n`)
3. Sentences (`. `)
4. Words (` `)
5. Characters (as last resort)

This ensures chunks are semantically coherent. Chunk size is set to **600 characters** with **120 characters of overlap (20%)**, preserving context at boundaries without excessive redundancy.

Fixed-size splitting was explicitly rejected because it cuts mid-sentence without regard for meaning, producing embeddings that don't accurately represent content.

---

### LLM — `gpt-4o-mini`

`gpt-4o-mini` was chosen for chat completions. It is fast, cost-effective, and more than capable for retrieval-augmented question answering where the model primarily synthesizes provided context rather than relying on parametric knowledge.

The system prompt (`constants/prompts.js`) explicitly restricts the model to retrieved context and instructs it to acknowledge when information is insufficient. This is critical for a support use case where a confident wrong answer is worse than no answer.

The chat service (`services/chat.service.js`) constructs the message array with:
1. **System prompt** — Defines behavior and constraints
2. **Conversation history** — Full session history for multi-turn context
3. **User message with context** — Current question + retrieved chunks formatted with source citations

Temperature is set to 0.7 for a balance between creativity and consistency.

---

### Session Management — In-Memory Map

Conversation history is stored in a JavaScript `Map` keyed by session ID (`services/session.service.js`). Each entry holds an ordered array of `{role, content, timestamp}` message objects.

When no session ID is provided, a new UUIDv4 is generated and returned to the client. On subsequent requests with that ID, the full history is passed to the LLM to maintain conversational context.

This is intentionally simple and sufficient for a prototype. The storage layer is cleanly abstracted — migrating to Redis would require changing only the session service implementation without touching controllers or routes.

---

### Source References

Source citations are extracted directly from Qdrant chunk metadata rather than generated by the LLM. This is a deliberate choice — LLMs hallucinate plausible-sounding filenames or page numbers when instructed to cite sources themselves.

The system prompt uses numbered inline citations (`[1]`, `[2]`) that map to the ordered context chunks. The API response includes the full source list with filename, page number, similarity score, and a text preview.

---

### Error Handling & Observability

All async route handlers are wrapped with the `catchAsync` utility (`utils/catchAsync.js`), which forwards errors to a centralized error handler (`middlewares/errorHandler.middleware.js`). This eliminates repetitive try-catch blocks and ensures consistent error responses.

The error handler provides:
- Specific handling for multer file upload errors (size limits, invalid types)
- Stack traces in development mode
- Clean, structured error responses

In a production system, this would be extended with structured logging (Winston/Pino), distributed tracing (OpenTelemetry), and metrics collection (Prometheus) to track embedding latency, retrieval quality, and LLM response times.

---

## Known Limitations & Production Improvements

### Session Persistence

Sessions are stored in memory and lost on restart. In production, Redis would replace the Map with fast key-value storage, configurable TTL for automatic expiration, and persistence across deployments. The interface is identical — only the storage layer changes.

### Duplicate Ingestion

Re-ingesting the same file appends new vectors without removing old ones, causing duplication and degraded retrieval. The fix is a `deleteBySource()` call before ingestion (Qdrant supports filtering deletes by payload). A proper system would hash file contents on upload and skip re-ingestion if the hash matches stored data.

### Chunking Token Accuracy

Chunk size uses a fixed 4-characters-per-token approximation, accurate for English prose but inaccurate for code or non-Latin scripts. Production systems should use `tiktoken` (OpenAI's tokenizer) for precise token counting before splitting.

### Embedding Batching and Rate Limits

The current implementation embeds chunks sequentially with no batching or retry logic. Production systems should:
- Batch embeddings in groups of 100 (OpenAI's limit)
- Implement exponential backoff on rate limit errors (429)
- Use a job queue (BullMQ + Redis) for async ingestion at scale

### Authentication

Neither endpoint has authentication. In production, `/ingest` must be protected — it writes to the vector store and could be abused. At minimum, API key validation middleware would be appropriate. For enterprise deployment, OAuth 2.0 or JWT-based authentication would be standard.

### Retrieval Quality — Reranking

Retrieval returns the top 5 chunks by cosine similarity. This works for straightforward queries but struggles with keyword-heavy or ambiguous questions. A cross-encoder reranker (Cohere Rerank, ColBERT) as a second pass over the top 20 candidates would meaningfully improve answer quality, especially across large, diverse document corpora.

### Horizontal Scalability

The current architecture is a single Node.js process with in-memory sessions. For production scale:
- Separate ingestion into async worker queues (BullMQ + Redis)
- Run multiple stateless API instances behind a load balancer (NGINX, AWS ALB)
- Deploy Qdrant with replication for high availability
- Use Redis for shared session state across instances

### Observability

No structured logging, tracing, or metrics currently exist. Production systems require:
- Request/response logging with correlation IDs
- Distributed tracing (OpenTelemetry → Datadog/Jaeger)
- Metrics for embedding latency, retrieval scores, LLM response time
- Alerting on error rates, slow queries, and degraded retrieval quality

This visibility is critical for debugging production issues and understanding system behavior under load.
