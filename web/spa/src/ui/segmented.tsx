import type { ReactNode } from "react";
import { Link } from "react-router";
import "./controls.css";

export type Choice = { key: string; label: ReactNode; to: string; current: boolean };

/** A group of links, one current: a filter whose every choice is a URL. */
export function Segmented({ label, choices }: { label: string; choices: Choice[] }) {
  return (
    <div role="group" aria-label={label} className="seg">
      {choices.map((c) => (
        <Link key={c.key} to={c.to} aria-current={c.current ? "true" : undefined} className="seg-opt">
          {c.label}
        </Link>
      ))}
    </div>
  );
}

/** The search box of a list: type="search", labelled, never submitted. */
export function SearchBox({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <form role="search" className="searchbox" onSubmit={(e) => e.preventDefault()}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        maxLength={200}
        autoComplete="off"
      />
    </form>
  );
}
