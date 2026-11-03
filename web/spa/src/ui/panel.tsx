import type { ReactNode } from "react";
import "./panel.css";

/** A titled card; `action` sits at the end of its header. */
export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-head">
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** What a list says when it has nothing to list, with the command that fills it. */
export function Empty({ text, hint }: { text: string; hint?: string }) {
  return (
    <div className="empty">
      <span>{text}</span>
      {hint && <code>{hint}</code>}
    </div>
  );
}
