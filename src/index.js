require("dotenv").config();
const express = require("express");
const { embedText } = require("./services/embeddings");
const { loadStore, searchSimilar } = require("./services/vectorStore");
const { generateAnswer } = require("./services/generate");

const app = express();
app.use(express.json());

app.post("/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Missing 'question' in request body" });
    }

    const records = loadStore();
    if (records.length === 0) {
      return res.status(500).json({ error: "Vector store is empty. Run 'node src/ingest.js' first." });
    }

    const queryVector = await embedText(question);
    const topChunks = searchSimilar(queryVector, records, 3);
    const answer = await generateAnswer(question, topChunks);

    res.json({
      question,
      answer,
      sources: topChunks.map((c) => ({ id: c.id, score: c.score, preview: c.text.slice(0, 150) })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong processing your question." });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RAG QA Bot API running on http://localhost:${PORT}`));