import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import type { Generator } from "./providers/generators.js";
import { ask } from "./rag/ask.js";
import { KnowledgeBase } from "./rag/knowledge-base.js";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const MAX_DOCS = 20;

const AskBody = z.object({
  question: z.string().trim().min(2).max(1000),
  docIds: z.array(z.string()).max(MAX_DOCS).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(12)
    .optional(),
});

export interface AppOptions {
  kb: KnowledgeBase;
  generator: Generator;
  samplesDir: string;
  webDir?: string;
  logger?: boolean;
  /** Load the sample documents at startup so the demo works on first visit. */
  preloadSamples?: boolean;
}

export async function buildApp({ kb, generator, samplesDir, webDir, logger = false, preloadSamples = true }: AppOptions) {
  const app = Fastify({ logger });
  await app.register(multipart, { limits: { fileSize: MAX_PDF_BYTES, files: 1 } });

  const loadSamples = async () => {
    const files = (await readdir(samplesDir)).filter((f) => f.endsWith(".pdf")).sort();
    for (const f of files) if (!kb.has(f)) await kb.add(f, new Uint8Array(await readFile(join(samplesDir, f))), true);
  };
  if (preloadSamples) await loadSamples();

  app.get("/api/health", async () => ({ ok: true, generator: generator.name, embeddings: kb.embedderName }));

  app.get("/api/documents", async () => kb.list());

  app.post("/api/documents/samples", async () => {
    await loadSamples();
    return kb.list();
  });

  app.post("/api/documents", async (req, reply) => {
    if (kb.list().length >= MAX_DOCS) return reply.code(429).send({ error: `Limit of ${MAX_DOCS} documents reached. Remove one first.` });
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "Upload a PDF in the 'file' field." });
    const buf = await file.toBuffer();
    if (file.file.truncated) return reply.code(413).send({ error: "PDF is larger than 15 MB." });
    if (buf.subarray(0, 5).toString() !== "%PDF-") return reply.code(415).send({ error: "That file is not a PDF." });
    try {
      return await kb.add(file.filename, new Uint8Array(buf));
    } catch (err) {
      return reply.code(422).send({ error: (err as Error).message });
    }
  });

  app.delete<{ Params: { id: string } }>("/api/documents/:id", async (req, reply) =>
    kb.remove(req.params.id) ? { ok: true } : reply.code(404).send({ error: "Not found" }),
  );

  app.get<{ Params: { id: string } }>("/api/documents/:id/file", async (req, reply) => {
    const pdf = kb.file(req.params.id);
    return pdf ? reply.type("application/pdf").send(Buffer.from(pdf)) : reply.code(404).send({ error: "Not found" });
  });

  app.post("/api/ask", async (req, reply) => {
    const parsed = AskBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Ask a question of 2 to 1000 characters." });
    if (kb.list().length === 0) return reply.code(409).send({ error: "Upload a document first." });
    try {
      return await ask(kb, generator, parsed.data);
    } catch (err) {
      req.log.error(err);
      return reply.code(502).send({ error: `The language model request failed: ${(err as Error).message}` });
    }
  });

  if (webDir && existsSync(webDir)) {
    await app.register(fastifyStatic, { root: resolve(webDir) });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") ? reply.code(404).send({ error: "Not found" }) : reply.sendFile("index.html"),
    );
  }
  return app;
}
