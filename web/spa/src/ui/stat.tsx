import type { ReactNode } from "react";
import { Skeleton } from "./skeleton";

export type StatProps = {
  label: string;
  /** A second label beside the first ("last 24 hours"). */
  sub?: string;
  /** A token colour for the dot before the label, e.g. "var(--st-success)". */
  dot?: string;
  value?: ReactNode;
  /** A token colour for the value. */
  tone?: string;
  unit?: string;
  note?: ReactNode;
  foot?: ReactNode;
  /** 0..1: a bar under the value. */
  bar?: number;
  title?: string;
  /** The value's place shows a skeleton while the number is on its way; the label never does. */
  loading?: boolean;
};

// The numbers strip (components.Stats): one bordered band, hairlines are the gap
// showing the line colour, cells of at least 150px and as many to a row as fit.
export function Stats({ items, label }: { items: StatProps[]; label?: string }) {
  const cols = items.length === 1 ? "grid-cols-1" : "grid-cols-[repeat(auto-fit,minmax(150px,1fr))]";
  return (
    <dl aria-label={label} className={`grid gap-px overflow-hidden rounded-card border border-line bg-line-soft ${cols}`}>
      {items.map((s) => (
        <div key={s.label} className="min-w-0 bg-surface px-3.5 py-2.5" title={s.title}>
          <dt className="flex items-center gap-1.5 text-[11.5px] whitespace-nowrap text-muted">
            {s.dot && <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: s.dot }} />}
            <span>{s.label}</span>
            {s.sub && <span className="text-faint">· {s.sub}</span>}
          </dt>
          {s.loading ? (
            <>
              <dd className="mt-[3px] text-[18px] leading-[1.2]">
                <Skeleton w="4.5rem" h="1.2em" />
              </dd>
              <dd className="mt-1.5">
                <Skeleton w="60%" h="12px" />
              </dd>
            </>
          ) : (
            <>
              <dd className="mt-[3px] flex flex-wrap items-baseline gap-x-1.5 text-[18px] leading-[1.2] font-semibold tracking-[-0.02em] text-ink tabular-nums">
                <span style={s.tone ? { color: s.tone } : undefined}>{s.value}</span>
                {s.unit && <span className="text-[11.5px] font-normal tracking-normal text-faint">{s.unit}</span>}
                {s.note && <span className="min-w-0 text-[11.5px] font-normal tracking-normal text-faint">{s.note}</span>}
              </dd>
              {s.bar !== undefined && (
                <dd className="mt-[7px] flex h-1 gap-0.5 overflow-hidden rounded-sm bg-surface-2" aria-hidden="true">
                  <i className="block h-full bg-state-success" style={{ width: `${s.bar * 100}%` }} />
                </dd>
              )}
              {s.foot && <dd className="mt-1.5 text-[12px] text-muted">{s.foot}</dd>}
            </>
          )}
        </div>
      ))}
    </dl>
  );
}
