require("dotenv").config();
const { embedText } = require("./services/embeddings");
const { loadStore, searchSimilar } = require("./services/vectorStore");
const { generateAnswer } = require("./services/generate");

async function main() {
  const question = "What is the company's revenue or financial performance?";
  // ^ change this to test different questions

  const records = loadStore();
  const queryVector = await embedText(question);
  const topChunks = searchSimilar(queryVector, records, 3);

  console.log("Question:", question);
  console.log("Retrieved", topChunks.length, "relevant chunks\n");

  const answer = await generateAnswer(question, topChunks);

  console.log("=== ANSWER ===");
  console.log(answer);
}

main();