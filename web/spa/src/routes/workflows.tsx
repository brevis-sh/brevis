import { Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useScheduleToggle, type WorkflowRow, type WorkflowsList } from "../api/workflows";
import { useFormat, useT } from "../i18n";
import { LogoList } from "../ui/logo-chip";
import { PagerNav } from "../ui/pager-nav";
import { Skeleton } from "../ui/skeleton";
import { RunStrip } from "../ui/state-chip";
import { ToggleSwitch } from "../ui/toggle-switch";
import "./workflows.css";

const STATES = ["", "failing", "running", "paused", "manual"] as const;
const SORTABLE = ["workflow", "schedule", "next", "last"] as const;
const SORT_FIELD = { "c-name": "workflow", "c-when": "schedule", "c-next": "next", "c-last": "last" };
type Patch = Record<string, string | string[] | null>;

// The filter, the sort and the page live in the query string, with the old
// page's names, so a link is the same link. Every control is a real link.
function useListLinks() {
  const [sp] = useSearchParams();
  const hrefWith = (patch: Patch, keepPage = false): string => {
    const q = new URLSearchParams(sp);
    if (!keepPage) q.delete("page");
    for (const [k, v] of Object.entries(patch)) {
      q.delete(k);
      for (const one of Array.isArray(v) ? v : v ? [v] : []) q.append(k, one);
    }
    const s = q.toString();
    return s ? `?${s}` : "?";
  };
  return { sp, hrefWith };
}

// Same columns, same hiding rules and same widths for the rows and their
// skeletons: the classes are the grid.
const COLS = [
  ["c-active", "workflows.col.active"],
  ["c-name", "workflows.col.workflow"],
  ["c-lang", "workflows.col.lang"],
  ["c-conn", "workflows.col.connects"],
  ["c-when", "workflows.col.schedule"],
  ["c-next", "workflows.col.next"],
  ["c-last", "workflows.col.last"],
  ["c-tags", "workflows.col.tags"],
  ["c-run", ""],
] as const;

