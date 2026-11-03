import { Suspense, useDeferredValue } from "react";
import { Link, useSearchParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import type { LoadRow, Loads, Source } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { QueryBoundary } from "../ui/boundary";
import { LIVE } from "../ui/live";
import { Place } from "../ui/place";
import { Skeleton } from "../ui/skeleton";
import { Sparkline } from "../ui/sparkline";
import { StatusBadge } from "../ui/status";
import { Rt, Td, Th } from "../ui/table";
import "../ui/list.css";
import "./loads.css";

// The statuses a load can have, in the band's order (a step is never
// continuous, nor its destination unidentified).
const STATUSES = ["stale", "late", "on_time", "paused", "unscheduled"] as const;
const word = (s: string) => (s === "unscheduled" ? "no_schedule" : s);

/** The list's query string, with one field changed ("" removes it). */
function withParam(params: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(params);
  if (value === "") next.delete(key);
  else next.set(key, value);
  const s = next.toString();
  return s === "" ? "" : `?${s}`;
}

function SourceCell({ s }: { s: Source }) {
  const { t } = useT();
  if (s.kind === "") {
    return (
      <span className="muted" title={t("loads.source.none.tip")}>
        {t("loads.source.none")}
      </span>
    );
  }
  return (
    <div className="place">
      <span className="place-kind">{s.label}</span>
      {s.where !== "" && (
        <p className="place-uri mono" title={s.where}>
          <span className="place-where">{s.where}</span>
        </p>
      )}
    </div>
  );
}

function Row({ r }: { r: LoadRow }) {
  const { t, n } = useT();
  const { since, number, dateTime } = useFormat();
  return (
    <tr role="row">
      <Td head>
        <a href={`/workflows/${encodeURIComponent(r.workflow)}`} className="mono ld-wf">
          {r.workflow}
        </a>
        <p className="muted ld-step">
          <Link to={r.href} className="row-link mono">
            {r.step}
          </Link>{" "}
          · {r.schedule}
        </p>
      </Td>
      <Td label={t("loads.col.flow")} col={2}>
        <div className="ld-flow">
          <SourceCell s={r.source} />
          <span className="muted" aria-hidden="true">
            →
          </span>
          <div>
            <Place p={r.target} />
            {r.legacy && <span className="muted">{t("catalog.chip.legacy")}</span>}
          </div>
        </div>
      </Td>
      <Td label={t("loads.col.status")}>
        <div>
          <StatusBadge status={r.status} />
          {r.fixing && (
            <a href={`/runs/${r.fixing}`} className="ld-fix">
              {t("loads.fixing")}
            </a>
          )}
        </div>
      </Td>
      <Td label={t("loads.col.last")} col={4}>
        {r.lastLoaded ? <span title={dateTime(r.lastLoaded)}>{since(r.lastLoaded)}</span> : <span className="muted">—</span>}
      </Td>
      <Td label={t("loads.col.rows")} col={3} num>
        {r.rows === null ? (
          <span className="muted" title={t("catalog.no_rows")}>
            —
          </span>
        ) : (
          <span title={n("loads.drawer.rows", r.rows)}>{number(r.rows)}</span>
        )}
      </Td>
      <Td label={t("loads.col.recent")} col={3}>
        <Sparkline values={r.recent} />
      </Td>
    </tr>
  );
}

function LoadsTable({ rows }: { rows: LoadRow[] }) {
  const { t } = useT();
  return (
    <>
      <Rt
        label={t("loads.title")}
        head={
          <>
            <Th>{t("loads.col.who")}</Th>
            <Th col={2}>{t("loads.col.flow")}</Th>
            <Th>{t("loads.col.status")}</Th>
            <Th col={4}>{t("loads.col.last")}</Th>
            <Th col={3} num>
              {t("loads.col.rows")}
            </Th>
            <Th col={3}>{t("loads.col.recent")}</Th>
          </>
        }
      >
        {rows.map((r) => (
          <Row key={`${r.workflow}/${r.step}/${r.target.uri}`} r={r} />
        ))}
      </Rt>
      <p className="muted ld-honest">{t("loads.honest")}</p>
    </>
  );
}

function LoadsData({ query }: { query: string }) {
  const { t, n } = useT();
  const [params, setParams] = useSearchParams();
  const { data: v } = useSuspenseQuery({
    queryKey: ["ingest", "loads", query],
    queryFn: ({ signal }) => getJSON<Loads>(`/api/ingest/loads${query}`, signal),
    ...LIVE,
  });
  const f = v.filter;
  const filtered = f.status !== "" || f.source !== "" || f.q !== "" || f.legacy;
  const shown = v.total > 0 || v.hasLegacy;
  const band = (key: string, label: string, tip: string) => (
    <Link
      key={key}
      className="chip"
      to={{ search: withParam(params, "status", key) }}
      aria-current={f.status === key}
      title={tip}
    >
      {key !== "" && key !== "attention" && <StatusBadge status={key} />}
      {key === "" || key === "attention" ? label : null}
      <span className="n">{v.counts[key] ?? 0}</span>
    </Link>
  );

  return (
    <>
      {v.total > 0 && (
        <p className="summary">
          <span className="muted">{n("loads.summary.destinations", v.total)}</span>
          <span className="muted">{n("loads.summary.workflows", v.workflows)}</span>
          {STATUSES.filter((s) => (v.summary[s] ?? 0) > 0).map((s) => (
            <span key={s} className="summary-item">
              <strong>{v.summary[s]}</strong>
              <StatusBadge status={s} />
            </span>
          ))}
          <a href={`/data${f.status ? `?status=${encodeURIComponent(f.status)}` : ""}`}>{t("loads.catalog")} →</a>
        </p>
      )}
      {shown && (
        <>
          <div className="toolbar">
            <input
              type="search"
              className="search"
              aria-label={t("loads.search")}
              placeholder={t("loads.search")}
              value={params.get("q") ?? ""}
              onChange={(e) => setParams((p) => new URLSearchParams(withParam(p, "q", e.target.value).slice(1)), { replace: true })}
            />
          </div>
          <nav className="chips" aria-label={t("catalog.band")}>
            {band("", t("catalog.status.all"), "")}
            {band("attention", t("catalog.status.attention"), t("catalog.tip.attention"))}
            {STATUSES.map((s) => band(s, t(`state.${word(s)}`), t(`catalog.tip.${s}`)))}
          </nav>
          <div className="toolbar">
            {v.sources.length > 1 && (
              <div className="chips" role="group" aria-label={t("loads.source")}>
                <Link className="chip" to={{ search: withParam(params, "source", "") }} aria-current={f.source === ""}>
                  {t("loads.source.all")}
                </Link>
                {v.sources.map((s) => (
                  <Link key={s.key} className="chip" to={{ search: withParam(params, "source", s.key) }} aria-current={f.source === s.key}>
                    {s.label}
                  </Link>
                ))}
              </div>
            )}
            {v.hasLegacy && (
              <Link className="switch" role="switch" aria-checked={f.legacy} to={{ search: withParam(params, "legacy", f.legacy ? "" : "1") }}>
                <i aria-hidden="true" />
                {t("catalog.legacy")}
              </Link>
            )}
          </div>
        </>
      )}
      {v.rows.length === 0 ? (
        <div className="empty">
          {filtered && shown ? (
            <>
              <p>{t("loads.empty.filtered")}</p>
              <Link to={{ search: "" }}>{t("workflows.clear")}</Link>
            </>
          ) : (
            <>
              <p>{t("loads.empty")}</p>
              <p>{t("loads.empty.how")}</p>
            </>
          )}
        </div>
      ) : (
        <LoadsTable rows={v.rows} />
      )}
    </>
  );
}

function Head() {
  const { t } = useT();
  return (
    <>
      <div className="head-row">
        <h1 className="page-title">{t("loads.title")}</h1>
        <a className="btn" href="/workflows">
          {t("loads.workflows")}
        </a>
      </div>
      <p className="lede">
        {t("loads.lead.before")} <strong>{t("loads.lead.strong")}</strong> {t("loads.lead.after")}
      </p>
    </>
  );
}

// The same grid as the page: title row, lead, summary line, search, band, and
// the cards or table rows.
export function LoadsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w="30%" h="1.5rem" />
      <div style={{ height: ".9rem" }} />
      <Skeleton w="60%" h=".9rem" />
      <div className="summary">
        <Skeleton w="22rem" h="1rem" />
      </div>
      <Skeleton w="min(24rem, 100%)" h="2.25rem" />
      <div className="chips" style={{ marginTop: ".75rem" }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} w="5.5rem" h="2rem" />
        ))}
      </div>
      <div className="ld-sk-rows">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} h="3.6rem" />
        ))}
      </div>
    </div>
  );
}

export default function LoadsRoute() {
  const [params] = useSearchParams();
  // The URL changes on every keystroke; the list follows a beat behind and
  // keeps showing the old rows meanwhile, instead of flashing a skeleton.
  const search = params.toString();
  const deferred = useDeferredValue(search);
  return (
    <QueryBoundary>
      <Suspense fallback={<LoadsSkeleton />}>
        <Head />
        <div aria-busy={search !== deferred}>
          <LoadsData query={deferred === "" ? "" : `?${deferred}`} />
        </div>
      </Suspense>
    </QueryBoundary>
  );
}
