const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HF_API_KEY);
const MODEL = "sentence-transformers/all-MiniLM-L6-v2";

async function getEmbedding(text) {
  try {
    const res = await hf.featureExtraction({
      model: MODEL,
      inputs: text,
    });

    let embedding = res;

   
    if (Array.isArray(res) && Array.isArray(res[0])) {
      embedding = res[0];
    }

    if (!embedding || embedding.length === 0) {
      console.warn("[EMBEDDING] Empty embedding");
      return null;
    }

    console.log(" Embedding length:", embedding.length);

    return embedding;
  } catch (err) {
    console.error("[HF ERROR]", err.message);
    return null;
  }
}

module.exports = { getEmbedding };