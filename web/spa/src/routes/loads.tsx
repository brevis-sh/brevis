import { Link, useNavigate } from "react-router";
import { useData } from "../api/live";
import type { Choice, LoadRow, Loads, Source } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { localStamp, useSince } from "../ui/format";
import { Icon } from "../ui/icon";
import { ButtonLink, Empty, Lead, PageHead, linkUnderline, Page } from "../ui/kit";
import { Logo } from "../ui/logo";
import { Place, PlaceBlock } from "../ui/place";
import { FilterBar, ResultCount, SearchField, ToggleFilter, useUrlSearch, type Chip, type FilterDef } from "../ui/filters";
import { useSeen } from "../ui/seen";
import { useStatusFilter } from "../ui/status-filter";
import { Sparkline } from "../ui/sparkline";
import { Freshness, FreshnessMark } from "../ui/status";
import { Row, Table, Td, Th } from "../ui/table";
import { useFilter } from "../ui/use-filter";

// The statuses a load can have, in the band's order (a step is never
// continuous, nor its destination unidentified).
const STATUSES = ["stale", "late", "on_time", "paused", "unscheduled"] as const;
const FIELDS = ["status", "source", "legacy", "q"] as const;
type Filter = ReturnType<typeof useFilter>;

function SourceCell({ s }: { s: Source }) {
  const { t } = useT();
  if (s.kind === "")
    return (
      <div className="max-w-[12rem] min-w-0">
        <span className="text-[12px] text-faint" title={t("loads.source.none.tip")}>
          {t("loads.source.none")}
        </span>
      </div>
    );
  return (
    <PlaceBlock
      max="max-w-[12rem]"
      mark={s.kind === "http" || s.kind === "file" ? <Logo k={s.kind} /> : s.kind === "database" ? <Icon name="database" className="h-3.5 w-3.5 text-muted" /> : null}
      label={s.label}
      where={s.where || undefined}
    />
  );
}

function Head() {
  const { t } = useT();
  return (
    <>
      <Th edge="first">{t("loads.col.who")}</Th>
      <Th cls="max-[860px]:hidden">{t("loads.col.flow")}</Th>
      <Th>{t("loads.col.status")}</Th>
      <Th cls="max-[640px]:hidden">{t("loads.col.last")}</Th>
      <Th cls="text-right max-[1100px]:hidden">{t("loads.col.rows")}</Th>
      <Th edge="last" cls="max-[1100px]:hidden">
        {t("loads.col.recent")}
      </Th>
    </>
  );
}

function Rows({ rows }: { rows: LoadRow[] }) {
  const { t, n } = useT();
  const { number } = useFormat();
  const since = useSince();
  const navigate = useNavigate();
  return (
    <>
      {rows.map((r) => (
        <Row key={r.href} onOpen={() => navigate(r.href)}>
          <Td edge="first">
            <Link to={`/workflows/${encodeURIComponent(r.workflow)}`} className="font-mono text-[13px] font-medium text-ink hover:underline">
              {r.workflow}
            </Link>
            <p className="mt-0.5 text-[12px] text-muted">
              <Link to={r.href} className="font-mono text-ink-2 hover:underline">
                {r.step}
              </Link>{" "}
              <span className="text-faint">·</span> {r.schedule}
            </p>
          </Td>
          <Td cls="max-[860px]:hidden">
            <div className="flex items-start gap-3">
              <SourceCell s={r.source} />
              <span className="mt-2 text-faint" aria-hidden="true">
                &rarr;
              </span>
              <div className="min-w-0">
                <Place p={r.target} max="max-w-[16rem]" />
                {r.legacy && <span className="mt-1 inline-block rounded border border-line px-1.5 font-mono text-[10.5px] text-muted">{t("catalog.chip.legacy")}</span>}
              </div>
            </div>
          </Td>
          <Td>
            <Freshness status={r.status} />
            {r.fixing && (
              <Link to={`/runs/${r.fixing}`} className="mt-0.5 block text-[11.5px] text-state-running hover:underline">
                {t("loads.fixing")}
              </Link>
            )}
          </Td>
          <Td cls="text-xs whitespace-nowrap text-muted max-[640px]:hidden" title={r.lastLoaded ? localStamp(r.lastLoaded) : undefined}>
            <span>{r.lastLoaded ? since(r.lastLoaded) : "—"}</span>
          </Td>
          <Td cls="text-right text-xs tabular-nums text-ink-2 max-[1100px]:hidden">
            {r.rows === null ? (
              <span className="text-faint" title={t("catalog.no_rows")}>
                —
              </span>
            ) : (
              <span title={n("loads.drawer.rows", r.rows)}>{number(r.rows)}</span>
            )}
          </Td>
          <Td edge="last" cls="max-[1100px]:hidden">
            <Sparkline values={r.recent} />
          </Td>
        </Row>
      ))}
    </>
  );
}

