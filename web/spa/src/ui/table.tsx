import type { ReactNode } from "react";

// The console's table, drawn as the server draws it: a bordered card, the
// `ct` rows (34px, hairlines between), columns that give way by width and
// never turn into cards. Rows are whole links to their page through `Row`.

/** The card around a table; `foot` is the honest line under it. */
export function Table({ id, head, children, foot, catalog }: { id?: string; head: ReactNode; children: ReactNode; foot?: ReactNode; catalog?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-card border border-line bg-surface ${catalog ? "shadow-warm-sm" : ""}`}>
      <div className="overflow-x-auto">
        <table id={id} className={`ct w-full ${catalog ? "text-sm" : "text-[13px]"}`}>
          <thead>
            <tr className={`border-b border-line text-left text-[11.5px] font-medium ${catalog ? "bg-parchment-soft/60 text-faint" : "text-muted"}`}>{head}</tr>
          </thead>
          <tbody className="divide-y divide-line-soft">{children}</tbody>
        </table>
      </div>
      {foot ? <p className="border-t border-line-soft px-4 py-2.5 text-[12px] text-faint">{foot}</p> : null}
    </div>
  );
}

/** A column header. `edge` pads the first or last column to the card's edge; `cls` carries the width it gives way at. */
export function Th({ children, edge, cls = "" }: { children?: ReactNode; edge?: "first" | "last"; cls?: string }) {
  const pad = edge === "first" ? "pl-4" : edge === "last" ? "pr-4" : "";
  return <th className={`px-2.5 py-2 font-medium ${pad} ${cls}`.replace(/\s+/g, " ").trim()}>{children}</th>;
}

export function Td({ children, edge, cls = "", title }: { children?: ReactNode; edge?: "first" | "last"; cls?: string; title?: string }) {
  const pad = edge === "first" ? "pl-4" : edge === "last" ? "pr-4" : "";
  return (
    <td title={title} className={`px-2.5 py-3 ${pad} ${cls}`.replace(/\s+/g, " ").trim()}>
      {children}
    </td>
  );
}

/** A row that opens its page when clicked anywhere; its own links stay real links. */
export function Row({ onOpen, children }: { onOpen: () => void; children: ReactNode }) {
  return (
    <tr
      className="cursor-pointer align-top transition-colors hover:bg-hover"
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button")) onOpen();
      }}
    >
      {children}
    </tr>
  );
}
