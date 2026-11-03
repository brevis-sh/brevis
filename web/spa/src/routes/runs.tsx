import { useEffect, useRef, useState } from "react";
import { Link, Navigate, Outlet, useLocation, useParams, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useFormat, useT } from "../i18n";
import { filterRow, noBar, segGroup, segOff, segOn } from "../ui/button";
import { Empty } from "../ui/card";
import { useAgo, useNumbers } from "../ui/format";
import { Icon } from "../ui/icon";
import { Logos } from "../ui/logo";
import { LoadError } from "../ui/query-boundary";
import { type RunRow } from "../ui/runs-table";
import { Skeleton } from "../ui/skeleton";
import { RetryMark, StatusMark, runKind } from "../ui/status";

type RunsData = {
  runs: RunRow[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  filter: { state: string; workflow: string; from: string; to: string; period: string };
  counts: { all: number; going: number; failed: number };
  byState: Record<string, number>;
};

// The filter lives in the address, so a chart column or an alert can link to a slice.
const KEYS = ["state", "workflow", "from", "to", "page"] as const;

/** The address's query with one key changed (empty removes it); any change but a page's goes back to page 1. */
function withParam(params: URLSearchParams, key: string, value: string): string {
  const q = new URLSearchParams(params);
  if (key !== "page") q.delete("page");
  if (value) q.set(key, value);
  else q.delete(key);
  return q.toString() ? `?${q}` : "";
}

const LIVE_KEY = "brevis.runs.live"; // the old page's own key: the choice carries over
const LIVE_EVERY = 5000;

function useLiveChoice(): [boolean, (on: boolean) => void] {
  const [on, set] = useState(() => {
    try {
      return localStorage.getItem(LIVE_KEY) === "on";
    } catch {
      return false;
    }
  });
  return [
    on,
    (v) => {
      set(v);
      try {
        localStorage.setItem(LIVE_KEY, v ? "on" : "off");
      } catch {
        /* a private window: the choice lasts until the page closes */
      }
    },
  ];
}

// The list follows itself every 5 s when Live is on; a hidden tab pauses it.
function useRuns(qs: string, live: boolean) {
  return useQuery({
    queryKey: ["runs", qs],
    queryFn: ({ signal }) => getJSON<RunsData>(`/api/runs${qs ? `?${qs}` : ""}`, signal),
    placeholderData: keepPreviousData,
    refetchInterval: live ? LIVE_EVERY : false,
  });
}

function LiveSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className="inline-flex h-8 items-center gap-2 rounded-card border border-line bg-surface px-3 text-[0.82rem] text-muted transition-colors duration-150 hover:text-ink aria-pressed:border-state-success/50 aria-pressed:bg-state-success/10 aria-pressed:text-state-success"
    >
      <span className={`h-2 w-2 rounded-full ${on ? "bg-state-success live-dot-on" : "bg-line-strong"}`} />
      {t("runs.live")}
    </button>
  );
}

// A search that filters by workflow as you type, and with `/` from anywhere on the page.
function Search() {
  const { t } = useT();
  const [params, setParams] = useSearchParams();
  const url = params.get("workflow") ?? "";
  const [text, setText] = useState(url);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<number>(undefined);

  // The address changed from elsewhere (a chip, the back button): follow it.
  useEffect(() => setText(url), [url]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const apply = (value: string) => {
    const q = new URLSearchParams(params);
    q.delete("page");
    if (value) q.set("workflow", value);
    else q.delete("workflow");
    setParams(q, { replace: true });
  };

  return (
    <form role="search" className="flex-1" style={{ minWidth: "9rem" }} onSubmit={(e) => { e.preventDefault(); window.clearTimeout(timer.current); apply(text.trim()); }}>
      <label className="relative block">
        <span className="sr-only">{t("runs.search")}</span>
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
        <input
          ref={input}
          type="search"
          value={text}
          placeholder={t("runs.search")}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            window.clearTimeout(timer.current);
            const v = e.target.value.trim();
            timer.current = window.setTimeout(() => apply(v), 300);
          }}
          className="h-8 w-full rounded-card border border-line bg-surface pr-8 pl-8 text-[13px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
        />
        <kbd aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] border border-line px-1.5 font-mono text-[11px] text-faint">/</kbd>
      </label>
    </form>
  );
}

