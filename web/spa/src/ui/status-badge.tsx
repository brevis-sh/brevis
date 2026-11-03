import "./status-badge.css";

type Props = { status: string; label?: string; attempt?: number };

/** A run's or step's state: a colored dot and its word. attempt (from 0) adds the retry mark. */
export function StatusBadge({ status, label, attempt = 0 }: Props) {
  return (
    <span className={`run-st st-${status || "pending"}`}>
      {label ?? status}
      {attempt > 0 && <span className="st-retry">↻{attempt + 1}</span>}
    </span>
  );
}
