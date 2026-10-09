import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { Bm25Index } from "../rag/bm25.js";
import { isHeading, splitSentences, tokenize } from "../rag/text.js";

export interface Source {
  n: number;
  docName: string;
  page: number;
  text: string;
}

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export interface GenerateInput {
  question: string;
  sources: Source[];
  history: Turn[];
}

/** Writes the answer from retrieved sources. Must cite with [n] and say NOT_FOUND when sources don't cover it. */
export interface Generator {
  readonly name: string;
  generate(input: GenerateInput): Promise<string>;
}

export const NOT_FOUND = "NOT_FOUND";

export const SYSTEM_PROMPT = `You answer questions using ONLY the numbered sources provided.

Rules:
- Every factual sentence must end with citations like [1] or [2][3], pointing at the sources that support it.
- If the sources do not contain the answer, reply with exactly: ${NOT_FOUND}
- Never use outside knowledge, never guess, never invent numbers, dates or names.
- Be concise: 1 to 4 sentences, or a short list if the question asks for several items.
- Quote exact figures (amounts, days, percentages) as written in the sources.`;

export function formatSources(sources: Source[]): string {
  return sources.map((s) => `[${s.n}] (${s.docName}, page ${s.page})\n${s.text}`).join("\n\n");
}

const userMessage = ({ question, sources }: GenerateInput) =>
  `Sources:\n\n${formatSources(sources)}\n\nQuestion: ${question}`;

const recent = (history: Turn[]) => history.slice(-6);

export class AnthropicGenerator implements Generator {
  readonly name: string;
  private client: Anthropic;
  constructor(apiKey: string, private model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5") {
    this.client = new Anthropic({ apiKey });
    this.name = model;
  }
  async generate(input: GenerateInput) {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 800,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [...recent(input.history), { role: "user", content: userMessage(input) }],
    });
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  }
}

export class OpenAIGenerator implements Generator {
  readonly name: string;
  private client: OpenAI;
  constructor(apiKey: string, private model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini") {
    this.client = new OpenAI({ apiKey });
    this.name = model;
  }
  async generate(input: GenerateInput) {
    const res = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...recent(input.history),
        { role: "user", content: userMessage(input) },
      ],
    });
    return (res.choices[0]?.message?.content ?? "").trim();
  }
}

export class GeminiGenerator implements Generator {
  readonly name: string;
  private client: GoogleGenAI;
  constructor(apiKey: string, private model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash") {
    this.client = new GoogleGenAI({ apiKey });
    this.name = model;
  }
  async generate(input: GenerateInput) {
    const res = await this.client.models.generateContent({
      model: this.model,
      contents: [
        ...recent(input.history).map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
        { role: "user", parts: [{ text: userMessage(input) }] },
      ],
      config: { systemInstruction: SYSTEM_PROMPT, temperature: 0 },
    });
    return (res.text ?? "").trim();
  }
}

/**
 * Offline fallback: picks the sentences from the retrieved sources that best
 * match the question and cites them. Not as fluent as an LLM, but it never
 * says anything that isn't literally in the documents, and it lets anyone run
 * the full retrieval + citation flow without an API key.
 */
export class ExtractiveGenerator implements Generator {
  readonly name = "extractive (no API key)";

  async generate({ question, sources }: GenerateInput) {
    const sentences = sources.flatMap((s) =>
      splitSentences(s.text)
        .filter((t) => t.length > 25 && !isHeading(t))
        .map((text) => ({ text, n: s.n })),
    );
    if (!sentences.length) return NOT_FOUND;

    const index = new Bm25Index(sentences.map((s) => s.text));
    const scores = index.score(question);
    const best = Math.max(...scores);
    if (best <= 0) return NOT_FOUND;

    // Keep sentences that cover most of what was asked (IDF-weighted), best first.
    const picked = sentences
      .map((s, i) => ({ ...s, score: scores[i]!, cov: index.coverage(question, new Set(tokenize(s.text))) }))
      .filter((s) => s.score > 0 && s.cov >= 0.5)
      .sort((a, b) => b.cov - a.cov || b.score - a.score)
      .slice(0, 2);
    if (!picked.length) return NOT_FOUND;

    const seen = new Set<string>();
    return picked
      .filter((s) => !seen.has(s.text) && seen.add(s.text))
      .map((s) => `${s.text.replace(/\s*$/, "")} [${s.n}]`)
      .join(" ");
  }
}
