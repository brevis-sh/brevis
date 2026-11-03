import type { ReactNode } from "react";
import "./kv.css";

export type Def = { term: ReactNode; value: ReactNode; mono?: boolean };

/** A definition list: a term and its value per row, one column on a phone and two from 480px. */
export function DefinitionList({ items }: { items: Def[] }) {
  return (
    <dl className="kv">
      {items.map((d, i) => (
        <div key={i}>
          <dt>{d.term}</dt>
          <dd className={d.mono ? "mono" : undefined}>{d.value}</dd>
        </div>
      ))}
    </dl>
  );
}
