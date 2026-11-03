import type { KeyboardEvent } from "react";
import "./tabs.css";

export type TabItem = { key: string; label: string; count?: number };
type Props = { label: string; tabs: TabItem[]; active: string; onChange: (key: string) => void; idPrefix?: string };

/** An ARIA tablist (arrows, Home, End). The caller owns the selection, so it can live in the URL. */
export function Tabs({ label, tabs, active, onChange, idPrefix = "tab" }: Props) {
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = tabs.findIndex((t) => t.key === active);
    const next = { ArrowRight: at + 1, ArrowLeft: at - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    if (!tab) return;
    onChange(tab.key);
    document.getElementById(`${idPrefix}-${tab.key}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={move}>
      {tabs.map((t) => (
        <button
          key={t.key}
          id={`${idPrefix}-${t.key}`}
          role="tab"
          type="button"
          className="tab"
          aria-selected={t.key === active}
          aria-controls={`${idPrefix}-panel-${t.key}`}
          tabIndex={t.key === active ? 0 : -1}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count !== undefined && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
