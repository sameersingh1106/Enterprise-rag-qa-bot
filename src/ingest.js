const { loadPDF } = require("./utils/pdfLoader");
const { chunkText } = require("./utils/chunker");
const { embedText } = require("./services/embeddings");
const { saveStore } = require("./services/vectorStore");

async function main() {
  console.log("Loading PDF...");
  const text = await loadPDF("./data/sample.pdf");

  console.log("Chunking text...");
  const chunks = chunkText(text);
  console.log(`Total chunks: ${chunks.length}`);

  console.log("Generating embeddings (this may take a minute)...");
  const records = [];
  for (const chunk of chunks) {
    const embedding = await embedText(chunk.text);
    records.push({ id: chunk.id, text: chunk.text, embedding });
    if (chunk.id % 50 === 0) console.log(`Embedded ${chunk.id}/${chunks.length}`);
  }

  console.log("Saving vector store...");
  saveStore(records);
  console.log("Done! Vector store saved to data/vector-store.json");
}

main();