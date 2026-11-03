import { Link } from "react-router";
import { useSession } from "../api/session";
import { useT } from "../i18n";
import { Empty } from "../ui/panel";

export type Bucket = { start: string; succeeded: number; failed: number; running: number; queued: number };

const STEPS = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

// The axis tops out at four equal steps of a round number (the server's ceiling).
function ceiling(max: number): number {
  if (max === 0) return 4;
  for (const s of STEPS) if (s * 4 >= max) return s * 4;
  return Math.ceil(max / 4000) * 4000;
}

/** Runs per hour or per day as stacked columns; each column leads to that slice in the run list. */
export function RunsChart({ buckets, grain }: { buckets: Bucket[]; grain: "hour" | "day" }) {
  const { t } = useT();
  const { lang } = useSession();
  if (buckets.length === 0) return <Empty text={t("chart.empty")} hint="brevis scheduler" />;

  const day = grain === "day";
  const hours = (iso: string) => new Date(iso).getHours();
  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(lang, { month: "short", day: "numeric", timeZone: "UTC" });
  const span = day ? 86_400_000 : 3_600_000;
  const totals = buckets.map((b) => b.succeeded + b.failed + b.running + b.queued);
  const top = ceiling(Math.max(...totals));
  const every = Math.floor(buckets.length / 6) + 1;
  const title = day ? t("chart.per_day") : t("chart.per_hour");
  const slice = (b: Bucket) => (day ? dayLabel(b.start) : `${hours(b.start)}h–${hours(new Date(new Date(b.start).getTime() + span).toISOString())}h`);
  const tip = (b: Bucket) => t("chart.tip", { slice: slice(b), ok: b.succeeded, failed: b.failed, running: b.running + b.queued });
  const link = (b: Bucket) => {
    const q = new URLSearchParams({ from: new Date(b.start).toISOString().replace(".000", ""), to: new Date(new Date(b.start).getTime() + span).toISOString().replace(".000", "") });
    return `/runs?${q}`;
  };

  return (
    <figure className="chart" aria-label={title}>
      <div className="chart-y" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} style={{ bottom: `${i * 25}%` }}>{(top * i) / 4}</span>
        ))}
      </div>
      <div className="chart-plot">
        {buckets.map((b, i) => (
          <Link key={b.start} to={link(b)} className="chart-band" title={tip(b)} aria-label={tip(b)}>
            <span className="chart-bar" style={{ height: `${(totals[i]! / top) * 100}%`, minHeight: totals[i] ? 2 : 0 }}>
              <i style={{ flexGrow: b.succeeded, background: "var(--st-success)" }} />
              <i style={{ flexGrow: b.failed, background: "var(--st-failed)" }} />
              <i style={{ flexGrow: b.running + b.queued, background: "var(--st-running)" }} />
            </span>
          </Link>
        ))}
      </div>
      <div className="chart-x" aria-hidden="true">
        {buckets.map((b, i) => (
          <span key={b.start}>{i % every === 0 ? <span>{day ? dayLabel(b.start) : `${hours(b.start)}h`}</span> : null}</span>
        ))}
      </div>
      <figcaption className="chart-legend">
        <span><i style={{ background: "var(--st-success)" }} />{t("chart.success")}</span>
        <span><i style={{ background: "var(--st-failed)" }} />{t("chart.failed")}</span>
        <span><i style={{ background: "var(--st-running)" }} />{t("chart.running")}</span>
      </figcaption>
    </figure>
  );
}
