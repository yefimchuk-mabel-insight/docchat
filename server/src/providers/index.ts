import { GeminiEmbedder, OpenAIEmbedder, type Embedder } from "./embeddings.js";
import {
  AnthropicGenerator,
  ExtractiveGenerator,
  GeminiGenerator,
  OpenAIGenerator,
  type Generator,
} from "./generators.js";

/**
 * Picks the answer model and (optional) embedding model from the environment.
 * With no keys at all the app still works end to end: BM25 retrieval plus an
 * extractive answerer that only quotes the documents.
 */
export function fromEnv(env = process.env): { generator: Generator; embedder: Embedder | null } {
  const wanted = env.LLM_PROVIDER?.toLowerCase();
  let generator: Generator = new ExtractiveGenerator();
  if ((wanted === "anthropic" || !wanted) && env.ANTHROPIC_API_KEY) generator = new AnthropicGenerator(env.ANTHROPIC_API_KEY);
  else if ((wanted === "openai" || !wanted) && env.OPENAI_API_KEY) generator = new OpenAIGenerator(env.OPENAI_API_KEY);
  else if ((wanted === "gemini" || !wanted) && env.GEMINI_API_KEY) generator = new GeminiGenerator(env.GEMINI_API_KEY);

  // Anthropic has no embeddings endpoint, so embeddings come from OpenAI or Gemini when a key exists.
  let embedder: Embedder | null = null;
  if (env.EMBEDDINGS !== "off") {
    if (env.OPENAI_API_KEY) embedder = new OpenAIEmbedder(env.OPENAI_API_KEY);
    else if (env.GEMINI_API_KEY) embedder = new GeminiEmbedder(env.GEMINI_API_KEY);
  }
  return { generator, embedder };
}
