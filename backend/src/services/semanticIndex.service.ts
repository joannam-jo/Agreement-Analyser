/**
 * Per-document vector index for semantic retrieval.
 *
 * ClauseGuard, the reference implementation this follows, keeps its vectors in ChromaDB. A
 * consumer agreement produces a few hundred chunks at most, and an exhaustive cosine scan over a
 * few hundred 384-dimension vectors takes under a millisecond — far less than the network round
 * trip to a vector database would. Keeping the index as one encrypted file per document therefore
 * costs nothing in speed and avoids adding a service that would have to be secured, backed up and
 * deployed alongside the application.
 *
 * The index is stored next to the document, encrypted with the same key material, and deleted with
 * it.
 */

import { chunkText, type TextChunk } from "./chunking.service";
import { embedText, embedTexts, cosineSimilarity, EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./embedding.service";
import { saveSemanticIndex, readSemanticIndex } from "./storage.service";

export interface RetrievedChunk extends TextChunk {
  /** Cosine similarity to the query, in [-1, 1]; normalised vectors make 1 identical. */
  score: number;
}

interface IndexHeader {
  model: string;
  dimensions: number;
  chunks: TextChunk[];
}

/**
 * Chunks the document, embeds every chunk and stores the result.
 * Returns the number of chunks indexed, or 0 if the model was unavailable.
 */
export async function buildSemanticIndex(agreementId: string, fullText: string): Promise<number> {
  const chunks = chunkText(fullText);
  if (chunks.length === 0) return 0;

  try {
    const vectors = await embedTexts(chunks.map((c) => c.text));
    await saveSemanticIndex(agreementId, serialize({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, chunks }, vectors));
    return chunks.length;
  } catch (e) {
    // Retrieval is an enhancement: a document that cannot be indexed is still fully analysed,
    // and the assistant falls back to selecting clauses by category.
    console.warn(`Semantic index could not be built for ${agreementId}`, e);
    return 0;
  }
}

/** Returns the chunks most similar to the question. Callers must have checked ownership. */
export async function querySemanticIndex(agreementId: string, query: string, topK = 5): Promise<RetrievedChunk[]> {
  const blob = await readSemanticIndex(agreementId);
  if (!blob) return [];

  try {
    const { header, vectors } = deserialize(blob);
    if (header.model !== EMBEDDING_MODEL) return [];

    const queryVector = await embedText(query);
    const scored = header.chunks.map((chunk, i) => ({ ...chunk, score: cosineSimilarity(queryVector, vectors[i]) }));
    scored.sort((a, b) => b.score - a.score);

    // Below roughly 0.2 the nearest chunk is not actually about the question; returning it would
    // invite the model to answer from an unrelated part of the contract.
    return scored.filter((c) => c.score >= 0.2).slice(0, topK);
  } catch (e) {
    console.warn(`Semantic retrieval failed for ${agreementId}`, e);
    return [];
  }
}

export async function hasSemanticIndex(agreementId: string): Promise<boolean> {
  return (await readSemanticIndex(agreementId)) !== null;
}

/* ---------------------------------------------------------------------------
   Serialisation: a JSON header followed by the raw float32 vectors.
   JSON-encoding the vectors themselves would roughly quadruple the stored size.
   --------------------------------------------------------------------------- */

function serialize(header: IndexHeader, vectors: Float32Array[]): Buffer {
  const headerJson = Buffer.from(JSON.stringify(header), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(headerJson.length, 0);

  const block = new Float32Array(vectors.length * EMBEDDING_DIMENSIONS);
  vectors.forEach((v, i) => block.set(v, i * EMBEDDING_DIMENSIONS));

  return Buffer.concat([length, headerJson, Buffer.from(block.buffer, block.byteOffset, block.byteLength)]);
}

function deserialize(blob: Buffer): { header: IndexHeader; vectors: Float32Array[] } {
  const headerLength = blob.readUInt32LE(0);
  const header = JSON.parse(blob.subarray(4, 4 + headerLength).toString("utf8")) as IndexHeader;

  const start = 4 + headerLength;
  // Buffer slices are not guaranteed to be 4-byte aligned, which Float32Array requires.
  const aligned = Uint8Array.prototype.slice.call(blob, start);
  const block = new Float32Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 4);

  const vectors = header.chunks.map((_, i) => block.slice(i * EMBEDDING_DIMENSIONS, (i + 1) * EMBEDDING_DIMENSIONS));
  return { header, vectors };
}
