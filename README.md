# Enterprise RAG QA Bot

A Retrieval-Augmented Generation (RAG) pipeline that answers questions over complex financial/technical PDF documents with precise source attribution — built entirely in Node.js.

## Overview
Traditional LLMs can hallucinate or lack access to specific documents. This project solves that by retrieving the most relevant sections of a PDF via semantic search, then generating answers grounded strictly in that retrieved content — with every claim traceable back to its source.

## Tech Stack
- **Backend:** Node.js + Express
- **PDF Parsing:** pdf-parse
- **Embeddings:** Local, free — Xenova/all-MiniLM-L6-v2 (via @xenova/transformers), no API cost
- **Vector Store:** Custom JSON-based store with cosine similarity search
- **LLM:** Google Gemini API (gemini-3.5-flash-lite)

## How It Works
1. PDF is parsed and split into ~500-word overlapping chunks (preserves context across boundaries)
2. Each chunk is embedded locally into a 384-dimensional vector
3. On query, the question is embedded and compared against all stored chunks via cosine similarity
4. Top-3 most relevant chunks are retrieved and injected into a prompt template
5. Gemini generates an answer strictly grounded in the retrieved context, with explicit source citations
6. If the answer isn't in the retrieved context, the model says so rather than guessing — reducing hallucination

## API
**POST** `/ask`
```json
{ "question": "What was the company's revenue this year?" }
```
Returns the answer plus the source chunks used.

**GET** `/health` — health check

## Setup
```bash
git clone https://github.com/sameersingh1106/enterprise-rag-qa-bot.git
cd enterprise-rag-qa-bot
npm install
# Add your GEMINI_API_KEY to .env (see .env.example)
# Place a PDF at data/sample.pdf
node src/ingest.js      # one-time: chunk + embed the PDF
node src/index.js       # start the API server
```

## Design Decisions
- Used a local embedding model instead of a paid API to keep the project fully free to run and demonstrate open-source model integration
- Custom JSON vector store instead of a full vector database (e.g. pgvector) — a deliberate scope tradeoff for a portfolio project; production version would use pgvector or a managed vector DB for scale
- Prompt explicitly instructs the model to decline answering when context is insufficient, rather than hallucinating

## Future Improvements
- Migrate vector storage to pgvector for production-scale performance
- Add semantic (sentence-boundary-aware) chunking instead of fixed word-count chunking
- Multi-document support
- Simple frontend UI
