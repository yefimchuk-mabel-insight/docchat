import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

/** Turns texts into vectors for semantic search. Optional: without one, search is lexical only. */
export interface Embedder {
  readonly name: string;
  embed(texts: string[]): Promise<number[][]>;
}

const BATCH = 64;

async function inBatches(texts: string[], fn: (batch: string[]) => Promise<number[][]>) {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) out.push(...(await fn(texts.slice(i, i + BATCH))));
  return out;
}

export class OpenAIEmbedder implements Embedder {
  readonly name: string;
  private client: OpenAI;
  constructor(apiKey: string, private model = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small") {
    this.client = new OpenAI({ apiKey });
    this.name = `openai:${model}`;
  }
  embed(texts: string[]) {
    return inBatches(texts, async (batch) => {
      const res = await this.client.embeddings.create({ model: this.model, input: batch });
      return res.data.map((d) => d.embedding);
    });
  }
}

export class GeminiEmbedder implements Embedder {
  readonly name: string;
  private client: GoogleGenAI;
  constructor(apiKey: string, private model = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001") {
    this.client = new GoogleGenAI({ apiKey });
    this.name = `gemini:${model}`;
  }
  embed(texts: string[]) {
    return inBatches(texts, async (batch) => {
      const res = await this.client.models.embedContent({ model: this.model, contents: batch });
      return (res.embeddings ?? []).map((e) => e.values ?? []);
    });
  }
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
