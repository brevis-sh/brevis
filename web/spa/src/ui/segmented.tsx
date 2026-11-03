import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icon } from "./icon";

export type Choice = { key: string; label: ReactNode; to: string; current: boolean };

/** A filter with few values drawn as one control; every choice is a link, so the filter is a URL. */
export function Segmented({ label, choices, className = "" }: { label: string; choices: Choice[]; className?: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`inline-flex h-8 max-w-full shrink-0 items-center gap-0.5 overflow-x-auto rounded-card border border-line bg-surface p-0.5 ${className}`}
    >
      {choices.map((c) => (
        <Link
          key={c.key}
          to={c.to}
          aria-current={c.current ? "true" : undefined}
          className={`inline-flex h-full shrink-0 items-center gap-1.5 rounded-[2px] px-2.5 text-[0.8rem] whitespace-nowrap ${
            c.current ? "bg-surface-2 font-medium text-ink" : "text-muted transition-colors hover:text-ink"
          }`}
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

/** A list's search box: type="search", labelled, never submitted. */
export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()}>
      <label className="relative flex min-w-0 items-center">
        <span className="pointer-events-none absolute left-2.5 text-faint">
          <Icon name="search" className="h-4 w-4" />
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={label}
          aria-label={label}
          maxLength={200}
          autoComplete="off"
          className="h-8 w-full rounded-card border border-line bg-surface pr-9 pl-8 text-[0.82rem] text-ink placeholder:text-faint focus:border-accent-strong focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2">
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-card border border-line bg-surface-2 px-1 font-mono text-[0.68rem] leading-none text-muted">/</kbd>
        </span>
      </label>
    </form>
  );
}

/** A switch that is a link: its state is a URL. */
export function Switch({ on, to, children }: { on: boolean; to: string; children: ReactNode }) {
  return (
    <Link to={to} role="switch" aria-checked={on} className="inline-flex items-center gap-2 text-[12.5px] text-ink-2">
      <span className="switch" aria-checked={on}>
        <span className="switch-knob" aria-hidden="true" />
      </span>
      {children}
    </Link>
  );
}

/** One choice of a status band: its mark, its word and its count; the rule it states is the tooltip. */
export function Band({ to, current, tip, mark, label, count }: { to: string; current: boolean; tip?: string; mark?: ReactNode; label: string; count?: number | null }) {
  return (
    <Link
      to={to}
      title={tip}
      aria-current={current ? "true" : undefined}
      className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[12.5px] transition-colors ${
        current ? "border-ink text-ink" : "border-line text-ink-2 hover:border-line-strong"
      }`}
    >
      {mark}
      <span>{label}</span>
      {count == null ? null : <span className="font-semibold text-ink tabular-nums">{count}</span>}
    </Link>
  );
}
