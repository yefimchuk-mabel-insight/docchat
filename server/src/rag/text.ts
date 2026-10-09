const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could do does for from had has have how i if in into is it its may " +
    "me my of on or our shall should so than that the their them then there these they this those to us was we " +
    "were what when where which who whom why will with would you your about after any all also am before being " +
    "both each few more most no nor not only other own same some such too very just many much get gets got " +
    "happen happens mean means need needed tell know explain please describe long"
  ).split(" "),
);

/** Very light stemmer: enough to match "terminate/terminated/termination" style variants. */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of ["ations", "ation", "ated", "ates", "ate", "ments", "ment", "ings", "ing", "ies", "ied", "ed", "es", "ly", "s"]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      if (suffix === "ies" || suffix === "ied") return `${word.slice(0, -3)}y`;
      const base = word.slice(0, -suffix.length);
      // "capped" -> "capp" -> "cap", "stopping" -> "stop"
      return /([bdgmnprt])\1$/.test(base) ? base.slice(0, -1) : base;
    }
  }
  return word;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().normalize("NFKD").match(/[a-z0-9]+(?:[.,][0-9]+)*/g) ?? [])
    .filter((t) => !STOPWORDS.has(t))
    .map((t) => (/^\d+[.,]0+$/.test(t) ? t.replace(/[.,]0+$/, "") : t)) // "99.0" matches "99"
    .map(stem);
}

export function splitSentences(text: string): string[] {
  return text
    .split("\n")
    .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(•])/))
    .map((s) => s.replace(/^[•\-–]\s*/, ""))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Headings like "4. Equipment and remote work allowance" carry no answer on their own. */
export function isHeading(sentence: string): boolean {
  return !/[.!?]$/.test(sentence) && sentence.length < 70;
}

/**
 * Small query-expansion table: everyday words people ask with vs. the formal
 * words documents use. Embeddings solve this generally; this keeps the
 * no-API-key mode useful. Keys and values are stems.
 */
const SYNONYMS: Record<string, string[]> = {
  drop: ["fall"],
  fall: ["drop"],
  cap: ["limit"],
  limit: ["cap"],
  cancel: ["termin"],
  quit: ["termin"],
  end: ["termin"],
  cost: ["fee", "price"],
  price: ["fee"],
  pay: ["payment", "paid"],
  holiday: ["vacation"],
  vacation: ["holiday"],
  broken: ["fault"],
  downtime: ["availability"],
  uptime: ["availability"],
  refund: ["credit"],
};

export function expansions(term: string): string[] {
  return [term, ...(SYNONYMS[term] ?? [])];
}

/** Query text with synonyms appended, for BM25 scoring. */
export function expandQuery(query: string): string {
  const extra = tokenize(query).flatMap((t) => SYNONYMS[t] ?? []);
  return extra.length ? `${query} ${extra.join(" ")}` : query;
}
