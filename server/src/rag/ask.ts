import { NOT_FOUND, type Generator, type Source, type Turn } from "../providers/generators.js";
import type { KnowledgeBase } from "./knowledge-base.js";
import { Bm25Index } from "./bm25.js";
import { splitSentences, tokenize } from "./text.js";
import type { Answer, Citation, ScoredChunk } from "./types.js";

export const NOT_FOUND_MESSAGE =
  "I couldn't find this in the uploaded documents. Try rephrasing, or upload the document that covers it.";

export interface AskOptions {
  question: string;
  history?: Turn[];
  docIds?: string[];
  k?: number;
}

/**
 * Retrieval gate thresholds. If retrieval is this weak, the question is about
 * something the documents don't cover, and we refuse instead of letting the
 * model improvise. Tuned on the sample set; see test/ask.test.ts.
 */
const MIN_COVERAGE = 0.5;
const MIN_LEXICAL = 1.5;
const MIN_SEMANTIC = 0.35;

/** Short follow-ups ("and for contractors?") borrow context from the previous question for retrieval. */
export function retrievalQuery(question: string, history: Turn[]): string {
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content;
  return lastUser && tokenize(question).length < 3 ? `${lastUser} ${question}` : question;
}

export async function ask(kb: KnowledgeBase, generator: Generator, opts: AskOptions): Promise<Answer> {
  const started = performance.now();
  const history = opts.history ?? [];
  const query = retrievalQuery(opts.question, history);
  const retrieved = await kb.search(query, opts.k ?? 5, opts.docIds);
  const done = (partial: Omit<Answer, "durationMs" | "retrieved" | "model">): Answer => ({
    ...partial,
    model: generator.name,
    retrieved: retrieved.map((r, i) => ({ n: i + 1, docName: r.docName, page: r.page, score: r.score, lexical: r.lexical, semantic: r.semantic })),
    durationMs: Math.round(performance.now() - started),
  });

  if (!isRelevant(kb, query, retrieved)) {
    return done({ answer: NOT_FOUND_MESSAGE, found: false, citations: [] });
  }

  const sources: Source[] = retrieved.map((r, i) => ({ n: i + 1, docName: r.docName, page: r.page, text: r.text }));
  const raw = await generator.generate({ question: opts.question, sources, history });

  if (!raw || raw.includes(NOT_FOUND)) {
    return done({ answer: NOT_FOUND_MESSAGE, found: false, citations: [] });
  }

  const { text, cited } = cleanCitations(raw, sources.length);
  const citations: Citation[] = cited.map((n) => {
    const r = retrieved[n - 1]!;
    return { n, docId: r.docId, docName: r.docName, page: r.page, snippet: snippet(r.text, opts.question) };
  });
  return done({ answer: text, found: true, citations });
}

function isRelevant(kb: KnowledgeBase, query: string, retrieved: ScoredChunk[]): boolean {
  const top = retrieved[0];
  if (!top) return false;
  if (top.semantic != null && top.semantic >= MIN_SEMANTIC) return true;
  return kb.coverage(query) >= MIN_COVERAGE && top.lexical >= MIN_LEXICAL;
}

/**
 * Keeps only citation markers that point at a real source, renumbers nothing
 * (numbers match the source list the UI shows), and returns the cited set.
 * A model citing [7] when there are 5 sources is a hallucinated citation: drop it.
 */
export function cleanCitations(raw: string, sourceCount: number): { text: string; cited: number[] } {
  const cited = new Set<number>();
  const text = raw
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, list: string) => {
      const valid = list
        .split(",")
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= sourceCount);
      valid.forEach((n) => cited.add(n));
      return valid.map((n) => `[${n}]`).join("");
    })
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  return { text, cited: [...cited].sort((a, b) => a - b) };
}

/** The sentence in the chunk that best matches the question, trimmed for display. */
export function snippet(chunkText: string, question: string, max = 240): string {
  const sentences = splitSentences(chunkText);
  if (!sentences.length) return chunkText.slice(0, max);
  const scores = new Bm25Index(sentences).score(question);
  const bestIdx = scores.indexOf(Math.max(...scores));
  const s = sentences[Math.max(0, bestIdx)]!;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