function Chip({ label, value, remove }: { label: string; value: string; remove: string }) {
  const { t } = useT();
  return (
    <span className="inline-flex items-center gap-2 rounded-card border border-line-strong bg-surface-2 px-3 py-1.5 text-xs text-ink">
      <span className="text-muted">{label}:</span>
      <span className="font-medium">{value}</span>
      <Link to={{ search: remove }} aria-label={t("runs.remove_filter")} className="text-muted hover:text-ink">×</Link>
    </span>
  );
}


// The three questions are the screen's; the counts beside them are data.
function Filters({ params, data }: { params: URLSearchParams; data?: RunsData }) {
  const { t } = useT();
  const f = data?.filter;
  const state = f ? f.state : (params.get("state") ?? "");
  // A state the three choices do not offer (a link to the canceled runs) shows as a chip with its ×.
  const offered = ["", "running", "failed"].includes(state);
  const choices = [
    { key: "running", label: t("runs.in_flight"), count: data?.counts.going, current: state === "running" },
    { key: "failed", label: t("runs.failed"), count: data?.counts.failed, current: state === "failed" },
    { key: "all", label: t("runs.all"), count: data?.counts.all, current: state === "" },
  ];
  const stateWord = state ? t(`state.${state}`) : "";
  return (
    <>
      <div role="group" aria-label={t("runs.state")} className={segGroup}>
        {choices.map((c) => (
          <Link key={c.key} to={{ search: withParam(params, "state", c.key) }} aria-current={c.current ? "true" : undefined} className={c.current ? segOn : segOff}>
            {c.label}
            <span className={`text-[0.72rem] tabular-nums ${c.current ? "text-muted" : "text-faint"}`}>
              {c.count}
            </span>
          </Link>
        ))}
      </div>
      {!offered && <Chip label={t("runs.state")} value={stateWord.startsWith("[") ? state : stateWord} remove={withParam(params, "state", "")} />}
      {f?.period && <Chip label={t("runs.period")} value={f.period} remove={withParam(new URLSearchParams(withParam(params, "from", "")), "to", "")} />}
    </>
  );
}

// One line to scan (runItem): the state's shape, the workflow, how long ago, the slot's hour and how
// long it took. The open one has a bar on its edge as well as a background.
function RunItem({ r, current, search }: { r: RunRow; current: boolean; search: string }) {
  const { t } = useT();
  const ago = useAgo();
  const { elapsed } = useNumbers();
  const hour = new Date(r.logicalDate ?? r.createdAt).toISOString().slice(11, 16);
  return (
    <Link
      to={{ pathname: `/runs/${r.id}`, search }}
      data-run-id={r.id}
      data-status={r.status}
      aria-current={current ? "true" : undefined}
      className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-line-soft px-4 py-2.5 transition-colors hover:bg-surface-2 aria-[current=true]:bg-surface-2 aria-[current=true]:shadow-[inset_2px_0_0_var(--color-ink)]"
    >
      <span className="row-span-2 flex justify-center">
        <StatusMark kind={runKind(r.status)} />
      </span>
      <span className="flex min-w-0 items-center gap-1.5">
        <Logos keys={r.logos} />
        <span className="truncate font-mono text-[13px] text-ink">{r.workflow}</span>
        <RetryMark attempt={r.attempt} />
      </span>
      <span className="text-[11.5px] whitespace-nowrap text-faint">{ago(r.createdAt)}</span>
      <span className="col-start-2 col-end-4 flex gap-2 font-mono text-[11.5px] text-muted tabular-nums">
        <span>{hour}</span>
        {r.durationMs !== null ? <span>{elapsed(r.durationMs)}</span> : r.status === "running" ? <span>{t("runs.running")}</span> : null}
      </span>
    </Link>
  );
}

function ItemsSkeleton() {
  return (
    <div className="border-t border-line-soft" aria-hidden="true">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="grid grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-0.5 border-b border-line-soft px-4 py-2.5">
          <span className="row-span-2 flex justify-center"><Skeleton w="8px" h="8px" /></span>
          <span className="flex items-center gap-1.5"><Skeleton w="18px" h="18px" /><Skeleton w="8rem" h="14px" /></span>
          <Skeleton w="3.5rem" h="12px" />
          <span className="col-start-2 col-end-4"><Skeleton w="6rem" h="12px" /></span>
        </div>
      ))}
    </div>
  );
}

