import { Suspense, useDeferredValue, useState, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useSession } from "../api/session";
import { useFormat, useT } from "../i18n";
import { until, useNumbers } from "../ui/format";
import { Empty, Panel } from "../ui/ov-panel";
import { QueryBoundary } from "../ui/query-boundary";
import { Skeleton } from "../ui/skeleton";
import { RunsTable, RunsTableSkeleton, type RunRow } from "../ui/runs-table";
import { StatusMark } from "../ui/ov-status";
import { Stats, StatsSkeleton, type StatProps } from "../ui/stat";
import { AttentionSection, AttentionSkeleton, attentionQuery } from "./overview-attention";
import { RunsChart, type Bucket } from "./overview-chart";
import "./overview.css";

const WINDOWS = ["24h", "7d", "30d"] as const;
type WindowKey = (typeof WINDOWS)[number];

type NextRun = { workflow: string; cron: string; cronText: string; timezone: string; when: string; logos: string[] };
type EventRow = { at: string; source: string; before: string; subject: string; after: string; actor: string; href: string; state: string };
type Overview = {
  window: WindowKey;
  grain: "hour" | "day";
  now: string;
  indicators: { succeeded: number; failed: number; running: number; retried: number; meanDurationMs: number };
  queued: number;
  buckets: Bucket[];
  next: NextRun[];
  recent: RunRow[];
  events: EventRow[];
};

function useWindow(): WindowKey {
  const [params] = useSearchParams();
  const w = params.get("window");
  return WINDOWS.find((k) => k === w) ?? "24h";
}

function useOverview(window: WindowKey) {
  return useSuspenseQuery({
    queryKey: ["overview", window],
    queryFn: ({ signal }) => getJSON<Overview>(`/api/overview?window=${window}`, signal),
  }).data;
}

// The three windows as links: the address carries the choice, so it can be shared.
function WindowToggle({ current }: { current: WindowKey }) {
  const { t } = useT();
  return (
    <nav className="ov-window" aria-label={t("window.label")}>
      {WINDOWS.map((k) => (
        <Link key={k} to={{ search: `?window=${k}` }} aria-current={k === current ? "page" : undefined}>
          {t(`window.short.${k}`)}
        </Link>
      ))}
    </nav>
  );
}

// The four numbers: how much passed, what failed, what runs and waits, what fires next.
function Kpis({ o }: { o: Overview }) {
  const { t, n } = useT();
  const f = useFormat();
  const { percent, elapsed } = useNumbers();
  // The "still failing" link needs the attention list, which the section above already follows.
  const attention = useQuery(attentionQuery).data;
  const i = o.indicators;
  const finished = i.succeeded + i.failed;

  const success: StatProps = { label: t("overview.kpi.success"), sub: t(`window.${o.window}`), dot: "var(--st-success)", value: "—" };
  const failures: StatProps = { label: t("overview.kpi.failures"), value: f.number(i.failed) };
  if (finished > 0) {
    success.value = percent(i.succeeded, finished);
    success.note = t("overview.kpi.of", { n: f.number(i.succeeded), total: f.number(finished) });
    success.bar = i.succeeded / finished;
    failures.note = percent(i.failed, finished);
  }
  if (i.retried > 0) success.foot = n("overview.kpi.retried", i.retried);
  if (i.failed > 0) {
    failures.dot = failures.tone = "var(--st-failed)";
  }
  const stillFailing = attention ? attention.items.length + attention.more : 0;
  if (stillFailing > 0) failures.foot = <Link to="/runs?state=failed">{n("overview.kpi.still_failing", stillFailing)} →</Link>;

  const running: StatProps = { label: t("overview.kpi.running"), dot: "var(--st-running)", value: f.number(i.running), note: n("overview.kpi.queued", o.queued) };
  if (i.meanDurationMs > 0) running.foot = t("overview.kpi.mean", { span: elapsed(i.meanDurationMs) });

  const next: StatProps = { label: t("overview.kpi.next"), value: t("overview.kpi.no_schedule") };
  const first = o.next[0];
  if (first) {
    const wait = new Date(first.when).getTime() - new Date(o.now).getTime();
    next.value = t("time.in", { span: until(wait) });
    next.note = first.workflow;
    // Green when it is about to fire: the reader can watch it happen.
    if (wait < 120_000) next.tone = "var(--st-success)";
  }
  return <Stats items={[success, failures, running, next]} />;
}

