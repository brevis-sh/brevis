import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useSession } from "../api/session";
import { useFormat, useT } from "../i18n";
import { filterRow, noBar } from "../ui/button";
import { Empty, Panel, linkClass } from "../ui/card";
import { until, useNumbers } from "../ui/format";
import { Logos } from "../ui/logo";
import { PageFrame } from "../ui/page-frame";
import { LoadError } from "../ui/query-boundary";
import { RunsTable, type RunRow } from "../ui/runs-table";
import { Skeleton } from "../ui/skeleton";
import { Stats, type StatProps } from "../ui/stat";
import { StatusMark, runKind } from "../ui/status";
import { TabBar } from "../ui/tab-bar";
import { useLive } from "../live/hooks";
import { AttentionSection, attentionQuery } from "./overview-attention";
import { RunsChart, type Bucket } from "./overview-chart";

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

// The numbers are data; the screen around them is not. Each region reads this and
// draws its own placeholder until `data` arrives, so the page never waits as a
// whole. The old window's answer stays (dimmed) while the next one loads.
function useOverview(window: WindowKey) {
  return useQuery({
    queryKey: ["overview", window],
    queryFn: ({ signal }) => getJSON<Overview>(`/api/overview?window=${window}`, signal),
    placeholderData: keepPreviousData,
  });
}

// The three windows as links: the address carries the choice, so it can be shared.
function WindowToggle({ current }: { current: WindowKey }) {
  const { t } = useT();
  return (
    <nav aria-label={t("window.label")} className="flex items-center rounded-card border border-line text-[12px]">
      {WINDOWS.map((k) => (
        <Link
          key={k}
          to={{ search: `?window=${k}` }}
          aria-current={k === current ? "page" : undefined}
          className={k === current ? "bg-surface-2 px-2.5 py-1 font-medium text-ink" : "px-2.5 py-1 text-muted hover:text-ink"}
        >
          {t(`window.short.${k}`)}
        </Link>
      ))}
    </nav>
  );
}

