import type { ReactNode } from "react";
import "./table.css";

// Explicit roles: the card layout on a phone is display:block, which some
// browsers answer by dropping the table semantics.

/** The table; see table.css. `label` names it for assistive tech. */
export function Rt({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <table className="rt" role="table" aria-label={label}>
      <thead role="rowgroup">
        <tr role="row">{head}</tr>
      </thead>
      <tbody role="rowgroup">{children}</tbody>
    </table>
  );
}

/** A column header. `col` (2..4) is the order columns give way as the screen narrows; num right-aligns. */
export function Th({ children, col, num }: { children?: ReactNode; col?: 2 | 3 | 4; num?: boolean }) {
  return (
    <th role="columnheader" scope="col" className={[col && `rt-c${col}`, num && "rt-num"].filter(Boolean).join(" ") || undefined}>
      {children}
    </th>
  );
}

/** A cell. `label` is the column's name on a card; `head` makes it the card's title. */
export function Td({ children, label, head, col, num }: { children?: ReactNode; label?: string; head?: boolean; col?: 2 | 3 | 4; num?: boolean }) {
  const cls = [head && "rt-head", col && `rt-c${col}`, num && "rt-num"].filter(Boolean).join(" ") || undefined;
  return (
    <td role="cell" data-label={head ? undefined : label} className={cls}>
      {children}
    </td>
  );
}
