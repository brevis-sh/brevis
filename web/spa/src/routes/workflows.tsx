import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import { useScheduleToggle, type Logo as LogoRef, type WorkflowRow, type WorkflowsList } from "../api/workflows";
import { useFormat, useT } from "../i18n";
import { useAgo } from "../ui/format";
import { buttonClass, chipClass, filterRow, noBar, segGroup, segOff, segOn } from "../ui/button";
import { linkClass } from "../ui/card";
import { CodeBlock } from "../ui/copy";
import { Drawer, useDrawer } from "../ui/drawer";
import { Icon } from "../ui/icon";
import { Logo } from "../ui/logo";
import { PageFrame } from "../ui/page-frame";
import { Pagination } from "../ui/pagination";
import { LoadError } from "../ui/query-boundary";
import { Skeleton } from "../ui/skeleton";
import { ToggleSwitch } from "../ui/toggle-switch";

const STATES = ["", "failing", "running", "paused", "manual"] as const;
const SORTABLE = [
  ["workflow", "workflows.col.workflow", "max-[640px]:pl-4"],
  ["schedule", "workflows.col.schedule", ""],
  ["next", "workflows.col.next", "max-[640px]:hidden"],
  ["last", "workflows.col.last", "max-[860px]:hidden"],
] as const;
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
type Links = ReturnType<typeof useListLinks>;

function toggled(tags: string[], tag: string): string[] {
  return tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag];
}

const zoneSuffix = (tz: string) => (tz === "" || tz === "UTC" || tz === "Etc/UTC" ? "" : ` (${tz})`);

// The column header, drawn from the address alone: its sort arrow needs no data.
const th = (extra: string) => `px-2.5 text-[11.5px] font-medium whitespace-nowrap text-faint ${extra}`;

function SortTh({ label, field, extra, links }: { label: string; field: string; extra: string; links: Links }) {
  const sort = links.sp.get("sort") ?? "";
  const dir = links.sp.get("dir") === "desc" ? "desc" : "asc";
  // Asc, then desc, then the natural order: the old page's three clicks.
  const patch: Patch = sort !== field ? { sort: field, dir: null } : dir === "asc" ? { dir: "desc" } : { sort: null, dir: null };
  return (
    <th className={`px-2.5 text-[11.5px] font-medium whitespace-nowrap ${extra} ${sort === field ? "text-ink" : "text-muted"}`} aria-sort={sort === field ? (dir === "desc" ? "descending" : "ascending") : undefined}>
      <Link to={links.hrefWith(patch)} className="inline-flex items-center gap-1 hover:underline">
        {label}
        {sort === field ? <span className="text-ink">{dir === "desc" ? "↓" : "↑"}</span> : <span className="text-line">↕</span>}
      </Link>
    </th>
  );
}

// A workflow's last runs as squares, oldest to newest, each a link to its run.
function RecentStrip({ runs }: { runs: WorkflowRow["recent"] }) {
  const { t } = useT();
  const { dateTime } = useFormat();
  if (runs.length === 0) return null;
  return (
    <div data-recent-runs className="flex items-center gap-0.5">
      {runs.map((r) => {
        const label = `${t(`state.${r.status}`)} · ${dateTime(r.at)}`;
        return <Link key={r.id} to={`/runs/${r.id}`} title={label} aria-label={label} className={`h-3 w-2 rounded-[1px] transition-opacity hover:opacity-70 ${FILL[r.status] ?? "bg-state-pending"}`} />;
      })}
    </div>
  );
}
const FILL: Record<string, string> = {
  success: "bg-state-success", failed: "bg-state-failed", running: "bg-state-running", queued: "bg-state-queued",
  retrying: "bg-state-retrying", canceled: "bg-state-canceled", skipped: "bg-state-skipped",
};

const playGlyph = (
  <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
    <path d="M2.5 1.6v8.8L10 6z" />
  </svg>
);
const runBtn = "inline-flex h-8 w-8 items-center justify-center rounded-card border border-line text-muted transition-colors hover:border-line-strong hover:bg-hover hover:text-ink";
const Tag = ({ tag, to }: { tag: string; to: string }) => (
  <Link to={to} className="inline-flex rounded-card border border-line bg-parchment px-2 py-0.5 text-[0.7rem] text-muted transition-colors hover:border-line-strong hover:text-ink">{tag}</Link>
);

