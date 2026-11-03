import type { ReactNode } from "react";
import "./panel.css";

/** A titled card, with an optional count or note beside the title. */
export function Panel({ title, note, children, id }: { title: ReactNode; note?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="panel" id={id}>
      <header className="panel-head">
        <h2>{title}</h2>
        {note ? <span className="muted">{note}</span> : null}
      </header>
      {children}
    </section>
  );
}
