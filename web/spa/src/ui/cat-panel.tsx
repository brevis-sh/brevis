import type { ReactNode } from "react";
import "./cat-panel.css";

/** A titled card, with an optional count or note beside the title. */
export function Panel({ title, note, children, id }: { title: ReactNode; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="cat-panel" id={id}>
      <header className="cat-panel-head">
        <h2>{title}</h2>
        {note ? <span className="cat-muted">{note}</span> : null}
      </header>
      {children}
    </section>
  );
}
