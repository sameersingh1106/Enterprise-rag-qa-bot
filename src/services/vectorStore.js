const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "../../data/vector-store.json");

function saveStore(records) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));
}

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return [];
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
}

// Cosine similarity: measures the angle between two vectors (1 = identical meaning, 0 = unrelated)
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function searchSimilar(queryVector, records, topK = 3) {
  const scored = records.map((r) => ({
    ...r,
    score: cosineSimilarity(queryVector, r.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { saveStore, loadStore, cosineSimilarity, searchSimilar };