const path = require("path");
const { Pinecone } = require("@pinecone-database/pinecone");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

console.log("KEY:", process.env.PINECONE_API_KEY);
console.log("INDEX:", process.env.PINECONE_INDEX);

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pc.index(process.env.PINECONE_INDEX);

async function clear() {
  try {
    console.log("🧹 Clearing Pinecone index...");

    await index.deleteAll();

    console.log("✅ Pinecone cleared successfully");
  } catch (err) {
    console.error("❌ Error clearing Pinecone:", err);
  }
}

clear();