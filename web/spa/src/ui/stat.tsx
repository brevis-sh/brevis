import type { ReactNode } from "react";
import { Skeleton } from "./skeleton";
import "./ov-status.css";
import "./stat.css";

export type StatProps = {
  label: string;
  /** A second label beside the first ("last 24 hours"). */
  sub?: string;
  /** A CSS colour for the dot before the label. */
  dot?: string;
  value: ReactNode;
  /** A CSS colour for the value. */
  tone?: string;
  note?: ReactNode;
  foot?: ReactNode;
  /** 0..1: a bar under the value. */
  bar?: number;
};

/** The numbers strip: cells of at least 9.5rem, as many to a row as fit. */
export function Stats({ items, label }: { items: StatProps[]; label?: string }) {
  return (
    <dl className="stats" aria-label={label}>
      {items.map((s) => (
        <div className="stat" key={s.label}>
          <dt>
            {s.dot && <i style={{ ["--c" as string]: s.dot }} />}
            <span>{s.label}</span>
            {s.sub && <span>· {s.sub}</span>}
          </dt>
          <dd>
            <div className="stat-value" style={s.tone ? { color: s.tone } : undefined}>
              {s.value}
            </div>
            {s.note && <div className="stat-note">{s.note}</div>}
            {s.bar !== undefined && (
              <div className="stat-bar" aria-hidden="true">
                <span style={{ width: `${Math.round(s.bar * 100)}%` }} />
              </div>
            )}
            {s.foot && <div className="stat-foot">{s.foot}</div>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The same grid and cell height, for the loading state. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="stats" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="stat" key={i}>
          <Skeleton w="45%" h=".75rem" />
          <div style={{ marginTop: ".5rem" }}>
            <Skeleton w="35%" h="1.4rem" />
          </div>
          <div style={{ marginTop: ".4rem" }}>
            <Skeleton w="60%" h=".75rem" />
          </div>
        </div>
      ))}
    </div>
  );
}
