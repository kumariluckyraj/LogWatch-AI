const { Pinecone } = require("@pinecone-database/pinecone");

let index;

async function getIndex() {
  if (index) return index;

  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });

 
  const indexName = process.env.PINECONE_INDEX;
  console.log("🔌 Connecting to Pinecone index:", indexName);

  index = pc.index(indexName);
  console.log("Pinecone index ready");
  return index;
}

module.exports = { getIndex };