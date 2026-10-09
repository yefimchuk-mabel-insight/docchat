import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { Chat } from "./components/Chat";
import { DocList } from "./components/DocList";
import { PageView } from "./components/PageView";
import type { Citation, DocumentMeta, Message } from "./types";

export function App() {
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [scope, setScope] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Message[]>([]);
  const [asking, setAsking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [engine, setEngine] = useState<{ generator: string; embeddings: string | null } | null>(null);
  const [source, setSource] = useState<Citation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewer = useRef<HTMLElement>(null);

  useEffect(() => {
    api.health().then(setEngine).catch(() => setEngine(null));
    api.documents().then(setDocs).catch((e) => setError(e.message));
  }, []);

  const upload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        const doc = await api.upload(f);
        setDocs((d) => [...d, doc]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: string) => {
    await api.remove(id);
    setDocs((d) => d.filter((x) => x.id !== id));
    setScope((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
    if (source?.docId === id) setSource(null);
  };

  const askQuestion = async (question: string) => {
    const history = messages
      .filter((m): m is Extract<Message, { role: "user" | "assistant" }> => m.role !== "error")
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setAsking(true);
    try {
      const answer = await api.ask(question, history, scope.size ? [...scope] : undefined);
      setMessages((m) => [...m, { role: "assistant", content: answer.answer, answer }]);
      if (answer.citations[0]) setSource(answer.citations[0]);
    } catch (e) {
      setMessages((m) => [...m, { role: "error", content: (e as Error).message }]);
    } finally {
      setAsking(false);
    }
  };

  const openSource = (c: Citation) => {
    setSource(c);
    if (window.innerWidth < 1100) viewer.current?.scrollIntoView({ behavior: "smooth" });
  };

  const engineLabel = !engine
    ? ""
    : engine.generator.includes("no API key")
      ? "Demo mode · offline retrieval"
      : `LLM · ${engine.generator}${engine.embeddings ? " · hybrid search" : ""}`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ❝
          </span>
          docchat
        </div>
        <span className="tagline">Answers from your documents, with the page to prove it</span>
        {engineLabel && <span className={`pill ${engine?.generator.includes("no API key") ? "" : "ok"}`}>{engineLabel}</span>}
      </header>

      {error && (
        <div className="banner error top" role="alert">
          {error}
        </div>
      )}

      <div className="layout">
        <DocList
          docs={docs}
          scope={scope}
          uploading={uploading}
          onToggle={(id) =>
            setScope((s) => {
              const next = new Set(s);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onUpload={upload}
          onRemove={remove}
          onSamples={() => api.loadSamples().then(setDocs).catch((e) => setError(e.message))}
        />

        <Chat
          messages={messages}
          asking={asking}
          disabled={docs.length === 0}
          activeSource={source}
          onAsk={askQuestion}
          onSource={openSource}
          onClear={() => {
            setMessages([]);
            setSource(null);
          }}
        />

        <aside className="viewer" ref={viewer} aria-label="Source page">
          {source ? (
            <>
              <div className="viewer-head">
                <span className="cite-num">{source.n}</span>
                <div>
                  <strong>{source.docName}</strong>
                  <span className="muted"> · page {source.page}</span>
                </div>
              </div>
              <blockquote className="quote">{source.snippet}</blockquote>
              <PageView url={api.fileUrl(source.docId)} page={source.page} highlight={source.snippet} />
            </>
          ) : (
            <div className="viewer-empty">
              <div className="viewer-icon" aria-hidden>
                ⌕
              </div>
              <p>Click a citation to see the exact page and passage the answer came from.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
