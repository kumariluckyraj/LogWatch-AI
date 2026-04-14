const { getIndex } = require("./pinecone");
const { getEmbedding } = require("./embedder");

async function ingestLogs(logs) {
  try {
    if (!logs || logs.length === 0) return;

    const vectors = [];

    for (const log of logs) {
      if (!log) continue;

      const text =
        log.text ||
        `Status:${log.statusCode} Path:${log.path} Msg:${
          log.responseBody?.message ||
          (typeof log.responseBody === "string" ? log.responseBody : null) ||
          "Unknown"
        }`;

      const embedding = await getEmbedding(text);
      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) continue;

      vectors.push({
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        values: Array.from(embedding),
        metadata: {
          text,
          statusCode: log.statusCode || 200,
          path: log.path || "unknown",
        },
      });
    }

    if (vectors.length === 0) return;

    const index = await getIndex();

    await index.upsert({ records: vectors }); //  v7 syntax
    console.log("✅ Upserted:", vectors.length);

  } catch (err) {
    console.error("❌ INGEST ERROR:", err.message);
  }
}

module.exports = { ingestLogs };