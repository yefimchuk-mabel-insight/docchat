export interface DocumentMeta {
  id: string;
  name: string;
  pageCount: number;
  chunkCount: number;
  addedAt: string;
  sample: boolean;
}

export interface Citation {
  n: number;
  docId: string;
  docName: string;
  page: number;
  snippet: string;
}

export interface Retrieved {
  n: number;
  docName: string;
  page: number;
  score: number;
  lexical: number;
  semantic: number | null;
}

export interface Answer {
  answer: string;
  found: boolean;
  citations: Citation[];
  retrieved: Retrieved[];
  model: string;
  durationMs: number;
}

export type Message =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; answer: Answer }
  | { role: "error"; content: string };
