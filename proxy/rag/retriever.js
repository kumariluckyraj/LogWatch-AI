const { getIndex } = require("./pinecone");
const { getEmbedding } = require("./embedder");

async function retrieveRelevantLogs(query) {
  try {
    const embedding = await getEmbedding(query);

    if (!embedding) {
      console.warn("[RAG] No embedding for query");
      return [];
    }

    const index = await getIndex();

    //  v7 query signature
    const result = await index.query({
      vector: Array.from(embedding),
      topK: 5,
      includeMetadata: true,
    });

    console.log("🔍 Pinecone matches:", result.matches?.length || 0);

    if (!result.matches || result.matches.length === 0) {
      return [];
    }

    return result.matches.map((m) => m.metadata);
  } catch (err) {
    console.error("[RAG RETRIEVE ERROR]", err.message);
    return [];
  }
}

module.exports = { retrieveRelevantLogs };