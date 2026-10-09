import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ExtractiveGenerator, NOT_FOUND, type Generator } from "../src/providers/generators.js";
import { ask, cleanCitations, retrievalQuery } from "../src/rag/ask.js";
import { chunkPages, rebuildParagraphs } from "../src/rag/chunk.js";
import { KnowledgeBase } from "../src/rag/knowledge-base.js";
import { stem, tokenize } from "../src/rag/text.js";

const samplesDir = join(import.meta.dirname, "..", "..", "samples");

describe("text processing", () => {
  it("stems word families together", () => {
    expect(stem("capped")).toBe(stem("cap"));
    expect(stem("termination")).toBe(stem("terminate"));
    expect(stem("policies")).toBe("policy");
  });

  it("drops question filler and normalises numbers", () => {
    expect(tokenize("How many vacation days do employees get?")).toEqual(["vacation", "days", "employees"].map(stem));
    expect(tokenize("below 99.0%")).toContain("99");
  });

  it("re-joins lines that the PDF layout wrapped, but keeps headings and bullets apart", () => {
    const lines = [
      "2. Paid time off",
      "Full-time employees receive 25 days of paid vacation per year, plus the public holidays of their",
      "country of residence.",
      "• E1: Temperature sensor fault.",
      "• E2: No power.",
    ];
    expect(rebuildParagraphs(lines)).toEqual([
      "2. Paid time off",
      "Full-time employees receive 25 days of paid vacation per year, plus the public holidays of their country of residence.",
      "• E1: Temperature sensor fault.",
      "• E2: No power.",
    ]);
  });

  it("chunks never cross pages", () => {
    const chunks = chunkPages("d", "doc.pdf", ["A. ".repeat(500), "B. ".repeat(500)], { size: 300, overlap: 50 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) expect(c.text.includes("A") && c.text.includes("B")).toBe(false);
  });
});

describe("citations", () => {
  it("keeps valid citation markers and drops hallucinated ones", () => {
    const { text, cited } = cleanCitations("Notice is 90 days [2]. Fees rise 5% [7][1, 9].", 3);
    expect(text).toBe("Notice is 90 days [2]. Fees rise 5% [1].");
    expect(cited).toEqual([1, 2]);
  });

  it("uses the previous question to retrieve for short follow-ups", () => {
    const history = [{ role: "user" as const, content: "How much is the learning budget?" }];
    expect(retrievalQuery("and days?", history)).toContain("learning budget");
    expect(retrievalQuery("What is the warranty period for the thermostat?", history)).not.toContain("learning");
  });
});

describe("question answering over the sample documents (offline mode)", () => {
  const kb = new KnowledgeBase();
  const gen = new ExtractiveGenerator();

  beforeAll(async () => {
    for (const f of readdirSync(samplesDir).filter((f) => f.endsWith(".pdf"))) {
      await kb.add(f, new Uint8Array(readFileSync(join(samplesDir, f))), true);
    }
  });

  // [question, expected text in the answer, expected document, expected page]
  const cases: [string, string, string, number][] = [
    ["How many vacation days do employees get?", "25 days", "employee-handbook.pdf", 1],
    ["What is the home office budget?", "EUR 1,200", "employee-handbook.pdf", 2],
    ["How long is parental leave?", "20 weeks", "employee-handbook.pdf", 2],
    ["How much notice is needed to terminate the agreement for convenience?", "90 days", "master-services-agreement.pdf", 3],
    ["What happens if availability drops below 99%?", "25%", "master-services-agreement.pdf", 2],
    ["What is the liability cap?", "12 months", "master-services-agreement.pdf", 3],
    ["How do I factory reset the thermostat?", "10 seconds", "thermostat-t3-manual.pdf", 3],
    ["What does error E3 mean?", "Wi-Fi connection lost", "thermostat-t3-manual.pdf", 2],
    ["Does the thermostat work with 5 GHz Wi-Fi?", "2.4 GHz", "thermostat-t3-manual.pdf", 1],
  ];

  it.each(cases)("%s", async (question, expected, doc, page) => {
    const a = await ask(kb, gen, { question });
    expect(a.found).toBe(true);
    expect(a.answer).toContain(expected);
    expect(a.citations[0]).toMatchObject({ docName: doc, page });
  });

  it.each(["What is the capital of France?", "What is the CEO's salary?", "Who won the 2022 World Cup?"])(
    "refuses when the documents don't cover it: %s",
    async (question) => {
      const a = await ask(kb, gen, { question });
      expect(a.found).toBe(false);
      expect(a.citations).toEqual([]);
    },
  );

  it("restricts search to selected documents", async () => {
    const thermostat = kb.list().find((d) => d.name.startsWith("thermostat"))!;
    const a = await ask(kb, gen, { question: "How many vacation days do employees get?", docIds: [thermostat.id] });
    expect(a.found).toBe(false);
  });

  it("trusts an LLM's refusal and never shows uncited model text as sourced", async () => {
    const refusing: Generator = { name: "stub", generate: async () => NOT_FOUND };
    expect((await ask(kb, refusing, { question: "What is the home office budget?" })).found).toBe(false);

    const sloppy: Generator = { name: "stub", generate: async () => "The budget is EUR 1,200 [1][42]." };
    const a = await ask(kb, sloppy, { question: "What is the home office budget?" });
    expect(a.answer).toBe("The budget is EUR 1,200 [1].");
    expect(a.citations.map((c) => c.n)).toEqual([1]);
  });
});
