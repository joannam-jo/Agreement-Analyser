/**
 * Sentence embeddings, computed locally.
 *
 * The model is all-MiniLM-L6-v2 (384 dimensions) running through Transformers.js on the ONNX
 * runtime. It is downloaded once to a cache inside node_modules and then runs offline, on the CPU,
 * with no API key and no request leaving the machine — which matters here, because the text being
 * embedded is the borrower's own contract.
 *
 * Embeddings are L2-normalised on the way out, so the cosine similarity of two vectors is their
 * dot product.
 */

import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

/** Embedding a long document is many forward passes; batching keeps peak memory flat. */
const BATCH_SIZE = 16;

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("feature-extraction", EMBEDDING_MODEL)
    );
    // A failed download must not poison every later call.
    extractorPromise.catch(() => {
      extractorPromise = null;
    });
  }
  return extractorPromise;
}

/** Loads the model ahead of the first upload so that upload itself is not slowed by it. */
export async function warmUpEmbeddings(): Promise<boolean> {
  try {
    await getExtractor();
    return true;
  } catch (e) {
    console.warn("Embedding model unavailable; semantic retrieval is disabled.", e);
    return false;
  }
}

export async function embedTexts(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const vectors: Float32Array[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const output = await extractor(batch, { pooling: "mean", normalize: true });
    const data = output.data as Float32Array;
    for (let j = 0; j < batch.length; j++) {
      vectors.push(data.slice(j * EMBEDDING_DIMENSIONS, (j + 1) * EMBEDDING_DIMENSIONS));
    }
  }
  return vectors;
}

export async function embedText(text: string): Promise<Float32Array> {
  const [vector] = await embedTexts([text]);
  return vector;
}

/** Both vectors are already normalised, so the dot product is the cosine similarity. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}
