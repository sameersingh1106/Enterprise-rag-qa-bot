const { loadPDF } = require("./utils/pdfLoader");
const { chunkText } = require("./utils/chunker");

async function main() {
  const text = await loadPDF("./data/sample.pdf");
  const chunks = chunkText(text);
  console.log(`Total chunks: ${chunks.length}`);
  console.log("First chunk:", chunks[0]);
}

main();