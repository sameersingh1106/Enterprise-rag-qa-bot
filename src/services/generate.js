require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateAnswer(question, retrievedChunks, retries = 2) {
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const context = retrievedChunks
    .map((chunk, i) => `[Source ${i + 1}]\n${chunk.text}`)
    .join("\n\n");

  const prompt = `You are a helpful assistant answering questions based ONLY on the provided document excerpts below. 
Do not use outside knowledge. If the answer isn't in the excerpts, say so clearly.
Always cite which Source number(s) you used in your answer.

Document excerpts:
${context}

Question: ${question}

Answer (with source citations):`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`Retry ${attempt + 1}/${retries} after error: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
}

module.exports = { generateAnswer };