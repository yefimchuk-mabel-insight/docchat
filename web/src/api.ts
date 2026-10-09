import type { Answer, DocumentMeta } from "./types";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  health: () => fetch("/api/health").then((r) => json<{ generator: string; embeddings: string | null }>(r)),
  documents: () => fetch("/api/documents").then((r) => json<DocumentMeta[]>(r)),
  loadSamples: () => fetch("/api/documents/samples", { method: "POST" }).then((r) => json<DocumentMeta[]>(r)),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return fetch("/api/documents", { method: "POST", body: form }).then((r) => json<DocumentMeta>(r));
  },
  remove: (id: string) => fetch(`/api/documents/${id}`, { method: "DELETE" }).then((r) => json<{ ok: true }>(r)),
  fileUrl: (id: string) => `/api/documents/${id}/file`,
  ask: (question: string, history: { role: "user" | "assistant"; content: string }[], docIds?: string[]) =>
    fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, history, docIds }),
    }).then((r) => json<Answer>(r)),
};
