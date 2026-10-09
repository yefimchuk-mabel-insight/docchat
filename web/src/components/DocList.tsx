import { useRef, useState } from "react";
import type { DocumentMeta } from "../types";

interface Props {
  docs: DocumentMeta[];
  scope: Set<string>;
  uploading: boolean;
  onToggle: (id: string) => void;
  onUpload: (files: FileList) => void;
  onRemove: (id: string) => void;
  onSamples: () => void;
}

export function DocList({ docs, scope, uploading, onToggle, onUpload, onRemove, onSamples }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <nav className="docs" aria-label="Documents">
      <div className="section-title">
        Documents <span className="muted">{docs.length}</span>
      </div>

      <div
        className={`drop ${over ? "over" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) onUpload(e.dataTransfer.files);
        }}
      >
        <input
          ref={input}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => e.target.files?.length && onUpload(e.target.files)}
        />
        {uploading ? "Indexing…" : "+ Add PDFs"}
      </div>

      {docs.length === 0 ? (
        <div className="empty-docs">
          <p className="muted">No documents yet.</p>
          <button className="link" onClick={onSamples}>
            Load the sample documents
          </button>
        </div>
      ) : (
        <>
          <p className="hint muted">{scope.size ? `Searching ${scope.size} selected` : "Searching all documents"}</p>
          <ul>
            {docs.map((d) => (
              <li key={d.id} className={scope.has(d.id) ? "on" : ""}>
                <label>
                  <input type="checkbox" checked={scope.has(d.id)} onChange={() => onToggle(d.id)} />
                  <span className="doc-icon" aria-hidden>
                    PDF
                  </span>
                  <span className="doc-name">
                    <span title={d.name}>{d.name}</span>
                    <span className="muted small">
                      {d.pageCount} pages · {d.chunkCount} passages
                    </span>
                  </span>
                </label>
                <button className="x" aria-label={`Remove ${d.name}`} onClick={() => onRemove(d.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </nav>
  );
}
