import type { ReactNode } from "react";
import "./panel.css";

type PanelProps = { title: string; hint?: string; children: ReactNode };

/** A titled box. hint sits at the right of the title (a count, a short note). */
export function Panel({ title, hint, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        {hint && <span className="panel-hint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return <p className="panel-empty">{children}</p>;
}

type KVProps = { items: { key: string; value: string; note?: string }[] };

/** Key/value rows: a description list, mono keys, an optional note under the value. */
export function KV({ items }: KVProps) {
  return (
    <dl className="kv">
      {items.map((i) => (
        <div key={i.key} style={{ display: "contents" }}>
          <dt>{i.key}</dt>
          <dd>
            {i.value}
            {i.note && <span className="note">{i.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
