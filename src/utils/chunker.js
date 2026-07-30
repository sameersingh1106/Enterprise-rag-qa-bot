function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  let id = 0;

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunkWords = words.slice(i, i + chunkSize);
    if (chunkWords.length === 0) break;
    chunks.push({ id: id++, text: chunkWords.join(" ") });
    if (i + chunkSize >= words.length) break;
  }

  return chunks;
}

module.exports = { chunkText };