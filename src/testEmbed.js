const { embedText } = require("./services/embeddings");

async function main() {
  const vector = await embedText("This is a test sentence.");
  console.log("Vector length:", vector.length);
  console.log("First 5 values:", vector.slice(0, 5));
}

main();