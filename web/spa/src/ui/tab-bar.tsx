import type { KeyboardEvent } from "react";
import "./wf-ui.css";

export type TabItem = { key: string; label: string; count?: number };

// TabBar is an ARIA tablist: arrows move between tabs, the selected one is the
// only tab stop. The panels are the caller's (id `panel-<key>`).
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
    <div className="tabs" role="tablist" aria-label={label}>
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
        >
          {tab.label}
          {tab.count !== undefined && <small>{tab.count}</small>}
        </button>
      ))}
    </div>
  );
}
