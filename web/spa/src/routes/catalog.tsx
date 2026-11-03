import { lazy, Suspense } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { ApiError } from "../api/client";
import { useData } from "../api/live";
import { useFormat, useT } from "../i18n";
import { useSince } from "../ui/format";
import { Icon } from "../ui/icon";
import { Empty, FilterRow, Lead, PageHead, linkUnderline, Page } from "../ui/kit";
import { Logo, useLogoTitle } from "../ui/logo";
import { Band, SearchBox, Segmented, Switch } from "../ui/segmented";
import { Skeleton } from "../ui/skeleton";
import { Freshness, StatusMark, freshnessKind } from "../ui/status";
import { Row, Table, Td, Th } from "../ui/table";
import { useFilter, useSearchBox } from "../ui/use-filter";
import type { TargetDetail } from "./target-drawer";

export type CatalogRow = {
  target: string;
  kind: string;
  legacy: boolean;
  status: string;
  where: string;
  what: string;
  autoTable: boolean;
  writer: string;
  more: number;
  queued: boolean;
  lastAt: string | null;
  lastRows: number | null;
  recent: (number | null)[];
  streamHref: string;
};
type Catalog = {
  now: string;
  kinds: string[];
  hasLegacy: boolean;
  total: number;
  shown: number;
  counts: Record<string, number>;
  rows: CatalogRow[];
};

const FIELDS = ["status", "kind", "legacy", "q"] as const;
const STATUSES = ["stale", "late", "on_time", "continuous", "paused", "unscheduled", "unidentified"];
type Filter = ReturnType<typeof useFilter>;

// The drawer is a separate chunk: most visits to the catalog never open one.
const TargetDrawer = lazy(() => import("./target-drawer"));

/** The last loads of a destination as small bars, the tallest the largest; a load that did not say its rows is an outline. */
function Recent({ counts }: { counts: (number | null)[] }) {
  if (counts.length === 0) return null;
  const peak = Math.max(0, ...counts.map((c) => c ?? 0));
  return (
    <span className="inline-flex h-5 items-end gap-px" aria-hidden="true">
      {counts.map((c, i) =>
        c === null ? (
          <span key={i} className="h-full w-1 rounded-[1px] border border-line-strong" />
        ) : (
          <span key={i} className="w-1 rounded-[1px] bg-bar" style={{ height: `${peak > 0 ? Math.max(12, Math.floor((c * 100) / peak)) : 12}%` }} />
        ),
      )}
    </span>
  );
}

const legacyChip = "ml-1.5 rounded border border-line px-1.5 font-mono text-[10.5px] text-muted";

function Head() {
  const { t } = useT();
  return (
    <>
      <Th edge="first" cls="whitespace-nowrap">{t("catalog.col.target")}</Th>
      <Th cls="whitespace-nowrap">{t("catalog.col.status")}</Th>
      <Th cls="whitespace-nowrap max-[860px]:hidden">{t("catalog.col.writer")}</Th>
      <Th cls="whitespace-nowrap max-[640px]:hidden">{t("catalog.col.last")}</Th>
      <Th cls="whitespace-nowrap text-right max-[1100px]:hidden">{t("catalog.col.rows")}</Th>
      <Th cls="whitespace-nowrap max-[1100px]:hidden">{t("catalog.col.recent")}</Th>
      <Th edge="last" cls="w-8" />
    </>
  );
}

function CatalogRows({ rows, filter, now }: { rows: CatalogRow[]; filter: Filter; now: string }) {
  const { t } = useT();
  const f = useFormat();
  const since = useSince();
  const navigate = useNavigate();
  return (
    <>
      {rows.map((r) => {
        const href = r.streamHref || filter.hrefWith({}, "/data/target", { u: r.target });
        return (
          <Row key={r.target || r.streamHref} onOpen={() => navigate(href)}>
            <Td edge="first">
              <Link to={href} className="inline-flex min-w-0 flex-wrap items-center gap-1.5 font-mono text-[12.5px]">
                {r.target === "" ? (
                  <>
                    <Logo k="gateway" />
                    <span className="text-ink-2">{r.writer}</span>
                  </>
                ) : (
                  <>
                    <Logo k={r.kind} />
                    <span className="text-faint">{r.where}</span>
                    <span className="font-medium text-ink">{r.what}</span>
                  </>
                )}
              </Link>
              {r.legacy && <span className={legacyChip}>{t("catalog.chip.legacy")}</span>}
              {r.autoTable && <span className={legacyChip}>auto_table</span>}
            </Td>
            <Td>
              <Freshness status={r.status} />
              {r.queued && <p className="mt-0.5 text-[11.5px] text-muted">{t("catalog.queued")}</p>}
            </Td>
            <Td cls="font-mono text-[12px] text-ink-2 max-[860px]:hidden">
              {r.writer}
              {r.more > 0 && <span className="ml-1 font-sans text-faint">+{r.more}</span>}
            </Td>
            <Td cls="text-xs whitespace-nowrap text-muted max-[640px]:hidden">{r.lastAt ? since(r.lastAt, now) : "—"}</Td>
            <Td cls="text-right text-xs tabular-nums text-ink-2 max-[1100px]:hidden">
              {r.lastRows !== null ? f.number(r.lastRows) : <span title={t("catalog.no_rows")} className="text-faint">—</span>}
            </Td>
            <Td cls="max-[1100px]:hidden">
              <Recent counts={r.recent} />
            </Td>
            <Td edge="last" cls="text-right text-faint">
              <Icon name="chevron-right" className="ml-auto h-4 w-4" />
            </Td>
          </Row>
        );
      })}
    </>
  );
}