// What the screen shows before its first answer: the last shape it saw (rows, counts, filters), or
// this one on a first visit. The rows are the real ones drawn from placeholder values, so they take
// the height the loaded ones take.
type Shape = { n: number; total: number; workflows: number; summary: Record<string, number>; counts: Record<string, number>; sources: number; hasLegacy: boolean };
// A first visit draws the empty state (a fresh install has no loads); the box is the one the real empty state fills.
const FIRST: Shape = { n: 0, total: 0, workflows: 0, summary: {}, counts: {}, sources: 0, hasLegacy: false };
// Only numbers are remembered, and only under the fixed status words: nothing the API says about the data.
const numbers = (r: Record<string, number>) => Object.fromEntries(Object.entries(r).filter(([k, n]) => (k === "" || STATUSES.includes(k as never) || k === "attention") && typeof n === "number"));
const shapeOf = (v: Loads): Shape => ({ n: v.rows.length, total: v.total, workflows: v.workflows, summary: numbers(v.summary), counts: numbers(v.counts), sources: v.sources.length, hasLegacy: v.hasLegacy });
const GHOST_ROW: LoadRow = {
  workflow: "workflow_name",
  step: "load_step_name",
  href: "",
  target: { uri: "", kind: "postgres", kindTitle: "", where: "postgres://warehouse/", what: "table_name", note: "" },
  legacy: false,
  status: "on_time",
  lastLoaded: "2000-01-01T00:00:00Z",
  rows: 1000,
  schedule: "every hour",
  source: { kind: "http", driver: "", label: "Source label", where: "api.example.com" },
  recent: [1, 3, 2, 4],
  fixing: null,
};
const ghostOf = (s: Shape): Loads => ({
  rows: Array.from({ length: s.n }, (_, i) => ({ ...GHOST_ROW, href: `#${i}` })),
  total: s.total,
  workflows: s.workflows,
  summary: s.summary,
  counts: s.counts,
  sources: Array.from({ length: s.sources }, (_, i): Choice => ({ key: `source${i}`, label: "Source" })),
  hasLegacy: s.hasLegacy,
  filter: { status: "", source: "", q: "", legacy: false },
});

function Summary({ v, ghost }: { v: Loads; ghost: boolean }) {
  const { t, n } = useT();
  if (v.total === 0) return null;
  return (
    <div aria-hidden={ghost || undefined} className={`mb-4 flex ${ghost ? "sk-ghost" : ""} flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]`}>
      <span className="text-muted">{n("loads.summary.destinations", v.total)}</span>
      <span className="text-muted">{n("loads.summary.workflows", v.workflows)}</span>
      {STATUSES.filter((s) => (v.summary[s] ?? 0) > 0).map((s) => (
        <span key={s} className="inline-flex items-baseline gap-1.5">
          <span className="font-medium text-ink tabular-nums">{v.summary[s]}</span>
          <Freshness status={s} />
        </span>
      ))}
      <Link to={`/data${v.filter.status ? `?status=${encodeURIComponent(v.filter.status)}` : ""}`} className="text-ink-2 hover:text-ink hover:underline">
        {t("loads.catalog")} &rarr;
      </Link>
    </div>
  );
}

