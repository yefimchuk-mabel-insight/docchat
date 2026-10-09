import { Fragment, useEffect, useRef, useState } from "react";
import type { Answer, Citation, Message } from "../types";

const SUGGESTIONS = [
  "How many vacation days do employees get?",
  "How much notice is needed to terminate the agreement?",
  "What happens if availability drops below 99%?",
  "What does error E3 mean on the thermostat?",
  "What is the CEO's salary?",
];

interface Props {
  messages: Message[];
  asking: boolean;
  disabled: boolean;
  activeSource: Citation | null;
  onAsk: (q: string) => void;
  onSource: (c: Citation) => void;
  onClear: () => void;
}

export function Chat({ messages, asking, disabled, activeSource, onAsk, onSource, onClear }: Props) {
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, asking]);

  const submit = (q: string) => {
    const question = q.trim();
    if (!question || asking || disabled) return;
    setText("");
    onAsk(question);
  };

  return (
    <main className="chat">
      <div className="thread">
        {messages.length === 0 ? (
          <div className="welcome">
            <h1>Ask your documents anything.</h1>
            <p className="muted">
              Answers come only from the PDFs on the left, and every claim links to the page it came from. If the
              documents don't say, docchat says so instead of guessing.
            </p>
            {!disabled && (
              <div className="suggestions">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => submit(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="msg user">
                {m.content}
              </div>
            ) : m.role === "error" ? (
              <div key={i} className="msg error">
                {m.content}
              </div>
            ) : (
              <AssistantMessage key={i} answer={m.answer} active={activeSource} onSource={onSource} />
            ),
          )
        )}
        {asking && (
          <div className="msg assistant thinking" aria-live="polite">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
      >
        {messages.length > 0 && (
          <button type="button" className="ghost" onClick={onClear} title="New conversation">
            ↺
          </button>
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={disabled ? "Add a document to start" : "Ask a question about your documents…"}
          disabled={disabled}
          aria-label="Question"
        />
        <button type="submit" className="send" disabled={!text.trim() || asking || disabled}>
          Ask
        </button>
      </form>
    </main>
  );
}

function AssistantMessage({ answer, active, onSource }: { answer: Answer; active: Citation | null; onSource: (c: Citation) => void }) {
  const byN = new Map(answer.citations.map((c) => [c.n, c]));

  // Turn "[2]" markers into clickable chips.
  const parts = answer.answer.split(/(\[\d+\])/g).map((part, i) => {
    const m = part.match(/^\[(\d+)\]$/);
    const c = m ? byN.get(Number(m[1])) : undefined;
    if (!c) return <Fragment key={i}>{part}</Fragment>;
    return (
      <button
        key={i}
        className={`chip ${active?.docId === c.docId && active.page === c.page && active.n === c.n ? "on" : ""}`}
        onClick={() => onSource(c)}
        title={`${c.docName}, page ${c.page}`}
      >
        {c.n}
      </button>
    );
  });

  return (
    <div className={`msg assistant ${answer.found ? "" : "not-found"}`}>
      <p className="answer">{parts}</p>
      {answer.citations.length > 0 && (
        <div className="sources">
          {answer.citations.map((c) => (
            <button key={c.n} className="source" onClick={() => onSource(c)}>
              <span className="cite-num">{c.n}</span>
              <span>
                <strong>{c.docName}</strong> <span className="muted">p. {c.page}</span>
                <span className="snippet">“{c.snippet}”</span>
              </span>
            </button>
          ))}
        </div>
      )}
      <details className="why">
        <summary>
          {answer.model} · {answer.durationMs} ms · {answer.retrieved.length} passage{answer.retrieved.length === 1 ? "" : "s"} retrieved
        </summary>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Document</th>
              <th>Page</th>
              <th>Lexical</th>
              <th>Semantic</th>
            </tr>
          </thead>
          <tbody>
            {answer.retrieved.map((r) => (
              <tr key={r.n}>
                <td>{r.n}</td>
                <td>{r.docName}</td>
                <td>{r.page}</td>
                <td>{r.lexical.toFixed(2)}</td>
                <td>{r.semantic == null ? "–" : r.semantic.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
