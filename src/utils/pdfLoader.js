const fs = require("fs");
const { PDFParse } = require("pdf-parse");

async function loadPDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}

module.exports = { loadPDF };