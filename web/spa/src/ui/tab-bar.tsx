import type { KeyboardEvent, ReactNode } from "react";

export type TabItem = { key: string; label: string; count?: ReactNode };

// components.Tabs as an ARIA tablist: arrows move between tabs, the selected one
// is the only tab stop. The panels are the caller's (id `panel-<key>`).
export function TabBar({ label, tabs, current, onSelect }: { label: string; tabs: TabItem[]; current: string; onSelect: (key: string) => void }) {
  const move = (e: KeyboardEvent, i: number) => {
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    if (tab) {
      onSelect(tab.key);
      document.getElementById(`tab-${tab.key}`)?.focus();
    }
  };
  return (
    <div role="tablist" aria-label={label} className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-line-soft">
      {tabs.map((tab, i) => (
        <button
          key={tab.key}
          id={`tab-${tab.key}`}
          role="tab"
          type="button"
          aria-selected={tab.key === current}
          aria-controls={`panel-${tab.key}`}
          tabIndex={tab.key === current ? 0 : -1}
          onClick={() => onSelect(tab.key)}
          onKeyDown={(e) => move(e, i)}
          className="-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-[0.82rem] whitespace-nowrap text-muted transition-colors duration-150 hover:text-ink aria-selected:border-ink aria-selected:text-ink"
        >
          {tab.label}
          {tab.count !== undefined && <span className="ml-1.5 inline-flex items-center font-mono text-[11px] text-faint tabular-nums">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}
