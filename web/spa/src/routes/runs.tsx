import { Suspense, useDeferredValue, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useT } from "../i18n";
import { Empty } from "../ui/panel";
import { Pagination, PaginationSkeleton } from "../ui/pagination";
import { QueryBoundary } from "../ui/query-boundary";
import { Skeleton } from "../ui/skeleton";
import { RunsTable, RunsTableSkeleton, type RunRow } from "../ui/runs-table";
import "./runs.css";

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

function LiveSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const { t } = useT();
  return (
    <button type="button" className="rn-live" aria-pressed={on} onClick={() => onChange(!on)}>
      <span aria-hidden="true" className="rn-live-dot" />
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
    <form role="search" className="rn-search" onSubmit={(e) => { e.preventDefault(); window.clearTimeout(timer.current); apply(text.trim()); }}>
      <label>
        <span className="rn-sr">{t("runs.search")}</span>
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
        />
        <kbd aria-hidden="true">/</kbd>
      </label>
    </form>
  );
}

function Chip({ label, value, remove }: { label: string; value: string; remove: string }) {
  const { t } = useT();
  return (
    <span className="rn-chip">
      <span className="muted">{label}:</span> <strong>{value}</strong>
      <Link to={{ search: remove }} aria-label={t("runs.remove_filter")}>×</Link>
    </span>
  );
}

function RunsList({ qs, live, stale }: { qs: string; live: boolean; stale: boolean }) {
  const { t } = useT();
  const params = new URLSearchParams(qs);
  const { data } = useSuspenseQuery({
    queryKey: ["runs", qs],
    queryFn: ({ signal }) => getJSON<RunsData>(`/api/runs${qs ? `?${qs}` : ""}`, signal),
    // The old page's Live switch: the list renews itself every 5 s, and a hidden tab pauses it.
    refetchInterval: live ? LIVE_EVERY : false,
  });
  const f = data.filter;
  const active = f.state !== "" || f.workflow !== "" || f.from !== "" || f.to !== "";
  // A state the three choices do not offer (a link to the canceled runs) shows as a chip with its ×.
  const offered = ["", "running", "failed"].includes(f.state);
  const choices = [
    { key: "running", label: t("runs.in_flight"), count: data.counts.going, current: f.state === "running" },
    { key: "failed", label: t("runs.failed"), count: data.counts.failed, current: f.state === "failed" },
    { key: "all", label: t("runs.all"), count: data.counts.all, current: f.state === "" },
  ];
  const stateWord = f.state ? t(`state.${f.state}`) : "";

  return (
    <div aria-busy={stale} className={stale ? "rn-stale" : undefined}>
      <div className="rn-filters">
        <nav aria-label={t("runs.state")} className="rn-seg">
          {choices.map((c) => (
            <Link key={c.key} to={{ search: withParam(params, "state", c.key) }} aria-current={c.current ? "true" : undefined}>
              {c.label} <span className="mono">{c.count}</span>
            </Link>
          ))}
        </nav>
        {!offered && <Chip label={t("runs.state")} value={stateWord.startsWith("[") ? f.state : stateWord} remove={withParam(params, "state", "")} />}
        {f.period && <Chip label={t("runs.period")} value={f.period} remove={withParam(new URLSearchParams(withParam(params, "from", "")), "to", "")} />}
      </div>
      {data.runs.length === 0 ? (
        <Empty text={active ? t("runs.none") : t("runs.empty")} hint={active ? undefined : "brevis scheduler"} />
      ) : (
        <>
          <RunsTable runs={data.runs} label={t("runs.title")} />
          <Pagination page={data.page} perPage={data.perPage} total={data.total} pages={data.pages} to={(p) => ({ search: withParam(params, "page", p > 1 ? String(p) : "") })} />
        </>
      )}
    </div>
  );
}

export function RunsListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="rn-filters">
        <Skeleton w="15rem" h="2rem" />
      </div>
      <RunsTableSkeleton rows={10} />
      <PaginationSkeleton />
    </div>
  );
}

export function RunsSkeleton() {
  return (
    <>
      <div className="rn-head">
        <Skeleton w="6rem" h="1.5rem" />
        <Skeleton w="5rem" h="2rem" />
      </div>
      <div className="rn-search"><Skeleton h="2rem" /></div>
      <RunsListSkeleton />
    </>
  );
}

function Page() {
  const { t } = useT();
  const [params] = useSearchParams();
  const [live, setLive] = useLiveChoice();
  // Only the filter the page knows is sent on: a stray key in the address is not a new query.
  const clean = new URLSearchParams();
  for (const k of KEYS) if (params.get(k)) clean.set(k, params.get(k)!);
  const qs = clean.toString();
  // A new filter keeps the list on screen, dimmed, until its answer arrives: no skeleton flash per click.
  const deferred = useDeferredValue(qs);
  return (
    <>
      <div className="rn-head">
        <h1 className="page-title">{t("runs.title")}</h1>
        <LiveSwitch on={live} onChange={setLive} />
      </div>
      <Search />
      <QueryBoundary>
        <Suspense fallback={<RunsListSkeleton />}>
          <RunsList qs={deferred} live={live} stale={deferred !== qs} />
        </Suspense>
      </QueryBoundary>
    </>
  );
}

export default function RunsRoute() {
  return (
    <Suspense fallback={<RunsSkeleton />}>
      <Page />
    </Suspense>
  );
}