function Row({ w, links, busy, onToggle }: { w: WorkflowRow; links: Links; busy: boolean; onToggle: () => void }) {
  const { t, n } = useT();
  const { dateTime } = useFormat();
  const since = useAgo();
  const navigate = useNavigate();
  const paused = w.hasSchedule && !w.active;
  const href = `/workflows/${encodeURIComponent(w.slug)}`;
  const langs = w.runsIn.map((l) => l.key);
  const langNames = w.runsIn.slice(0, 2).map((l) => l.name).join(" + ") + (w.runsIn.length > 2 ? ` +${w.runsIn.length - 2}` : "");
  // The whole row opens the workflow; the controls inside it keep their own click.
  const open = (e: MouseEvent) => {
    if (!(e.target as HTMLElement).closest("a, button, input, label, form")) void navigate(href);
  };
  return (
    <tr onClick={open} data-paused={paused || undefined} className="cursor-pointer align-top transition-colors hover:bg-hover">
      <td className="py-3 pl-5 max-[640px]:hidden">
        {w.hasSchedule ? (
          <ToggleSwitch on={w.active} busy={busy} label={t(w.active ? "workflows.pause" : "workflows.resume", { workflow: w.slug })} onToggle={onToggle} />
        ) : (
          <span className="block w-[30px] text-center text-faint" title={t("workflows.no_schedule.tip")}>—</span>
        )}
      </td>
      <td className="py-3 pr-3 max-[640px]:pl-4" data-fade>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link to={href} className="font-mono text-[13px] font-medium text-ink hover:underline">{w.slug}</Link>
          {w.failing ? (
            <span data-pill-failing className="rounded-full bg-state-failed/15 px-2 py-px text-[0.7rem] text-state-failed">{t("workflows.pill.failing")}</span>
          ) : w.inFlight ? (
            <span data-pill-running className="rounded-full bg-state-running/15 px-2 py-px text-[0.7rem] text-state-running">{t("workflows.pill.running")}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          <Link to={links.hrefWith({ project: w.project })} className="hover:text-ink hover:underline">{w.project}</Link>
          {w.steps !== null && <> · {n("workflows.steps", w.steps)}</>}
        </p>
      </td>
      <td className="py-3 pr-3 max-[640px]:hidden" data-fade>
        {langs.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1">
              {langs.slice(0, 4).map((k) => <Logo key={k} k={k} />)}
            </span>
            <span className="text-xs whitespace-nowrap text-ink-2">{langNames}</span>
          </div>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="py-3 pr-3 max-[1100px]:hidden" data-fade>
        <span className="inline-flex flex-wrap items-center gap-1">
          {w.connects.map((l) => <Logo key={l.key} k={l.key} />)}
        </span>
      </td>
      <td className="py-3 pr-3" data-fade>
        {w.cron === "" ? (
          <span className="text-xs text-muted">{t("workflows.manual_only")}</span>
        ) : (
          <>
            {paused ? (
              <p className="text-xs text-muted">
                {t("workflows.paused")}
                {w.schedule && <> · {t("workflows.was", { schedule: w.schedule })}</>}
              </p>
            ) : (
              w.schedule && <p className="text-xs text-ink">{w.schedule}{zoneSuffix(w.timezone)}</p>
            )}
            <p className="mt-0.5 font-mono text-[0.7rem] text-faint">
              {w.cron}
              {w.catchup && <span className="ml-1.5 font-sans">catchup</span>}
            </p>
          </>
        )}
      </td>
      <td className="py-3 pr-3 text-xs tabular-nums max-[640px]:hidden" data-fade>
        {w.inFlight ? (
          <span className="text-state-running">{t("workflows.in_flight")}</span>
        ) : w.nextRun && !paused ? (
          <span className="text-ink" title={dateTime(w.nextRun)}>{since(w.nextRun)}</span>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
      <td className="py-3 pr-3 max-[860px]:hidden" data-fade>
        {w.totalRuns > 0 || w.recent.length > 0 ? (
          <>
            <RecentStrip runs={w.recent} />
            <Link to={`/runs?workflow=${encodeURIComponent(w.slug)}`} className="mt-1 block text-[0.7rem] tabular-nums text-muted hover:underline">
              {n("workflows.runs", w.totalRuns)}
            </Link>
          </>
        ) : (
          <span className="text-xs text-muted">{t("workflows.never_ran")}</span>
        )}
      </td>
      <td className="py-3 pr-3 max-[1100px]:hidden" data-fade>
        <div className="flex flex-wrap gap-1">
          {w.tags.map((tag) => <Tag key={tag} tag={tag} to={links.hrefWith({ tag: toggled(links.sp.getAll("tag"), tag) })} />)}
        </div>
      </td>
      <td className="py-3 pr-5 text-right">
        {w.hasParams ? (
          // Parameters are asked for in the workflow's own drawer, which is still the server's.
          <a href={`${href}#run`} title={t("workflows.run.tip")} aria-label={t("workflows.run", { workflow: w.slug })} className={runBtn}>{playGlyph}</a>
        ) : (
          <form method="post" action={`${href}/trigger`} className="inline">
            <input type="hidden" name="back" value="/app/workflows" />
            <button type="submit" title={t("workflows.run.tip")} aria-label={t("workflows.run", { workflow: w.slug })} className={runBtn}>{playGlyph}</button>
          </form>
        )}
      </td>
    </tr>
  );
}

function RowsSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }, (_, i) => (
        <tr key={i} aria-hidden="true" className="align-top">
          <td className="py-3 pl-5 max-[640px]:hidden"><Skeleton w="30px" h="18px" /></td>
          <td className="py-3 pr-3 max-[640px]:pl-4"><Skeleton w="9rem" h="16px" /><div className="mt-1"><Skeleton w="6rem" h="14px" /></div></td>
          <td className="py-3 pr-3 max-[640px]:hidden"><Skeleton w="6rem" h="18px" /></td>
          <td className="py-3 pr-3 max-[1100px]:hidden"><Skeleton w="3rem" h="18px" /></td>
          <td className="py-3 pr-3"><Skeleton w="8rem" h="14px" /><div className="mt-1"><Skeleton w="5rem" h="12px" /></div></td>
          <td className="py-3 pr-3 max-[640px]:hidden"><Skeleton w="3.5rem" h="14px" /></td>
          <td className="py-3 pr-3 max-[860px]:hidden"><Skeleton w="7rem" h="12px" /><div className="mt-1"><Skeleton w="4rem" h="11px" /></div></td>
          <td className="py-3 pr-3 max-[1100px]:hidden"><Skeleton w="4rem" h="18px" /></td>
          <td className="py-3 pr-5 text-right"><Skeleton w="2rem" h="2rem" className="ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}

// The tags to choose from: a popover of checkboxes, each one a link's worth of filter.
function TagPopover({ data, links }: { data?: WorkflowsList; links: Links }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [find, setFind] = useState("");
  const [at, setAt] = useState({ top: 0, left: 0 });
  const chosen = data ? data.filter.tags : links.sp.getAll("tag");
  const shown = (data?.tags ?? []).filter((x) => x.toLowerCase().includes(find.toLowerCase()));
  return (
    <details className="shrink-0" onToggle={(e) => {
      // The row scrolls sideways, which would clip an absolute panel: it is placed from the trigger instead.
      const r = e.currentTarget.querySelector("summary")?.getBoundingClientRect();
      if (r) setAt({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 270) });
    }}>
      <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-card border border-line bg-surface px-2.5 text-[0.8rem] text-muted transition-colors duration-150 hover:text-ink [&::-webkit-details-marker]:hidden">
        <Icon name="tag" className="h-3.5 w-3.5" />
        {t("workflows.col.tags")}
        {chosen.length > 0 && <span className="text-[0.72rem] text-ink tabular-nums">{chosen.length}</span>}
      </summary>
      <div style={at} className="fixed z-20 w-64 rounded-card border border-line bg-surface p-2 shadow-warm-sm">
        <input
          type="search"
          aria-label={t("workflows.tags.filter")}
          placeholder={t("workflows.tags.filter")}
          autoComplete="off"
          value={find}
          onChange={(e) => setFind(e.target.value)}
          className="mb-2 h-8 w-full rounded-card border border-line bg-surface px-2.5 text-[0.82rem] text-ink placeholder:text-faint focus:border-accent-strong focus:outline-none"
        />
        <ul className="max-h-60 overflow-y-auto">
          {shown.map((tag) => (
            <li key={tag}>
              <label className="flex cursor-pointer items-center gap-2 rounded-[2px] px-1.5 py-1 text-[0.82rem] text-ink hover:bg-surface-2">
                <input type="checkbox" className="accent-ink" checked={chosen.includes(tag)} onChange={() => void navigate(links.hrefWith({ tag: toggled(chosen, tag) }))} />
                {tag}
              </label>
            </li>
          ))}
        </ul>
        {shown.length === 0 && <p className="px-1.5 py-1 text-[0.8rem] text-muted">{t("workflows.tags.none")}</p>}
      </div>
    </details>
  );
}

function Chip({ label, value, to, mono }: { label: string; value: string; to: string; mono?: boolean }) {
  const { t } = useT();
  return (
    <Link to={to} aria-label={t("workflows.chip.remove")} className={chipClass}>
      <span className="text-muted">{label}:</span>
      <span className={mono ? "font-mono" : undefined}>{value}</span>
      <span className="text-muted">×</span>
    </Link>
  );
}

// The three rows of controls. The state question is drawn at once (its counts wait); the
// tag and language filters come from what the workflows are, so they come with the data.
function Filters({ data, links }: { data?: WorkflowsList; links: Links }) {
  const { t } = useT();
  const { number } = useFormat();
  const state = data ? data.filter.state : (links.sp.get("state") ?? "");
  const active = data ? data.filter.active : (links.sp.get("active") ?? "");
  const project = data ? data.filter.project : (links.sp.get("project") ?? "");
  const legacyState = state !== "" && !(STATES as readonly string[]).includes(state);
  return (
    <>
      <div role="group" aria-label={t("workflows.filter.state")} className={segGroup}>
        {STATES.map((s) => (
          <Link key={s} to={links.hrefWith({ state: s })} aria-current={state === s ? "true" : undefined} className={state === s ? segOn : segOff}>
            {t(`workflows.state.${s || "all"}`)}
            {data && <span className={`text-[0.72rem] tabular-nums ${state === s ? "text-muted" : "text-faint"}`}>{number(data.counts[s] ?? 0)}</span>}
          </Link>
        ))}
      </div>
      {legacyState && <Chip label={t("workflows.chip.last_run")} value={t(`state.${state}`)} to={links.hrefWith({ state: null })} />}
      {active && <Chip label={t("workflows.chip.schedule")} value={t(active === "active" ? "workflows.active" : "workflows.paused")} to={links.hrefWith({ active: null })} />}
      <LangFilter data={data} links={links} />
      <TagPopover data={data} links={links} />
      {data?.filter.tags.map((tag) => (
        <Link key={tag} to={links.hrefWith({ tag: toggled(data.filter.tags, tag) })} aria-label={t("workflows.tags.remove", { tag })} className={chipClass}>
          {tag}
          <span className="text-muted">×</span>
        </Link>
      ))}
      {project && <Chip label={t("workflows.chip.project")} value={project} to={links.hrefWith({ project: null })} mono />}
    </>
  );
}

function LangFilter({ data, links }: { data?: WorkflowsList; links: Links }) {
  const { t } = useT();
  const { number } = useFormat();
  const lang = data ? data.filter.lang : (links.sp.get("lang") ?? "");
  return (
    <div role="group" aria-label={t("workflows.filter.lang")} className="flex shrink-0 items-center gap-1.5">
      <span className="text-[0.75rem] text-faint">{t("workflows.filter.lang")}</span>
      <div className={segGroup}>
        <Link to={links.hrefWith({ lang: null })} aria-current={lang === "" ? "true" : undefined} className={lang === "" ? segOn : segOff}>{t("workflows.lang.all")}</Link>
        {data?.langs.map((l: LogoRef & { count: number }) => (
          <Link key={l.key} to={links.hrefWith({ lang: l.key })} aria-current={lang === l.key ? "true" : undefined} className={lang === l.key ? segOn : segOff}>
            <Logo k={l.key} />
            {l.name}
            <span className="text-[0.72rem] text-muted tabular-nums">{number(l.count)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Count({ data }: { data?: WorkflowsList }) {
  const { t, n } = useT();
  const { number } = useFormat();
  if (!data) return <p className="mb-2" style={{ height: 19.5 }}><Skeleton w="12rem" h="14px" /></p>;
  const f = data.filter;
  return (
    <p className="mb-2 text-[13px] text-muted">
      <span className="font-semibold text-ink tabular-nums">{number(data.filtered)}</span> {n("workflows.count", data.total)}
      {f.q && <> {t("workflows.count.search", { q: f.q })}</>}
      {f.tags.map((tag) => <span key={tag}> · {t("workflows.count.tag", { tag })}</span>)}
      {f.lang && <> · {data.langs.find((l) => l.key === f.lang)?.name ?? f.lang}</>}
      {data.filtered !== data.total && <Link to="?" className={`ml-3 text-xs ${linkClass}`}>{t("workflows.clear")}</Link>}
    </p>
  );
}

// The table: its header is the screen's; its rows are data. With no rows to show the
// box says so instead.
function Table({ data, links, toggler }: { data?: WorkflowsList; links: Links; toggler: ReturnType<typeof useScheduleToggle> }) {
  const { t } = useT();
  if (data && data.rows.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line px-6 py-12 text-center">
        <p className="text-sm text-muted">{t("workflows.empty")}</p>
        <Link to="?" className={`mt-2 inline-block text-xs ${linkClass}`}>{t("workflows.clear")}</Link>
      </div>
    );
  }
  const f = data?.filter;
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-warm-sm">
      <table className="ct w-full text-sm min-[860px]:min-w-[60rem]" aria-busy={!data}>
        <thead>
          <tr className="border-b border-line bg-parchment-soft/60 text-left">
            <th className={th("w-16 pl-5 max-[640px]:hidden")}>{t("workflows.col.active")}</th>
            <SortTh label={t(SORTABLE[0][1])} field={SORTABLE[0][0]} extra={SORTABLE[0][2]} links={links} />
            <th className={th("max-[640px]:hidden")}>{t("workflows.col.lang")}</th>
            <th className={th("max-[1100px]:hidden")}>{t("workflows.col.connects")}</th>
            <SortTh label={t(SORTABLE[1][1])} field={SORTABLE[1][0]} extra={SORTABLE[1][2]} links={links} />
            <SortTh label={t(SORTABLE[2][1])} field={SORTABLE[2][0]} extra={SORTABLE[2][2]} links={links} />
            <SortTh label={t(SORTABLE[3][1])} field={SORTABLE[3][0]} extra={SORTABLE[3][2]} links={links} />
            <th className={th("max-[1100px]:hidden")}>{t("workflows.col.tags")}</th>
            <th className={th("w-24 pr-5 text-right")}><span className="sr-only">{t("workflows.run.tip")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {data ? data.rows.map((w) => <Row key={w.slug} w={w} links={links} busy={toggler.pending === w.slug} onToggle={() => toggler.toggle(w.slug)} />) : <RowsSkeleton />}
        </tbody>
      </table>
      {data && f && <Pagination page={f.page} perPage={f.perPage} total={data.filtered} pages={Math.ceil(data.filtered / f.perPage)} to={(p) => links.hrefWith({ page: p > 1 ? String(p) : null }, true)} />}
    </div>
  );
}

// The search box lives outside the data, so typing never remounts it; it writes
// to the URL after a pause.
function SearchBox() {
  const { t } = useT();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
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
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [contenteditable], dialog")) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
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
    <form role="search" onSubmit={(e) => e.preventDefault()} className="min-w-[12rem] flex-1">
      <label className="relative flex min-w-0 items-center">
        <span className="pointer-events-none absolute left-2.5 text-faint"><Icon name="search" className="h-4 w-4" /></span>
        <input
          ref={input}
          type="search"
          aria-label={t("workflows.search")}
          placeholder={t("workflows.search")}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-8 w-full rounded-card border border-line bg-surface pr-9 pl-8 text-[0.82rem] text-ink placeholder:text-faint focus:border-accent-strong focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2">
          <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-card border border-line bg-surface-2 px-1 font-mono text-[0.68rem] leading-none text-muted">/</kbd>
        </span>
      </label>
    </form>
  );
}

const CREATE_EXAMPLE = `name: daily_orders
schedule: "0 4 * * *"
steps:
  - id: load
    run: python load.py
  - id: build
    run: dbt build --select orders+`;

function useDocs() {
  const { lang } = useT();
  const prefix = lang === "pt-BR" ? "pt/" : lang === "zh-CN" ? "zh/" : lang === "en" || !lang ? "" : `${lang}/`;
  return `https://brevis.sh/${prefix}docs/workflows/`;
}

// A workflow is born in the repository and published by the CLI: both header
// buttons open the drawer that says how. They stay links to the docs, which
// is what the server's did with no script.
function Actions() {
  const { t } = useT();
  const docs = useDocs();
  const { show } = useDrawer("how-to-create");
  return (
    <div className="flex items-center gap-2">
      {(["secondary", "primary"] as const).map((kind) => (
        <a
          key={kind}
          href={docs}
          onClick={(e) => {
            e.preventDefault();
            show();
          }}
          className={buttonClass(kind, "regular")}
        >
          <Icon name={kind === "primary" ? "plus" : "book-open"} className="h-3.5 w-3.5" />
          {t(kind === "primary" ? "workflows.create.publish" : "workflows.create.how")}
        </a>
      ))}
    </div>
  );
}

function HowToCreate() {
  const { t } = useT();
  const docs = useDocs();
  return (
    <Drawer id="how-to-create" plain title={t("workflows.create.title")}>
      <div className="space-y-4 px-5 py-4 text-[13px] text-ink-2">
        <p>{t("workflows.create.lead")}</p>
        <div>
          <p className="mb-1.5 font-medium text-ink">1. {t("workflows.create.file")}</p>
          <CodeBlock scroll text={CREATE_EXAMPLE} />
        </div>
        <div>
          <p className="mb-1.5 font-medium text-ink">2. {t("workflows.create.validate")}</p>
          <CodeBlock scroll text="brevis validate workflows/" />
        </div>
        <div>
          <p className="mb-1.5 font-medium text-ink">3. {t("workflows.create.publish_step")}</p>
          <CodeBlock scroll text="brevis publish --project <project> workflows/" />
          <p className="mt-1.5 text-xs text-muted">{t("workflows.create.publish_note")}</p>
        </div>
        <a href={docs} className="inline-block text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
          {t("workflows.create.docs")}
        </a>
      </div>
    </Drawer>
  );
}

export default function WorkflowsRoute() {
  const { t } = useT();
  const links = useListLinks();
  const toggler = useScheduleToggle();
  const qs = links.sp.toString();
  // The list keeps the previous page on screen while a filter loads, and renews itself
  // every 5s while the tab is visible (the query does not poll in the background).
  const q = useQuery({
    queryKey: ["workflows", qs],
    queryFn: ({ signal }) => getJSON<WorkflowsList>(`/api/workflows${qs ? `?${qs}` : ""}`, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
  });
  const data = q.data;
  const { note, error, dismiss, toggle } = toggler;
  return (
    <PageFrame title={t("nav.workflows")} actions={<Actions />}>
      <HowToCreate />
      <p className="mb-4 max-w-3xl text-[13.5px] text-muted">
        {t("workflows.lead.before")} <strong className="font-medium text-ink">{t("workflows.lead.strong")}</strong>
        {t("workflows.lead.after")} <Link to="/runs" className={linkClass}>{t("workflows.lead.run")}</Link>.
      </p>
      <div className={`${filterRow} mb-3`} style={noBar}>
        <SearchBox />
        <Filters data={data} links={links} />
      </div>
      <div aria-busy={q.isPlaceholderData || !data} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
        {q.isError && !data ? (
          <LoadError onRetry={() => void q.refetch()} />
        ) : (
          <>
            <Count data={data} />
            <div role="status">
              {note && (
                <p className="mb-2 text-[12.5px] text-muted">
                  {note.message}{" "}
                  <button type="button" className={linkClass} onClick={() => (toggle(note.slug), dismiss())}>{t("workflows.undo")}</button>
                </p>
              )}
              {error && <p className="mb-2 text-[12.5px] text-state-failed">{error.message}</p>}
            </div>
            <Table data={data} links={links} toggler={toggler} />
          </>
        )}
      </div>
    </PageFrame>
  );
}
