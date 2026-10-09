import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { ExtractiveGenerator } from "../src/providers/generators.js";
import { KnowledgeBase } from "../src/rag/knowledge-base.js";

const samplesDir = join(import.meta.dirname, "..", "..", "samples");

function multipart(fileName: string, body: Buffer) {
  const boundary = "----docchat";
  const payload = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`),
    body,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { payload, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

describe("API", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp({ kb: new KnowledgeBase(), generator: new ExtractiveGenerator(), samplesDir, preloadSamples: false });
  });
  afterAll(() => app.close());

  it("asks for a document before answering", async () => {
    const res = await app.inject({ method: "POST", url: "/api/ask", payload: { question: "Anything?" } });
    expect(res.statusCode).toBe(409);
  });

  it("uploads a PDF, answers with a page citation, serves the file, and deletes it", async () => {
    const pdf = readFileSync(join(samplesDir, "master-services-agreement.pdf"));
    const up = await app.inject({ method: "POST", url: "/api/documents", ...multipart("msa.pdf", pdf) });
    expect(up.statusCode).toBe(200);
    const doc = up.json();
    expect(doc).toMatchObject({ name: "msa.pdf", pageCount: 3 });

    const a = (await app.inject({ method: "POST", url: "/api/ask", payload: { question: "When are invoices payable?" } })).json();
    expect(a.found).toBe(true);
    expect(a.answer).toContain("30 days");
    expect(a.citations[0]).toMatchObject({ docName: "msa.pdf", page: 1 });

    const file = await app.inject({ method: "GET", url: `/api/documents/${doc.id}/file` });
    expect(file.headers["content-type"]).toBe("application/pdf");

    expect((await app.inject({ method: "DELETE", url: `/api/documents/${doc.id}` })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/documents" })).json()).toEqual([]);
  });

  it("loads the samples on request", async () => {
    const docs = (await app.inject({ method: "POST", url: "/api/documents/samples" })).json();
    expect(docs.map((d: { name: string }) => d.name).sort()).toEqual([
      "employee-handbook.pdf",
      "master-services-agreement.pdf",
      "thermostat-t3-manual.pdf",
    ]);
  });

  it("validates input", async () => {
    expect((await app.inject({ method: "POST", url: "/api/ask", payload: { question: "" } })).statusCode).toBe(400);
    const notPdf = await app.inject({ method: "POST", url: "/api/documents", ...multipart("x.pdf", Buffer.from("hi")) });
    expect(notPdf.statusCode).toBe(415);
  });
});
