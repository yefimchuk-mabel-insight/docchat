import type { Chunk } from "./types.js";

export interface ChunkOptions {
  /** Target characters per chunk. ~900 chars ≈ 200 tokens: small enough to be precise, big enough for context. */
  size?: number;
  /** Characters carried over between neighbouring chunks so a fact split across a boundary is still found. */
  overlap?: number;
}

const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9"“(])/;

/**
 * Splits each page into overlapping chunks on sentence boundaries.
 * Chunks never cross pages, so every citation points at exactly one page.
 */
export function chunkPages(
  docId: string,
  docName: string,
  pages: string[],
  { size = 900, overlap = 150 }: ChunkOptions = {},
): Chunk[] {
  const chunks: Chunk[] = [];
  pages.forEach((raw, i) => {
    const page = i + 1;
    const text = raw.replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
    if (!text) return;

    // Keep headings/list items as their own "sentences" so they aren't glued to the next line.
    const sentences = rebuildParagraphs(text.split("\n"))
      .flatMap((line) => line.split(SENTENCE_END))
      .map((s) => s.trim())
      .filter(Boolean);

    let current: string[] = [];
    let length = 0;
    const flush = () => {
      if (!current.length) return;
      chunks.push({ id: `${docId}:${page}:${chunks.length}`, docId, docName, page, text: current.join("\n") });
      // Start the next chunk with the tail of this one (overlap).
      const carry: string[] = [];
      let carried = 0;
      for (let k = current.length - 1; k >= 0 && carried < overlap; k--) {
        carry.unshift(current[k]!);
        carried += current[k]!.length;
      }
      current = carry.length < current.length ? carry : [];
      length = current.reduce((n, s) => n + s.length + 1, 0);
    };

    for (const s of sentences) {
      if (length + s.length > size && length > 0) flush();
      current.push(s);
      length += s.length + 1;
    }
    // Final chunk on the page (skip if it is pure overlap already emitted).
    const last = chunks.at(-1);
    const tail = current.join("\n");
    if (tail && !(last && last.page === page && last.text.endsWith(tail))) {
      chunks.push({ id: `${docId}:${page}:${chunks.length}`, docId, docName, page, text: tail });
    }
  });
  return chunks;
}

/**
 * PDF text comes as visual lines, so sentences are cut wherever the layout
 * wrapped them. Re-join wrapped lines into paragraphs, while keeping headings
 * and bullet points on their own line.
 */
export function rebuildParagraphs(lines: string[]): string[] {
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const prev = out.at(-1);
    const startsNew = /^[•\-–]|^\d+\.\s|^[A-Z][A-Za-z ]{0,40}$/.test(line) && !/^[a-z]/.test(line);
    const prevOpen = prev !== undefined && !/[.!?:]$/.test(prev) && prev.length > 60;
    if (prev !== undefined && prevOpen && !startsNew) out[out.length - 1] = `${prev} ${line}`;
    else if (prev !== undefined && /^[a-z(]/.test(line) && !/[.!?]$/.test(prev)) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out;
}