export function WorkflowsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workflows">
      <div className="wf-filters">
        <Skeleton w="22rem" h="2rem" />
      </div>
      <Skeleton w="12rem" h="1rem" />
      <table className="wf-table wf-skeleton" aria-hidden="true">
        <colgroup>
          {COLS.map(([c]) => (
            <col key={c} className={c} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLS.map(([c]) => (
              <th key={c} className={c}>
                <Skeleton w="60%" h=".7rem" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              <td className="c-active">
                <Skeleton w="30px" h="18px" />
              </td>
              <td className="c-name">
                <Skeleton w="70%" h="1rem" />
                <Skeleton w="40%" h=".75rem" />
              </td>
              <td className="c-lang">
                <Skeleton w="5rem" h="1.35rem" />
              </td>
              <td className="c-conn">
                <Skeleton w="3rem" h="1.35rem" />
              </td>
              <td className="c-when">
                <Skeleton w="80%" h=".8rem" />
                <Skeleton w="50%" h=".7rem" />
              </td>
              <td className="c-next">
                <Skeleton w="3.5rem" h=".8rem" />
              </td>
              <td className="c-last">
                <Skeleton w="9rem" h=".85rem" />
              </td>
              <td className="c-tags">
                <Skeleton w="5rem" h="1.1rem" />
              </td>
              <td className="c-run">
                <Skeleton w="2rem" h="2rem" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ w, query, busy, onToggle }: { w: WorkflowRow; query: ReturnType<typeof useListLinks>; busy: boolean; onToggle: () => void }) {
  const { t, n } = useT();
  const { since, dateTime } = useFormat();
  const paused = w.hasSchedule && !w.active;
  const zone = w.timezone && w.timezone !== "UTC" && w.timezone !== "Etc/UTC" ? ` (${w.timezone})` : "";
  return (
    <tr className="wf-row" data-paused={paused || undefined}>
      <td className="c-active">
        {w.hasSchedule ? (
          <ToggleSwitch
            on={w.active}
            busy={busy}
            label={t(w.active ? "workflows.pause" : "workflows.resume", { workflow: w.slug })}
            onToggle={onToggle}
          />
        ) : (
          <span className="muted" title={t("workflows.no_schedule.tip")}>
            —
          </span>
        )}
      </td>
      <td className="c-name fade">
        <div className="wf-name">
          <Link to={`/workflows/${encodeURIComponent(w.slug)}`} className="mono wf-slug">
            {w.slug}
          </Link>
          {w.failing ? (
            <span className="pill pill-failing">{t("workflows.pill.failing")}</span>
          ) : w.inFlight ? (
            <span className="pill pill-running">{t("workflows.pill.running")}</span>
          ) : null}
        </div>
        <p className="muted small">
          <Link to={query.hrefWith({ project: w.project })}>{w.project}</Link>
          {w.steps !== null && <> · {n("workflows.steps", w.steps)}</>}
        </p>
      </td>
      <td className="c-lang fade">
        {w.runsIn.length > 0 ? (
          <span className="wf-lang">
            <LogoList logos={w.runsIn.slice(0, 4)} />
            <span className="small">
              {w.runsIn
                .slice(0, 2)
                .map((l) => l.name)
                .join(" + ")}
              {w.runsIn.length > 2 && ` +${w.runsIn.length - 2}`}
            </span>
          </span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="c-conn fade">
        <LogoList logos={w.connects} />
      </td>
      <td className="c-when fade">
        {w.cron === "" ? (
          <span className="muted small">{t("workflows.manual_only")}</span>
        ) : (
          <>
            {paused ? (
              <p className="muted small">
                {t("workflows.paused")}
                {w.schedule && <> · {t("workflows.was", { schedule: w.schedule })}</>}
              </p>
            ) : (
              w.schedule && (
                <p className="small">
                  {w.schedule}
                  {zone}
                </p>
              )
            )}
            <p className="mono faint">
              {w.cron}
              {w.catchup && <span className="sans"> catchup</span>}
            </p>
          </>
        )}
      </td>
      <td className="c-next small fade">
        {w.inFlight ? (
          <span className="running-now">{t("workflows.in_flight")}</span>
        ) : w.nextRun && !paused ? (
          <span title={dateTime(w.nextRun)}>{since(w.nextRun)}</span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="c-last fade">
        {w.totalRuns > 0 || w.recent.length > 0 ? (
          <>
            <RunStrip runs={w.recent} />
            {/* A plain link: the Runs screen is still the server's. */}
            <a className="muted tiny" href={`/runs?workflow=${encodeURIComponent(w.slug)}`}>
              {n("workflows.runs", w.totalRuns)}
            </a>
          </>
        ) : (
          <span className="muted small">{t("workflows.never_ran")}</span>
        )}
      </td>
      <td className="c-tags fade">
        <div className="wf-tags">
          {w.tags.map((tag) => (
            <Link key={tag} className="tag" to={query.hrefWith({ tag: toggled(query.sp.getAll("tag"), tag) })}>
              {tag}
            </Link>
          ))}
        </div>
      </td>
      <td className="c-run">
        {/* The run-now drawer is a later wave: the server's page keeps it. */}
        <a
          className="btn btn-icon"
          href={`/workflows/${encodeURIComponent(w.slug)}#run`}
          title={t("workflows.run.tip")}
          aria-label={t("workflows.run", { workflow: w.slug })}
        >
          ▶
        </a>
      </td>
    </tr>
  );
}

function toggled(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag];
}

function SortTh({ cls, label, field, query, data }: { cls: string; label: string; field: string; query: ReturnType<typeof useListLinks>; data: WorkflowsList }) {
  const { sort, dir } = data.filter;
  // Asc, then desc, then the natural order: the old page's three clicks.
  const patch: Patch = sort !== field ? { sort: field, dir: null } : dir === "asc" ? { dir: "desc" } : { sort: null, dir: null };
  const arrow = sort === field ? (dir === "desc" ? "↓" : "↑") : "↕";
  return (
    <th className={cls} aria-sort={sort === field ? (dir === "desc" ? "descending" : "ascending") : undefined}>
      <Link to={query.hrefWith(patch)}>
        {label} <span aria-hidden="true">{arrow}</span>
      </Link>
    </th>
  );
}

function TagPopover({ data, query }: { data: WorkflowsList; query: ReturnType<typeof useListLinks> }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [find, setFind] = useState("");
  const chosen = data.filter.tags;
  const shown = data.tags.filter((x) => x.toLowerCase().includes(find.toLowerCase()));
  return (
    <details className="popover">
      <summary className="chip">
        {t("workflows.col.tags")} {chosen.length > 0 && <b>{chosen.length}</b>}
      </summary>
      <div className="popover-body">
        <input type="search" aria-label={t("workflows.tags.filter")} placeholder={t("workflows.tags.filter")} value={find} onChange={(e) => setFind(e.target.value)} />
        <ul>
          {shown.map((tag) => (
            <li key={tag}>
              <label>
                <input type="checkbox" checked={chosen.includes(tag)} onChange={() => void navigate(query.hrefWith({ tag: toggled(chosen, tag) }))} /> {tag}
              </label>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="muted small">{t("workflows.tags.none")}</p>}
      </div>
    </details>
  );
}

function Chip({ label, value, to, mono }: { label: string; value: string; to: string; mono?: boolean }) {
  const { t } = useT();
  return (
    <Link className="chip" to={to} aria-label={t("workflows.chip.remove")}>
      <span className="muted">{label}:</span> <span className={mono ? "mono" : undefined}>{value}</span> <span className="muted">×</span>
    </Link>
  );
}

function ListBody({ data, query }: { data: WorkflowsList; query: ReturnType<typeof useListLinks> }) {
  const { t, n } = useT();
  const { number } = useFormat();
  const { toggle, pending, error, note, dismiss } = useScheduleToggle();
  const f = data.filter;
  const legacyState = f.state !== "" && !(STATES as readonly string[]).includes(f.state);

  return (
    <>
      <div className="wf-filters">
        <div className="seg" role="group" aria-label={t("workflows.filter.state")}>
          {STATES.map((s) => (
            <Link key={s} to={query.hrefWith({ state: s })} aria-current={f.state === s ? "true" : undefined}>
              {t(`workflows.state.${s || "all"}`)} <span className="muted">{number(data.counts[s] ?? 0)}</span>
            </Link>
          ))}
        </div>
        {legacyState && <Chip label={t("workflows.chip.last_run")} value={t(`state.${f.state}`)} to={query.hrefWith({ state: null })} />}
        {f.active && <Chip label={t("workflows.chip.schedule")} value={t(f.active === "active" ? "workflows.active" : "workflows.paused")} to={query.hrefWith({ active: null })} />}
        {f.project && <Chip label={t("workflows.chip.project")} value={f.project} to={query.hrefWith({ project: null })} mono />}
      </div>
      <div className="wf-filters">
        {data.tags.length > 0 && (
          <>
            <TagPopover data={data} query={query} />
            {f.tags.map((tag) => (
              <Link key={tag} className="chip" to={query.hrefWith({ tag: toggled(f.tags, tag) })} aria-label={t("workflows.tags.remove", { tag })}>
                {tag} <span className="muted">×</span>
              </Link>
            ))}
          </>
        )}
        {data.langs.length > 0 && (
          <div className="seg" role="group" aria-label={t("workflows.filter.lang")}>
            <Link to={query.hrefWith({ lang: null })} aria-current={f.lang === "" ? "true" : undefined}>
              {t("workflows.lang.all")}
            </Link>
            {data.langs.map((l) => (
              <Link key={l.key} to={query.hrefWith({ lang: l.key })} aria-current={f.lang === l.key ? "true" : undefined}>
                {l.name} <span className="muted">{number(l.count)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <p className="muted small wf-count">
        <b>{number(data.filtered)}</b> {n("workflows.count", data.total)}
        {f.q && <> {t("workflows.count.search", { q: f.q })}</>}
        {f.tags.map((tag) => (
          <span key={tag}> · {t("workflows.count.tag", { tag })}</span>
        ))}
        {f.lang && <> · {data.langs.find((l) => l.key === f.lang)?.name ?? f.lang}</>}
        {data.filtered !== data.total && (
          <Link to="?" className="clear">
            {t("workflows.clear")}
          </Link>
        )}
      </p>

      <div role="status" className="toast-line">
        {note && (
          <>
            {note.message}{" "}
            <button type="button" className="link" onClick={() => (toggle(note.slug), dismiss())}>
              {t("workflows.undo")}
            </button>
          </>
        )}
        {error && <span className="error">{error.message}</span>}
      </div>

      {data.rows.length === 0 ? (
        <div className="wf-empty">
          <p className="muted">{t("workflows.empty")}</p>
          <Link to="?">{t("workflows.clear")}</Link>
        </div>
      ) : (
        <>
          <table className="wf-table">
            <colgroup>
              {COLS.map(([c]) => (
                <col key={c} className={c} />
              ))}
            </colgroup>
            <thead>
              <tr>
                {COLS.map(([c, key]) => {
                  const field = (SORT_FIELD as Record<string, string | undefined>)[c];
                  return field && (SORTABLE as readonly string[]).includes(field) ? (
                    <SortTh key={c} cls={c} label={t(key)} field={field} query={query} data={data} />
                  ) : (
                    <th key={c} className={c}>
                      {key ? t(key) : <span className="sr-only">{t("workflows.run.tip")}</span>}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((w) => (
                <Row key={w.slug} w={w} query={query} busy={pending === w.slug} onToggle={() => toggle(w.slug)} />
              ))}
            </tbody>
          </table>
          <PagerNav page={f.page} perPage={f.perPage} total={data.filtered} hrefFor={(p) => query.hrefWith({ page: p > 1 ? String(p) : null }, true)} />
        </>
      )}
    </>
  );
}

// The list keeps the previous page on screen while a filter loads, and renews
// itself every 5s while the tab is visible (the query does not poll in the
// background).
function List() {
  const query = useListLinks();
  const qs = query.sp.toString();
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ["workflows", qs],
    queryFn: ({ signal }) => getJSON<WorkflowsList>(`/api/workflows${qs ? `?${qs}` : ""}`, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
  });
  if (isPending) return <WorkflowsSkeleton />;
  if (isError || !data)
    return (
      <div className="wf-empty" role="alert">
        <p>{error?.message ?? "The workflows are unavailable."}</p>
        <button type="button" className="btn" onClick={() => void refetch()}>
          Retry
        </button>
      </div>
    );
  return (
    <div aria-busy={isPlaceholderData} className={isPlaceholderData ? "wf-stale" : undefined}>
      <ListBody data={data} query={query} />
    </div>
  );
}

// The search box lives outside the data, so typing never remounts it; it
// writes to the URL after a pause.
function SearchBox() {
  const { t } = useT();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const urlQ = sp.get("q") ?? "";
  const [text, setText] = useState(urlQ);
  const sent = useRef(urlQ);
  useEffect(() => {
    if (urlQ !== sent.current) {
      sent.current = urlQ;
      setText(urlQ);
    }
  }, [urlQ]);
  useEffect(() => {
    const v = text.trim();
    if (v === sent.current) return;
    const id = setTimeout(() => {
      sent.current = v;
      const q = new URLSearchParams(window.location.search);
      q.delete("page");
      if (v) q.set("q", v);
      else q.delete("q");
      void navigate(`?${q.toString()}`, { replace: true });
    }, 250);
    return () => clearTimeout(id);
  }, [text, navigate]);
  return (
    <form role="search" className="wf-search" onSubmit={(e) => e.preventDefault()}>
      <input type="search" aria-label={t("workflows.search")} placeholder={t("workflows.search")} value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  );
}

function Head() {
  const { t } = useT();
  return (
    <>
      <h1 className="page-title">{t("nav.workflows")}</h1>
      <p className="muted lead">
        {t("workflows.lead.before")} <strong>{t("workflows.lead.strong")}</strong>
        {t("workflows.lead.after")} <a href="/runs">{t("workflows.lead.run")}</a>.
      </p>
      <SearchBox />
    </>
  );
}

export default function WorkflowsRoute() {
  return (
    <>
      <Suspense fallback={<Skeleton w="8rem" h="1.5rem" />}>
        <Head />
      </Suspense>
      <Suspense fallback={<WorkflowsSkeleton />}>
        <List />
      </Suspense>
    </>
  );
}
