import type { ReactNode } from "react";
import "./table.css";

/**
 * A data table that stacks into cards under 768px. Each Td names its column
 * (`label`) for the card, where the header row is gone; `hide` drops a column
 * from the table between 768px and the breakpoint it names ("md" < 960px,
 * "lg" < 1100px, "xl" < 1280px) and keeps it in the card.
 */
export function Table({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className="dt-wrap">
      <table className="dt" id={id}>
        {children}
      </table>
    </div>
  );
}

type Hide = "md" | "lg" | "xl";

export function Th({ children, hide, className = "" }: { children?: ReactNode; hide?: Hide; className?: string }) {
  return (
    <th scope="col" className={`${hide ? `dt-hide-${hide}` : ""} ${className}`.trim()}>
      {children}
    </th>
  );
}

export function Td({ label, hide, className = "", children }: { label?: string; hide?: Hide; className?: string; children?: ReactNode }) {
  return (
    <td data-label={label} className={`${hide ? `dt-hide-${hide}` : ""} ${className}`.trim()}>
      {children}
    </td>
  );
}
