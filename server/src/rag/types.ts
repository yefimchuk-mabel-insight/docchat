export interface DocumentMeta {
  id: string;
  name: string;
  pageCount: number;
  chunkCount: number;
  addedAt: string;
  sample: boolean;
}

/** A retrievable passage. Always tied to one page so citations stay precise. */
export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  page: number;
  text: string;
}

export interface ScoredChunk extends Chunk {
  /** Fused rank score (higher is better). */
  score: number;
  /** Raw lexical score, used for the "is this in the documents at all?" check. */
  lexical: number;
  /** Cosine similarity when embeddings are enabled, otherwise null. */
  semantic: number | null;
}

export interface Citation {
  n: number;
  docId: string;
  docName: string;
  page: number;
  snippet: string;
}

export interface Answer {
  answer: string;
  /** False when the documents don't contain the answer; the UI shows that honestly. */
  found: boolean;
  citations: Citation[];
  /** Everything that was retrieved, for the "why this answer" panel. */
  retrieved: Array<Pick<ScoredChunk, "docName" | "page" | "score" | "lexical" | "semantic"> & { n: number }>;
  model: string;
  durationMs: number;
}