function NextTriggers({ o }: { o: Overview }) {
  const { t } = useT();
  return (
    <Panel title={t("overview.next.title")} action={<a href="/workflows">{t("overview.next.all")} →</a>} className="ov-next">
      {o.next.length === 0 ? (
        <div className="ov-panel-body">
          <Empty text={t("overview.next.none")} hint="brevis publish file.yaml" />
        </div>
      ) : (
        <ul className="ov-next-list">
          {o.next.map((p) => {
            const wait = new Date(p.when).getTime() - new Date(o.now).getTime();
            return (
              <li key={p.workflow}>
                <div className="ov-next-top">
                  <a className="mono" href={`/workflows/${encodeURIComponent(p.workflow)}`}>{p.workflow}</a>
                  <span title={new Date(p.when).toISOString()} style={wait < 120_000 ? { color: "var(--st-success)", fontWeight: 500 } : undefined}>
                    {t("time.in", { span: until(wait) })}
                  </span>
                </div>
                <div className="ov-next-sub">
                  <span>{p.cronText}</span>
                  <span className="mono">{p.cron}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const IN_FLIGHT = ["running", "queued", "retrying"];
type RecentFilter = "all" | "failed" | "running";

function RecentRuns({ runs }: { runs: RunRow[] }) {
  const { t } = useT();
  const [filter, setFilter] = useState<RecentFilter>("all");
  const shown = runs.filter((r) => filter === "all" || (filter === "running" ? IN_FLIGHT.includes(r.status) : r.status === filter));
  const choices: [RecentFilter, string][] = [["all", t("runs.all")], ["failed", t("runs.failed")], ["running", t("runs.in_flight")]];
  return (
    <>
      <div className="ov-recent-bar">
        <div role="group" aria-label={t("runs.state")} className="ov-seg">
          {choices.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
        <Link to="/runs">{t("overview.all_runs")} →</Link>
      </div>
      {runs.length === 0 ? (
        <div className="ov-panel-body"><Empty text={t("runs.empty")} hint="brevis scheduler" /></div>
      ) : shown.length === 0 ? (
        <div className="ov-panel-body"><Empty text={t("runs.none")} /></div>
      ) : (
        <RunsTable runs={shown} label={t("overview.recent")} />
      )}
    </>
  );
}

function EventLog({ events }: { events: EventRow[] }) {
  const { t } = useT();
  const { lang } = useSession();
  const clock = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  if (events.length === 0) return <p className="ov-none">{t("overview.events.none")}</p>;
  return (
    <ol className="ov-events">
      {events.map((e, i) => {
        const subject = (
          <>
            {e.before}
            <code>{e.subject}</code>
            {e.after}
          </>
        );
        return (
          <li key={`${e.at}-${i}`} data-event={e.source}>
            <time dateTime={e.at} title={new Date(e.at).toISOString()} className="mono">{clock.format(new Date(e.at))}</time>
            <span className="ov-src">{e.source}</span>
            <span className="ov-what">
              {/* Runs and workflows are still the server's pages. */}
              {e.href ? <a href={e.href}>{subject}</a> : subject}
              {e.actor && <span className="muted"> · {t("overview.events.by", { actor: e.actor })}</span>}
            </span>
            <span className="ov-state">{e.state && <StatusMark status={e.state} />}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Recent runs and the event log, as tabs by the hash (#recent, #events) like the old page.
function Tabs({ o }: { o: Overview }) {
  const { t } = useT();
  const [tab, setTab] = useState<"recent" | "events">(() => (location.hash === "#events" ? "events" : "recent"));
  const tabs = [["recent", t("overview.recent")], ["events", t("overview.events")]] as const;
  const pick = (k: "recent" | "events") => {
    setTab(k);
    history.replaceState(history.state, "", `#${k}`);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const next = tab === "recent" ? "events" : "recent";
    pick(next);
    document.getElementById(`tab-${next}`)?.focus();
  };
  return (
    <div className="ov-panel ov-tabs">
      <div role="tablist" aria-label={t("overview.tabs")} onKeyDown={onKey}>
        {tabs.map(([k, label]) => (
          <button key={k} id={`tab-${k}`} role="tab" type="button" aria-selected={tab === k} aria-controls={`panel-${k}`} tabIndex={tab === k ? 0 : -1} onClick={() => pick(k)}>
            {label}
            {k === "events" && <span className="mono muted"> {o.events.length}</span>}
          </button>
        ))}
      </div>
      <section id="panel-recent" role="tabpanel" aria-labelledby="tab-recent" hidden={tab !== "recent"}>
        <RecentRuns runs={o.recent} />
      </section>
      <section id="panel-events" role="tabpanel" aria-labelledby="tab-events" hidden={tab !== "events"}>
        <EventLog events={o.events} />
      </section>
    </div>
  );
}

function Body({ window }: { window: WindowKey }) {
  const { t } = useT();
  const o = useOverview(window);
  return (
    <>
      <Kpis o={o} />
      <div className="ov-grid">
        <Panel title={o.grain === "day" ? t("chart.per_day") : t("chart.per_hour")}>
          <div className="ov-panel-body">
            <RunsChart buckets={o.buckets} grain={o.grain} />
          </div>
        </Panel>
        <NextTriggers o={o} />
      </div>
      <Tabs o={o} />
    </>
  );
}

// The same blocks on the same grid as Body, so nothing moves when the data arrives.
function BodySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <StatsSkeleton />
      <div className="ov-grid">
        <div className="ov-panel">
          <div className="ov-panel-head"><Skeleton w="8rem" h="1rem" /></div>
          <div className="ov-panel-body"><div className="chart-sk"><Skeleton h="100%" /></div></div>
        </div>
        <div className="ov-panel">
          <div className="ov-panel-head"><Skeleton w="8rem" h="1rem" /></div>
          <ul className="ov-next-list">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i}>
                <div className="ov-next-top"><Skeleton w="9rem" h="1rem" /><Skeleton w="3rem" h="1rem" /></div>
                <div className="ov-next-sub"><Skeleton w="45%" h=".8rem" /></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="ov-panel ov-tabs">
        <div role="tablist"><Skeleton w="7rem" h="1.2rem" /></div>
        <RunsTableSkeleton rows={6} />
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="ov-head">
        <Skeleton w="8rem" h="1.5rem" />
        <Skeleton w="9rem" h="1.8rem" />
      </div>
      <div className="ov-lede"><Skeleton w="min(36rem, 100%)" h=".9rem" /></div>
      <AttentionSkeleton />
      <BodySkeleton />
    </div>
  );
}

function Page() {
  const { t } = useT();
  const window = useWindow();
  // A new window keeps the old numbers on screen, dimmed, until its answer arrives.
  const shown = useDeferredValue(window);
  return (
    <>
      <div className="ov-head">
        <h1 className="page-title">{t("overview.title")}</h1>
        <WindowToggle current={window} />
      </div>
      <p className="muted ov-lede">{t("overview.lede")}</p>
      <div aria-live="polite">
        <QueryBoundary>
          <Suspense fallback={<AttentionSkeleton />}>
            <AttentionSection />
          </Suspense>
        </QueryBoundary>
      </div>
      <QueryBoundary>
        <Suspense fallback={<BodySkeleton />}>
          <div aria-busy={shown !== window} className={shown !== window ? "ov-stale" : undefined}>
            <Body window={shown} />
          </div>
        </Suspense>
      </QueryBoundary>
    </>
  );
}

export default function OverviewRoute() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Page />
    </Suspense>
  );
}
