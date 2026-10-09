import { randomUUID } from "node:crypto";
import { cosine, type Embedder } from "../providers/embeddings.js";
import { Bm25Index } from "./bm25.js";
import { chunkPages } from "./chunk.js";
import { extractPdfText } from "./pdf-text.js";
import type { Chunk, DocumentMeta, ScoredChunk } from "./types.js";

interface StoredDoc {
  meta: DocumentMeta;
  pdf: Uint8Array;
}

/** Reciprocal Rank Fusion constant; 60 is the value from the original paper and works well in practice. */
const RRF_K = 60;

/**
 * Holds documents, their chunks and the search indexes.
 * In-memory for the demo; in production chunks + vectors live in PostgreSQL with pgvector.
 */
export class KnowledgeBase {
  private docs = new Map<string, StoredDoc>();
  private chunks: Chunk[] = [];
  private vectors: (number[] | null)[] = [];
  private bm25 = new Bm25Index([]);

  constructor(private embedder: Embedder | null = null) {}

  get embedderName() {
    return this.embedder?.name ?? null;
  }

  list(): DocumentMeta[] {
    return [...this.docs.values()].map((d) => d.meta);
  }

  file(id: string) {
    return this.docs.get(id)?.pdf;
  }

  has(name: string) {
    return [...this.docs.values()].some((d) => d.meta.name === name);
  }

  async add(name: string, pdf: Uint8Array, sample = false): Promise<DocumentMeta> {
    const { pages } = await extractPdfText(pdf.slice());
    const id = randomUUID();
    const chunks = chunkPages(id, name, pages);
    if (chunks.length === 0) {
      throw new Error("No text found in this PDF. Scanned documents need OCR first (see README).");
    }
    const vectors = this.embedder ? await this.embedder.embed(chunks.map((c) => c.text)) : chunks.map(() => null);

    const meta: DocumentMeta = {
      id,
      name,
      pageCount: pages.length,
      chunkCount: chunks.length,
      addedAt: new Date().toISOString(),
      sample,
    };
    this.docs.set(id, { meta, pdf });
    this.chunks.push(...chunks);
    this.vectors.push(...vectors);
    this.reindex();
    return meta;
  }

  remove(id: string): boolean {
    if (!this.docs.delete(id)) return false;
    const keep = this.chunks.map((c) => c.docId !== id);
    this.chunks = this.chunks.filter((_, i) => keep[i]);
    this.vectors = this.vectors.filter((_, i) => keep[i]);
    this.reindex();
    return true;
  }

  private reindex() {
    this.bm25 = new Bm25Index(this.chunks.map((c) => `${c.docName} ${c.text}`));
  }

  /** Share of question terms found anywhere in the corpus. */
  coverage(query: string) {
    return this.bm25.coverage(query);
  }

  /**
   * Hybrid retrieval: BM25 ranking and (if available) embedding ranking,
   * merged with Reciprocal Rank Fusion so neither score scale dominates.
   */
  async search(query: string, k = 5, docIds?: string[]): Promise<ScoredChunk[]> {
    if (this.chunks.length === 0) return [];
    const allowed = (i: number) => !docIds?.length || docIds.includes(this.chunks[i]!.docId);

    const lexical = this.bm25.score(query);
    const lexRank = rank(lexical, allowed);

    let semantic: (number | null)[] = this.chunks.map(() => null);
    let semRank = new Map<number, number>();
    if (this.embedder) {
      const [q] = await this.embedder.embed([query]);
      semantic = this.vectors.map((v) => (v && q ? cosine(q, v) : null));
      semRank = rank(semantic.map((s) => s ?? -1), allowed);
    }

    const fused = this.chunks
      .map((c, i) => ({ c, i }))
      .filter(({ i }) => allowed(i) && (lexical[i]! > 0 || semRank.has(i)))
      .map(({ c, i }) => {
        const score =
          (lexRank.has(i) ? 1 / (RRF_K + lexRank.get(i)!) : 0) + (semRank.has(i) ? 1 / (RRF_K + semRank.get(i)!) : 0);
        return { ...c, score, lexical: lexical[i]!, semantic: semantic[i] ?? null };
      })
      .sort((a, b) => b.score - a.score);

    return fused.slice(0, k);
  }
}

function rank(scores: number[], allowed: (i: number) => boolean): Map<number, number> {
  return new Map(
    scores
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => s > 0 && allowed(i))
      .sort((a, b) => b.s - a.s)
      .map(({ i }, r) => [i, r + 1] as [number, number]),
  );
}