/** Rows' shape while the first answer is on its way: the same cells at the same height. */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => (
        <tr key={i} aria-hidden="true">
          <Td edge="first"><Skeleton w="70%" h="18px" /></Td>
          <Td><Skeleton w="5rem" h="18px" /></Td>
          <Td cls="max-[860px]:hidden"><Skeleton w="8rem" h="18px" /></Td>
          <Td cls="max-[640px]:hidden"><Skeleton w="4rem" h="18px" /></Td>
          <Td cls="max-[1100px]:hidden"><Skeleton w="3rem" h="18px" className="ml-auto" /></Td>
          <Td cls="max-[1100px]:hidden"><Skeleton w="4rem" h="20px" /></Td>
          <Td edge="last" />
        </tr>
      ))}
    </>
  );
}

function Search({ filter }: { filter: Filter }) {
  const { t } = useT();
  const [text, setText] = useSearchBox(filter.get("q"), (q) => filter.hrefWith({ q }, "/data"));
  return <SearchBox value={text} onChange={setText} label={t("catalog.search")} />;
}

function Catalog({ filter }: { filter: Filter }) {
  const { t } = useT();
  const logoTitle = useLogoTitle();
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Catalog>(["catalog", qs.toString()], `/api/catalog${qs.size ? `?${qs}` : ""}`);
  const data = q.data;
  const status = filter.get("status");
  const kind = filter.get("kind");
  const legacy = filter.get("legacy") === "1";
  const band = [
    { key: "all", status: "", label: t("catalog.status.all"), tip: "", mark: "" },
    { key: "attention", status: "attention", label: t("catalog.status.attention"), tip: t("catalog.tip.attention"), mark: "stale" },
    ...STATUSES.map((s) => ({ key: s, status: s, label: t(`state.${freshnessKind(s)}`), tip: t(`catalog.tip.${s}`), mark: s })),
  ];
  const empty = data !== undefined && data.rows.length === 0;
  return (
    <div aria-busy={q.isFetching}>
      <FilterRow>
        <Search filter={filter} />
        <nav aria-label={t("catalog.band")}>
          {band.map((b) => (
            <Band
              key={b.key}
              to={filter.hrefWith({ status: b.status })}
              current={status === b.status}
              tip={b.tip}
              mark={b.mark ? <StatusMark kind={freshnessKind(b.mark)} /> : null}
              label={b.label}
              count={data ? (data.counts[b.key] ?? 0) : undefined}
            />
          ))}
        </nav>
        {data && data.kinds.length > 1 && (
          <Segmented
            label={t("catalog.kind")}
            choices={[
              { key: "", label: t("catalog.kind.all"), to: filter.hrefWith({ kind: "" }), current: kind === "" },
              ...data.kinds.map((k) => ({
                key: k,
                label: (
                  <>
                    <Logo k={k} />
                    {logoTitle(k)}
                  </>
                ),
                to: filter.hrefWith({ kind: k }),
                current: kind === k,
              })),
            ]}
          />
        )}
        {data?.hasLegacy && (
          <Switch on={legacy} to={filter.hrefWith({ legacy: legacy ? "" : "1" })}>
            {t("catalog.legacy")}
          </Switch>
        )}
      </FilterRow>
      {q.isError ? (
        <p role="alert" className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
          {(q.error as Error).message}
        </p>
      ) : empty ? (
        <Empty msg={filter.any ? t("catalog.empty.filtered") : t("catalog.empty")}>
          {filter.any && (
            <Link to="/data" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
              {t("workflows.clear")}
            </Link>
          )}
        </Empty>
      ) : (
        <Table catalog head={<Head />} foot={t("catalog.order")}>
          {data ? <CatalogRows rows={data.rows} filter={filter} now={data.now} /> : <SkeletonRows />}
        </Table>
      )}
    </div>
  );
}

export default function CatalogRoute() {
  const { t } = useT();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const filter = useFilter(FIELDS, "/data");

  // /data/target?u= is the catalog with one destination's drawer open over it.
  const u = pathname.endsWith("/data/target") ? (params.get("u") ?? "") : null;
  const target = useData<TargetDetail>(["catalog-target", u], `/api/catalog/target?u=${encodeURIComponent(u ?? "")}`, { enabled: !!u, keep: false });
  const missing = u !== null && target.error instanceof ApiError && target.error.status === 404;

  return (
    <Page>
      <PageHead title={t("catalog.title")} />
      <Lead before={t("catalog.lead.before")} strong={t("catalog.lead.strong")} after={t("catalog.lead.after")} cls="" />
      <p className="mt-2 mb-4 max-w-3xl text-[12px] text-faint">{t("catalog.honest")}</p>
      {missing && (
        <p className="mb-3 rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">{t("catalog.missing", { target: u ?? "" })}</p>
      )}
      <Catalog filter={filter} />
      {u !== null && !missing && (
        <Suspense fallback={null}>
          <TargetDrawer u={u} query={target} closeTo={filter.hrefWith({}, "/data")} />
        </Suspense>
      )}
    </Page>
  );
}