// The four numbers: how much passed, what failed, what runs and waits, what fires next.
function Kpis({ window, o }: { window: WindowKey; o?: Overview }) {
  const { t, n } = useT();
  const f = useFormat();
  const { percent, elapsed } = useNumbers();
  // The "still failing" link needs the attention list, which the section above already follows.
  const attention = useQuery(attentionQuery).data;

  const labels = {
    success: { label: t("overview.kpi.success"), sub: t(`window.${window}`), dot: "var(--st-success)" },
    failures: { label: t("overview.kpi.failures") },
    running: { label: t("overview.kpi.running"), dot: "var(--st-running)" },
    next: { label: t("overview.kpi.next") },
  };
  if (!o) return <Stats items={Object.values(labels).map((l) => ({ ...l, loading: true }))} />;

  const i = o.indicators;
  const finished = i.succeeded + i.failed;
  const success: StatProps = { ...labels.success, value: "—" };
  const failures: StatProps = { ...labels.failures, value: f.number(i.failed) };
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
  if (stillFailing > 0) failures.foot = <Link to="/runs?state=failed" className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">{n("overview.kpi.still_failing", stillFailing)} →</Link>;

  const running: StatProps = { ...labels.running, value: f.number(i.running), note: n("overview.kpi.queued", o.queued) };
  if (i.meanDurationMs > 0) running.foot = t("overview.kpi.mean", { span: elapsed(i.meanDurationMs) });

  const next: StatProps = { ...labels.next, value: t("overview.kpi.no_schedule") };
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

function NextTriggers({ o }: { o?: Overview }) {
  const { t } = useT();
  return (
    <section data-next-triggers>
      <Panel title={t("overview.next.title")} action={<Link to="/workflows" className={linkClass}>{t("overview.next.all")} →</Link>}>
        {!o ? (
          <ul className="divide-y divide-line-soft" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <li key={i} className="px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <Skeleton w="18px" h="18px" />
                  <Skeleton w="9rem" h="14px" />
                  <Skeleton w="3.5rem" h="14px" className="ml-auto" />
                </div>
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <Skeleton w="8rem" h="13px" />
                  <Skeleton w="4rem" h="13px" />
                </div>
              </li>
            ))}
          </ul>
        ) : o.next.length === 0 ? (
          <div className="px-3.5 py-3">
            <Empty text={t("overview.next.none")} hint="brevis publish file.yaml" />
          </div>
        ) : (
          <ul className="divide-y divide-line-soft">
            {o.next.map((p) => {
              const wait = new Date(p.when).getTime() - new Date(o.now).getTime();
              return (
                <li key={p.workflow} className="px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Logos keys={p.logos} />
                    <Link to={`/workflows/${encodeURIComponent(p.workflow)}`} className="min-w-0 truncate font-mono text-[13px] text-ink hover:underline">{p.workflow}</Link>
                    <span
                      title={new Date(p.when).toISOString()}
                      className={`ml-auto shrink-0 text-[12.5px] whitespace-nowrap ${wait < 120_000 ? "font-medium text-state-success" : "text-ink"}`}
                    >
                      {t("time.in", { span: until(wait) })}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="min-w-0 truncate text-muted">{p.cronText}</span>
                    <span className="shrink-0 font-mono text-[11.5px] text-faint">{p.cron}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </section>
  );
}

const IN_FLIGHT = ["running", "queued", "retrying"];
type RecentFilter = "all" | "failed" | "running";
const pill = "rounded-[5px] px-2.5 py-1 text-[12.5px] text-muted hover:text-ink aria-pressed:bg-surface-2 aria-pressed:text-ink";

// The filter and the link are the screen's; only the rows wait for the runs.
function RecentRuns({ runs }: { runs?: RunRow[] }) {
  const { t } = useT();
  const [filter, setFilter] = useState<RecentFilter>("all");
  const shown = runs?.filter((r) => filter === "all" || (filter === "running" ? IN_FLIGHT.includes(r.status) : r.status === filter));
  const choices: [RecentFilter, string][] = [["all", t("runs.all")], ["failed", t("runs.failed")], ["running", t("runs.in_flight")]];
  return (
    <>
      <div className={`${filterRow} justify-between px-3.5 py-2.5`} style={noBar}>
        <div role="group" aria-label={t("runs.state")} className="inline-flex rounded-card border border-line p-0.5">
          {choices.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={pill}>{label}</button>
          ))}
        </div>
        <Link to="/runs" className={`ml-auto shrink-0 text-[12.5px] ${linkClass}`}>{t("overview.all_runs")} →</Link>
      </div>
      {runs && runs.length === 0 ? (
        <div className="px-3.5 pb-3"><Empty text={t("runs.empty")} hint="brevis scheduler" /></div>
      ) : shown && shown.length === 0 ? (
        <div className="px-3.5 pb-3"><Empty text={t("runs.none")} /></div>
      ) : (
        <RunsTable runs={shown} bare label={t("overview.recent")} />
      )}
    </>
  );
}

function EventLog({ events }: { events?: EventRow[] }) {
  const { t } = useT();
  const { lang } = useSession();
  const clock = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!events) {
    return (
      <ol className="divide-y divide-line-soft border-t border-line-soft" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="grid grid-cols-[auto_6.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2 max-[640px]:grid-cols-[auto_minmax(0,1fr)]">
            <Skeleton w="2.5rem" h="14px" />
            <Skeleton w="4rem" h="14px" className="max-[640px]:hidden" />
            <Skeleton w="60%" h="14px" />
            <span className="max-[640px]:hidden"><Skeleton w="8px" h="8px" /></span>
          </li>
        ))}
      </ol>
    );
  }
  if (events.length === 0) return <p className="px-3.5 py-4 text-[12.5px] text-muted">{t("overview.events.none")}</p>;
  return (
    <ol className="divide-y divide-line-soft border-t border-line-soft">
      {events.map((e, i) => {
        const subject = (
          <>
            {e.before}
            <code className="font-mono text-[12px] text-ink">{e.subject}</code>
            {e.after}
          </>
        );
        return (
          <li
            key={`${e.at}-${i}`}
            data-event={e.source}
            className="grid grid-cols-[auto_6.5rem_minmax(0,1fr)_auto] items-center gap-x-3 px-3.5 py-2 text-[12.5px] max-[640px]:grid-cols-[auto_minmax(0,1fr)]"
          >
            <time dateTime={e.at} title={new Date(e.at).toISOString()} className="font-mono text-[12px] text-muted tabular-nums">{clock.format(new Date(e.at))}</time>
            <span className="text-muted max-[640px]:hidden">{e.source}</span>
            <span className="min-w-0 truncate text-ink-2">
              {e.href ? <Link to={e.href} className="hover:underline">{subject}</Link> : subject}
              {e.actor && <span className="text-muted"> · {t("overview.events.by", { actor: e.actor })}</span>}
            </span>
            <span className="max-[640px]:hidden">{e.state && <StatusMark kind={runKind(e.state)} />}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Recent runs and the event log, as tabs by the hash (#recent, #events) like the old page.
function Tabs({ o }: { o?: Overview }) {
  const { t } = useT();
  const [tab, setTab] = useState<"recent" | "events">(() => (location.hash === "#events" ? "events" : "recent"));
  const pick = (k: string) => {
    setTab(k as "recent" | "events");
    history.replaceState(history.state, "", `#${k}`);
  };
  return (
    <div className="mt-3 overflow-hidden rounded-card border border-line bg-surface">
      <div className="px-3.5 pt-1">
        <TabBar
          label={t("overview.tabs")}
          current={tab}
          onSelect={pick}
          tabs={[
            { key: "recent", label: t("overview.recent") },
            { key: "events", label: t("overview.events"), count: o ? o.events.length : <Skeleton w="1.2ch" h="10px" className="inline-block" /> },
          ]}
        />
      </div>
      <section id="panel-recent" role="tabpanel" aria-labelledby="tab-recent" hidden={tab !== "recent"}>
        <RecentRuns runs={o?.recent} />
      </section>
      <section id="panel-events" role="tabpanel" aria-labelledby="tab-events" hidden={tab !== "events"}>
        <EventLog events={o?.events} />
      </section>
    </div>
  );
}

export default function OverviewRoute() {
  const { t } = useT();
  const window = useWindow();
  // One topic feeds both the numbers and the attention list (every key starts with "overview").
  useLive(["overview"], [["overview"]]);
  const q = useOverview(window);
  const o = q.data;
  const grain = window === "24h" ? "hour" : "day";
  return (
    <PageFrame title={t("overview.title")} actions={<WindowToggle current={window} />}>
      <p className="mb-3 max-w-3xl text-[13px] text-muted">{t("overview.lede")}</p>
      <div aria-live="polite">
        <AttentionSection />
      </div>
      {q.isError && !o ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : (
        <div aria-busy={q.isPlaceholderData || !o} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
          <div data-kpis>
            <Kpis window={window} o={o} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[1101px]:grid-cols-[1fr_380px]">
            <Panel title={grain === "day" ? t("chart.per_day") : t("chart.per_hour")}>
              <div className="px-3.5 py-3">
                <RunsChart buckets={o?.buckets} grain={grain} />
              </div>
            </Panel>
            <NextTriggers o={o} />
          </div>
          <Tabs o={o} />
        </div>
      )}
    </PageFrame>
  );
}
