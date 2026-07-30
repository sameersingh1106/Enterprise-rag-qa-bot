const { embedText } = require("./services/embeddings");
const { loadStore, searchSimilar } = require("./services/vectorStore");

async function main() {
  const query = "What is the company's revenue or financial performance?";
  
  console.log("Query:", query);

  const records = loadStore();
  console.log(`Loaded ${records.length} chunks from store`);

  console.log("Embedding query...");
  const queryVector = await embedText(query);

  console.log("Searching for relevant chunks...");
  const results = searchSimilar(queryVector, records, 3);

  results.forEach((r, i) => {
    console.log(`\n--- Match ${i + 1} (score: ${r.score.toFixed(4)}) ---`);
    console.log(r.text.slice(0, 300) + "...");
  });
}

main();