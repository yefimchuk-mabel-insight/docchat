import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfText {
  pageCount: number;
  /** Plain text per page, lines rebuilt from glyph positions. */
  pages: string[];
}

interface Glyph {
  str: string;
  x: number;
  y: number;
}

/**
 * Extracts text from a digital (non-scanned) PDF and rebuilds reading-order
 * lines by grouping glyphs that share a baseline. Scanned PDFs return little
 * or no text; those are sent to a vision-capable model instead (see README).
 */
export async function extractPdfText(data: Uint8Array): Promise<PdfText> {
  const task = getDocument({ data, useSystemFonts: true, verbosity: 0 });
  const doc = await task.promise;

  const pages: string[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const glyphs: Glyph[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , , , x, y] = item.transform as number[];
        glyphs.push({ str: item.str, x: x ?? 0, y: y ?? 0 });
      }
      pages.push(toLines(glyphs));
    }
  } finally {
    await task.destroy();
  }
  return { pageCount: pages.length, pages };
}

function toLines(glyphs: Glyph[]): string {
  // Top of page first, then left to right.
  glyphs.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Glyph[][] = [];
  for (const g of glyphs) {
    const line = lines.at(-1);
    if (line && Math.abs((line[0]?.y ?? 0) - g.y) < 3) line.push(g);
    else lines.push([g]);
  }
  return lines
    .map((l) =>
      l
        .sort((a, b) => a.x - b.x)
        .map((g) => g.str)
        .join("  ")
        .replace(/\s{3,}/g, "  ")
        .trim(),
    )
    .join("\n");
}
