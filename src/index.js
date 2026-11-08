require("dotenv").config();
const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { embedText } = require("./services/embeddings");
const { loadStore, saveStore, searchSimilar } = require("./services/vectorStore");
const { generateAnswer } = require("./services/generate");
const { loadPDF } = require("./utils/pdfLoader");
const { chunkText } = require("./utils/chunker");

const app = express();
const uploadingNames = new Set();
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

function parseTopK(value, fallback = 3) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 10)) : fallback;
}

function hasFileNamed(directory, filename) {
  if (!fs.existsSync(directory)) return false;
  return fs.readdirSync(directory).some((entry) =>
    entry.toLocaleLowerCase("en-US") === filename.toLocaleLowerCase("en-US") &&
    fs.statSync(path.join(directory, entry)).isFile()
  );
}

async function retrieve(question, topK) {
  const records = loadStore();
  if (records.length === 0) throw new Error("Vector store is empty. Run 'node src/ingest.js' first.");
  const queryVector = await embedText(question);
  return searchSimilar(queryVector, records, topK);
}

app.get("/api/documents", (req, res) => {
  try {
    const records = loadStore();
    const groups = new Map();
    for (const record of records) {
      const name = record.filename || record.metadata?.filename || record.source || "Legacy index (source name unavailable)";
      if (!groups.has(name)) groups.set(name, { name, chunks: 0 });
      groups.get(name).chunks += 1;
    }
    res.json({ totalChunks: records.length, documents: [...groups.values()] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not read the document index." });
  }
});

app.post("/api/documents/upload", express.raw({ type: "application/pdf", limit: "20mb" }), async (req, res) => {
  let temporaryPath;
  let reservedName;
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== "%PDF-") {
      return res.status(400).json({ error: "Choose a valid PDF file." });
    }
    let suppliedName;
    try {
      suppliedName = decodeURIComponent(req.get("x-file-name") || "document.pdf").replace(/\\/g, "/");
    } catch {
      return res.status(400).json({ error: "The filename could not be read." });
    }
    const filename = path.basename(suppliedName).trim();
    if (!filename || filename.length > 180 || !filename.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ error: "The filename must end in .pdf and be under 180 characters." });
    }

    const documentsDir = path.join(__dirname, "../data/documents");
    fs.mkdirSync(documentsDir, { recursive: true });
    const storedPath = path.join(documentsDir, filename);
    const normalizedName = filename.toLocaleLowerCase("en-US");
    const indexedAlready = loadStore().some((record) => {
      const existingName = record.filename || record.metadata?.filename || record.source;
      return typeof existingName === "string" && path.basename(existingName).toLocaleLowerCase("en-US") === normalizedName;
    });
    const savedAlready = hasFileNamed(documentsDir, filename) || hasFileNamed(path.join(__dirname, "../data"), filename);
    if (indexedAlready || savedAlready || uploadingNames.has(normalizedName)) {
      return res.status(409).json({ error: `A PDF named “${filename}” already exists. Rename the file before uploading it.` });
    }
    reservedName = normalizedName;
    uploadingNames.add(normalizedName);
    temporaryPath = path.join(documentsDir, `.upload-${crypto.randomUUID()}.pdf`);
    fs.writeFileSync(temporaryPath, req.body);

    const text = await loadPDF(temporaryPath);
    if (!text.trim()) {
      fs.unlinkSync(temporaryPath);
      return res.status(422).json({ error: "No readable text was found in this PDF." });
    }
    const chunks = chunkText(text);
    const documentId = crypto.randomUUID();
    const newRecords = [];
    for (const chunk of chunks) {
      newRecords.push({
        id: `${documentId}-${chunk.id}`,
        text: chunk.text,
        embedding: await embedText(chunk.text),
        filename,
        documentId,
      });
    }

    fs.renameSync(temporaryPath, storedPath);
    temporaryPath = null;
    const existing = loadStore();
    saveStore([...existing, ...newRecords]);
    res.status(201).json({ filename, chunks: newRecords.length, totalChunks: existing.length + newRecords.length });
  } catch (err) {
    console.error(err);
    if (temporaryPath && fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    if (err.type === "entity.too.large") return res.status(413).json({ error: "PDF is too large. The upload limit is 20 MB." });
    res.status(500).json({ error: err.message || "Could not upload and index the PDF." });
  } finally {
    if (reservedName) uploadingNames.delete(reservedName);
  }
});

app.post("/api/retrieve", async (req, res) => {
  try {
    const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
    if (!question) return res.status(400).json({ error: "Enter a question to inspect retrieval." });
    const chunks = await retrieve(question, parseTopK(req.body.topK));
    res.json({ question, results: chunks.map((chunk) => ({ id: chunk.id, score: chunk.score, text: chunk.text })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Could not search the document index." });
  }
});

app.post("/ask", async (req, res) => {
  try {
    const question = typeof req.body.question === "string" ? req.body.question.trim() : "";
    if (!question) {
      return res.status(400).json({ error: "Missing 'question' in request body" });
    }

    const topChunks = await retrieve(question, parseTopK(req.body.topK));
    const answer = await generateAnswer(question, topChunks);

    res.json({
      question,
      answer,
      sources: topChunks.map((c) => ({ id: c.id, score: c.score, text: c.text })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong processing your question." });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") return res.status(413).json({ error: "PDF is too large. The upload limit is 20 MB." });
  console.error(err);
  res.status(500).json({ error: "The server could not process this request." });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RAG QA Bot API running on http://localhost:${PORT}`));
