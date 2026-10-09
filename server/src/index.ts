import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { fromEnv } from "./providers/index.js";
import { KnowledgeBase } from "./rag/knowledge-base.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { generator, embedder } = fromEnv();

const app = await buildApp({
  kb: new KnowledgeBase(embedder),
  generator,
  samplesDir: process.env.SAMPLES_DIR ?? join(root, "samples"),
  webDir: process.env.WEB_DIR ?? join(root, "web", "dist"),
  logger: true,
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "0.0.0.0" });
app.log.info(`Answers: ${generator.name} · Embeddings: ${embedder?.name ?? "off (BM25 only)"}`);