// The bar (see ui/filters): drawn at once from the last shape seen; only the counts wait.
function LoadsBar({ filter, v, ghost }: { filter: Filter; v: Loads; ghost: boolean }) {
  const { t, n } = useT();
  const { number } = useFormat();
  const navigate = useNavigate();
  const [text, setText] = useUrlSearch("q");
  const go = (patch: Record<string, string>) => void navigate(filter.hrefWith(patch));
  const source = filter.get("source");
  const legacy = filter.get("legacy") === "1";
  const q = filter.get("q");
  const st = useStatusFilter({
    statuses: STATUSES,
    count: (k) => v.counts[k] ?? 0,
    pending: ghost,
    mark: (s) => <FreshnessMark status={s} />,
    status: filter.get("status"),
    onChange: (status) => go({ status }),
  });
  const sourceMark = (k: string) => (k === "http" || k === "file" ? <Logo k={k} /> : k === "database" ? <Icon name="database" className="h-3.5 w-3.5 text-muted" /> : undefined);
  const filters: FilterDef[] = [
    st.def,
    ...(v.sources.length > 1
      ? [{
          id: "source", label: t("loads.source"), allLabel: t("loads.source.all"), pending: ghost,
          options: v.sources.map((s) => ({ key: s.key, label: s.label, icon: sourceMark(s.key) })),
          value: source ? [source] : [], onChange: (x: string[]) => go({ source: x[0] ?? "" }),
        } satisfies FilterDef]
      : []),
  ];
  const chips: Chip[] = [
    ...st.chip,
    ...(source ? [{ id: "source", group: t("loads.source"), value: v.sources.find((s) => s.key === source)?.label ?? source, onRemove: () => go({ source: "" }) }] : []),
  ];
  return (
    <FilterBar
      search={<SearchField value={text} onChange={setText} label={t("loads.search")} />}
      primary={<>{st.primary}{v.hasLegacy && <ToggleFilter label={t("catalog.legacy")} on={legacy} onChange={(on) => go({ legacy: on ? "1" : "" })} />}</>}
      filters={filters}
      chips={chips}
      clearable={filter.any}
      onClearAll={() => go({ status: "", source: "", legacy: "", q: "" })}
      count={<ResultCount pending={ghost} shown={v.rows.length} tail={<>{n("loads.count", v.total, { count: number(v.total) })}{q && <> {t("workflows.count.search", { q })}</>}</>} />}
    />
  );
}

function LoadsData({ filter }: { filter: Filter }) {
  const { t } = useT();
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Loads>(["ingest", "loads", qs.toString()], `/api/ingest/loads${qs.size ? `?${qs}` : ""}`, { topic: "ingest" });
  const ghost = !q.data;
  // Only the unfiltered answer is remembered: a filter's counts are not the list's shape.
  const seen = useSeen("loads", qs.size === 0 && q.data ? shapeOf(q.data) : undefined, FIRST);
  const v = q.data ?? ghostOf(seen);
  const shown = v.total > 0 || v.hasLegacy;
  const none = v.rows.length === 0;
  return (
    <>
      <Summary v={v} ghost={ghost} />
      {shown && (
        <LoadsBar filter={filter} v={v} ghost={ghost} />
      )}
      <div aria-busy={ghost}>
        {q.isError ? (
          <p role="alert" className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
            {(q.error as Error).message}
          </p>
        ) : none ? (
          <div aria-hidden={ghost || undefined} className={ghost ? "sk-ghost" : undefined}>
          {filter.any && shown ? (
            <Empty msg={t("loads.empty.filtered")}>
              <Link to="/ingest/loads" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
                {t("workflows.clear")}
              </Link>
            </Empty>
          ) : (
            <div className="rounded-card border border-dashed border-line px-6 py-12 text-center">
              <p className="text-sm text-muted">{t("loads.empty")}</p>
              <p className="mt-1 text-xs text-faint">{t("loads.empty.how")}</p>
            </div>
          )}
          </div>
        ) : (
          <Table id="load-rows" head={<Head />} foot={t("loads.honest")} ghost={ghost} memo="loads">
            <Rows rows={v.rows} />
          </Table>
        )}
      </div>
    </>
  );
}

/** The list; `missing` names a step the address asked for that writes no destination (the server draws the list with that note). */
export default function LoadsRoute({ missing = "" }: { missing?: string }) {
  const { t } = useT();
  const filter = useFilter(FIELDS, "/ingest/loads");
  return (
    <Page>
      <PageHead
        title={t("loads.title")}
        actions={
          <ButtonLink to="/workflows" icon="workflow">
            {t("loads.workflows")}
          </ButtonLink>
        }
      />
      <Lead before={t("loads.lead.before")} strong={t("loads.lead.strong")} after={` ${t("loads.lead.after")}`} />
      {missing !== "" && (
        <p className="mb-3 rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">{t("loads.missing", { step: missing })}</p>
      )}
      <LoadsData filter={filter} />
    </Page>
  );
}
