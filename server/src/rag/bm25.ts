import { expandQuery, expansions, tokenize } from "./text.js";

/**
 * Okapi BM25 over chunks. Lexical search is fast, needs no API, and is very
 * good at exact terms (clause numbers, error codes, product names), which
 * embeddings are notoriously weak at. With embeddings enabled, it is fused
 * with semantic search rather than replaced by it.
 */
export class Bm25Index {
  private docs: Map<string, number>[] = [];
  private lengths: number[] = [];
  private df = new Map<string, number>();
  private avgLength = 0;

  constructor(
    texts: string[],
    private k1 = 1.5,
    private b = 0.75,
  ) {
    for (const text of texts) {
      const tf = new Map<string, number>();
      const tokens = tokenize(text);
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
      this.docs.push(tf);
      this.lengths.push(tokens.length);
    }
    this.avgLength = this.lengths.reduce((a, n) => a + n, 0) / Math.max(1, this.lengths.length);
  }

  get size() {
    return this.docs.length;
  }

  idf(term: string): number {
    const n = this.docs.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  /** Scores every indexed text against the query. Index i matches texts[i]. */
  score(query: string): number[] {
    const terms = [...new Set(tokenize(expandQuery(query)))];
    return this.docs.map((tf, i) => {
      let s = 0;
      for (const t of terms) {
        const f = tf.get(t);
        if (!f) continue;
        const norm = 1 - this.b + this.b * (this.lengths[i]! / (this.avgLength || 1));
        s += this.idf(t) * ((f * (this.k1 + 1)) / (f + this.k1 * norm));
      }
      return s;
    });
  }

  /**
   * IDF-weighted share of query terms present in `among` (or anywhere in the
   * corpus). Rare terms count more, so "What is the CEO's salary?" scores low
   * even though "salary" appears somewhere: "CEO" is the term that matters.
   */
  coverage(query: string, among?: Set<string>): number {
    const terms = [...new Set(tokenize(query))];
    if (!terms.length) return 0;
    const has = (t: string) => expansions(t).some((x) => (among ? among.has(x) : this.df.has(x)));
    // Identifiers with digits (error codes, model numbers, clause numbers) are what the user is really asking about.
    const weight = (t: string) => this.idf(t) * (/\d/.test(t) ? 2 : 1);
    const total = terms.reduce((n, t) => n + weight(t), 0);
    const hit = terms.filter(has).reduce((n, t) => n + weight(t), 0);
    return total ? hit / total : 0;
  }
}
