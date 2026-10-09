import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState } from "react";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Renders one PDF page with pdf.js and highlights the cited sentence on it,
 * so the reader can verify the answer against the original in one glance.
 */
export function PageView({ url, page, highlight }: { url: string; page: number; highlight?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = getDocument({ url });
    const el = host.current;
    setError(null);

    (async () => {
      try {
        const pdf = await task.promise;
        const p = await pdf.getPage(Math.min(page, pdf.numPages));
        if (!el || cancelled) return;
        el.replaceChildren();
        const width = el.clientWidth;
        const base = p.getViewport({ scale: 1 });
        const scale = width / base.width;
        const dpr = window.devicePixelRatio || 1;
        const viewport = p.getViewport({ scale: scale * dpr });

        const wrap = document.createElement("div");
        wrap.className = "page-wrap";
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${width}px`;
        wrap.appendChild(canvas);
        el.appendChild(wrap);
        await p.render({ canvas, viewport }).promise;
        if (cancelled || !highlight) return;

        // Highlight text items that belong to the cited sentence.
        const words = new Set(normalise(highlight).split(" ").filter((w) => w.length > 3));
        const content = await p.getTextContent();
        const cssViewport = p.getViewport({ scale });
        let first: HTMLDivElement | null = null;
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const itemWords = normalise(item.str).split(" ").filter((w) => w.length > 3);
          if (!itemWords.length) continue;
          const hits = itemWords.filter((w) => words.has(w)).length;
          if (hits / itemWords.length < 0.6) continue;
          const [x, y] = cssViewport.convertToViewportPoint(item.transform[4], item.transform[5]);
          const h = (item.height || 10) * scale;
          const mark = document.createElement("div");
          mark.className = "hl";
          Object.assign(mark.style, {
            left: `${x}px`,
            top: `${y - h}px`,
            width: `${item.width * scale}px`,
            height: `${h * 1.25}px`,
          });
          wrap.appendChild(mark);
          first ??= mark;
        }
        first?.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [url, page, highlight]);

  return (
    <div className="page-view">
      {error && <p className="banner error">Could not render the page: {error}</p>}
      <div ref={host} />
    </div>
  );
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9.%,\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