// Newer and Older: a column has no room for page numbers, and the list is read from the top.
function Pager({ params, data }: { params: URLSearchParams; data: RunsData }) {
  const { t } = useT();
  const first = (data.page - 1) * data.perPage + 1;
  const to = (p: number) => ({ search: withParam(params, "page", p > 1 ? String(p) : "") });
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs text-muted">
      {data.page > 1 ? <Link to={to(data.page - 1)} className="text-ink hover:underline">{t("runs.newer")}</Link> : <span />}
      <span className="tabular-nums">{t("runs.range", { first, last: first + data.runs.length - 1, total: data.total })}</span>
      {data.page * data.perPage < data.total ? <Link to={to(data.page + 1)} className="text-ink hover:underline">{t("runs.older")}</Link> : <span />}
    </div>
  );
}

function Items({ params, data, current, search }: { params: URLSearchParams; data: RunsData; current: string; search: string }) {
  const { t } = useT();
  const f = data.filter;
  const active = f.state !== "" || f.workflow !== "" || f.from !== "" || f.to !== "";
  if (data.runs.length === 0) {
    return (
      <div className="px-4 pt-2 pb-4">
        <Empty text={active ? t("runs.none") : t("runs.empty")} hint={active ? undefined : "brevis scheduler"} />
      </div>
    );
  }
  return (
    <>
      <nav aria-label={t("runs.title")} className="border-t border-line-soft">
        {data.runs.map((r) => (
          <RunItem key={r.id} r={r} current={r.id === current} search={search} />
        ))}
      </nav>
      <Pager params={params} data={data} />
    </>
  );
}

// The open run (the pane's) is the child route; with none chosen the newest opens, as /runs always did.
export function RunsIndex() {
  const [params] = useSearchParams();
  const clean = cleanParams(params);
  const { data } = useRuns(clean.toString(), false);
  const { search } = useLocation();
  const first = data?.runs[0];
  return first ? <Navigate to={{ pathname: `/runs/${first.id}`, search }} replace /> : null;
}

function cleanParams(params: URLSearchParams) {
  // Only the filter the page knows is sent on: a stray key in the address is not a new query.
  const clean = new URLSearchParams();
  for (const k of KEYS) if (params.get(k)) clean.set(k, params.get(k)!);
  return clean;
}

// Runs fills the shell (screen-runs): the list is a column and the open run is
// beside it, each scrolling on its own; below 1000px the list goes on top.
export default function RunsRoute() {
  const { t } = useT();
  const f = useFormat();
  const [params] = useSearchParams();
  const { id = "" } = useParams();
  const { search } = useLocation();
  const [live, setLive] = useLiveChoice();
  const clean = cleanParams(params);
  const q = useRuns(clean.toString(), live);
  const data = q.data;
  return (
    <div className="px-3 pb-10 min-[860px]:px-6 flex min-h-0 flex-1 flex-col">
      <div data-runs-screen className="-mx-3 -mb-10 flex min-h-0 flex-1 flex-col min-[860px]:-mx-6 min-[1001px]:flex-row">
        <aside data-runs-list className="flex max-h-[300px] shrink-0 flex-col border-b border-line min-[1001px]:max-h-none min-[1001px]:w-[340px] min-[1001px]:border-r min-[1001px]:border-b-0">
          <div className="flex min-h-12 items-center justify-between gap-3 px-4 pt-3 pb-1">
            <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.018em] text-ink">
              {t("runs.title")}
              <span className="ml-1.5 inline-flex items-center font-mono text-[13px] font-normal text-muted tabular-nums">
                {data ? f.number(data.total) : <Skeleton w="1.5ch" h="12px" className="inline-block" />}
              </span>
            </h1>
          </div>
          <div className={`${filterRow} px-4 pb-2`} style={noBar}>
            <Search />
            <Filters params={params} data={data} />
            <LiveSwitch on={live} onChange={setLive} />
          </div>
          <div id="runs-list" aria-busy={q.isPlaceholderData || !data} className={`min-h-0 flex-1 overflow-y-auto ${q.isPlaceholderData ? "opacity-60 transition-opacity" : ""}`}>
            {q.isError && !data ? (
              <div className="px-4 pb-4"><LoadError onRetry={() => void q.refetch()} /></div>
            ) : data ? (
              <Items params={params} data={data} current={id} search={search} />
            ) : (
              <ItemsSkeleton />
            )}
          </div>
        </aside>
        <section id="run-pane" className="@container min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pt-3 pb-10 min-[860px]:px-6">
          <Outlet />
        </section>
      </div>
    </div>
  );
}
