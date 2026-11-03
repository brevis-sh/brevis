import { lazy, Suspense } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { ApiError } from "../api/client";
import { useData } from "../api/live";
import { useFormat, useT } from "../i18n";
import { Freshness, StatusMark, stateKind } from "../ui/freshness";
import { KindMark } from "../ui/kind-mark";
import { SearchBox, Segmented } from "../ui/segmented";
import { Skeleton } from "../ui/skeleton";
import { Table, Td, Th } from "../ui/table";
import { useFilter, useSearchBox } from "../ui/use-filter";
import type { TargetDetail } from "./target-drawer";
import "./catalog.css";

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
// A status as the band's tooltip key says it.
const TIP_KEY = (s: string) => `catalog.tip.${s}`;

// The drawer is a separate chunk: most visits to the catalog never open one.
const TargetDrawer = lazy(() => import("./target-drawer"));

/** The last loads of a destination as small bars, the tallest the largest; a load that did not say its rows is an outline. */
function Recent({ counts }: { counts: (number | null)[] }) {
  if (counts.length === 0) return null;
  const peak = Math.max(0, ...counts.map((c) => c ?? 0));
  return (
    <span className="dc-recent" aria-hidden="true">
      {counts.map((c, i) =>
        c === null ? (
          <span key={i} className="dc-bar dc-bar-none" />
        ) : (
          <span key={i} className="dc-bar" style={{ height: `${peak > 0 ? Math.max(12, Math.floor((c * 100) / peak)) : 12}%` }} />
        ),
      )}
    </span>
  );
}

function CatalogTable({ rows, filter }: { rows: CatalogRow[]; filter: ReturnType<typeof useFilter> }) {
  const { t } = useT();
  const f = useFormat();
  return (
    <Table>
      <thead>
        <tr>
          <Th>{t("catalog.col.target")}</Th>
          <Th>{t("catalog.col.status")}</Th>
          <Th>{t("catalog.col.writer")}</Th>
          <Th>{t("catalog.col.last")}</Th>
          <Th hide="lg" className="num">
            {t("catalog.col.rows")}
          </Th>
          <Th hide="lg">{t("catalog.col.recent")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.target || r.streamHref}>
            <Td>
              {/* Whole destination is the link; one without a URI is known by the stream that writes it. */}
              {r.streamHref ? (
                <a href={r.streamHref} className="dc-target">
                  <KindMark kind="gateway" />
                  <span>{r.writer}</span>
                </a>
              ) : (
                <Link to={filter.hrefWith({}, "/data/target", { u: r.target })} className="dc-target">
                  <KindMark kind={r.kind} />
                  <span className="dc-where">{r.where}</span>
                  <strong>{r.what}</strong>
                </Link>
              )}
              {r.legacy && <span className="chip">{t("catalog.chip.legacy")}</span>}
              {r.autoTable && <span className="chip">auto_table</span>}
            </Td>
            <Td label={t("catalog.col.status")}>
              <Freshness status={r.status} />
              {r.queued && <small className="dc-queued">{t("catalog.queued")}</small>}
            </Td>
            <Td label={t("catalog.col.writer")} className="mono dc-writer">
              {r.writer}
              {r.more > 0 && <span className="muted"> +{r.more}</span>}
            </Td>
            <Td label={t("catalog.col.last")} className="muted dc-nowrap">
              {r.lastAt ? f.since(r.lastAt) : "—"}
            </Td>
            <Td label={t("catalog.col.rows")} hide="lg" className="num">
              {r.lastRows !== null ? f.number(r.lastRows) : <span className="muted" title={t("catalog.no_rows")}>—</span>}
            </Td>
            <Td label={t("catalog.col.recent")} hide="lg">
              <Recent counts={r.recent} />
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** The table's shape while the first answer is on its way: same columns, same row height. */
export function CatalogSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="dc-band">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} w="6.5rem" h="2rem" className="dc-pill" />
        ))}
      </div>
      <Table>
        <thead>
          <tr>
            {Array.from({ length: 4 }, (_, i) => (
              <Th key={i}>
                <Skeleton w="4rem" h=".7rem" />
              </Th>
            ))}
            <Th hide="lg">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
            <Th hide="lg">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }, (_, i) => (
            <tr key={i}>
              <Td>
                <Skeleton w="70%" h="1rem" />
              </Td>
              <Td>
                <Skeleton w="5rem" h="1rem" />
              </Td>
              <Td>
                <Skeleton w="8rem" h="1rem" />
              </Td>
              <Td>
                <Skeleton w="4rem" h="1rem" />
              </Td>
              <Td hide="lg">
                <Skeleton w="3rem" h="1rem" />
              </Td>
              <Td hide="lg">
                <Skeleton w="4rem" h="1.25rem" />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function CatalogList({ data, filter }: { data: Catalog; filter: ReturnType<typeof useFilter> }) {
  const { t } = useT();
  const status = filter.get("status");
  const kind = filter.get("kind");
  const legacy = filter.get("legacy") === "1";
  const band = [
    { key: "all", status: "", label: t("catalog.status.all"), tip: "" },
    { key: "attention", status: "attention", label: t("catalog.status.attention"), tip: t(TIP_KEY("attention")), mark: "stale" },
    ...STATUSES.map((s) => ({ key: s, status: s, label: t(`state.${stateKind(s)}`), tip: t(TIP_KEY(s)), mark: s })),
  ];
  return (
    <>
      <nav aria-label={t("catalog.band")} className="dc-band">
        {band.map((b) => (
          <Link
            key={b.key}
            to={filter.hrefWith({ status: b.status })}
            title={b.tip}
            aria-current={status === b.status ? "true" : undefined}
            className="dc-pill"
          >
            {"mark" in b && b.mark ? <StatusMark kind={b.mark} /> : null}
            <span>{b.label}</span>
            <strong>{data.counts[b.key] ?? 0}</strong>
          </Link>
        ))}
      </nav>
      <div className="dc-tools">
        {data.kinds.length > 1 && (
          <Segmented
            label={t("catalog.kind")}
            choices={[
              { key: "", label: t("catalog.kind.all"), to: filter.hrefWith({ kind: "" }), current: kind === "" },
              ...data.kinds.map((k) => ({
                key: k,
                label: (
                  <>
                    <KindMark kind={k} />
                    {k}
                  </>
                ),
                to: filter.hrefWith({ kind: k }),
                current: kind === k,
              })),
            ]}
          />
        )}
        {data.hasLegacy && (
          <Link to={filter.hrefWith({ legacy: legacy ? "" : "1" })} role="switch" aria-checked={legacy} className="dc-switch">
            <span className="dc-switch-track" aria-hidden="true">
              <span className="dc-switch-knob" />
            </span>
            {t("catalog.legacy")}
          </Link>
        )}
      </div>
      {data.rows.length === 0 ? (
        <div className="dc-empty">
          {filter.any ? (
            <>
              <p>{t("catalog.empty.filtered")}</p>
              <Link to="/data">{t("workflows.clear")}</Link>
            </>
          ) : (
            <p>{t("catalog.empty")}</p>
          )}
        </div>
      ) : (
        <>
          <CatalogTable rows={data.rows} filter={filter} />
          <p className="muted dc-order">{t("catalog.order")}</p>
        </>
      )}
    </>
  );
}

function Lead() {
  const { t } = useT();
  return (
    <>
      <h1 className="page-title">{t("catalog.title")}</h1>
      <p className="muted lead">
        {t("catalog.lead.before")} <strong>{t("catalog.lead.strong")}</strong>
        {t("catalog.lead.after")}
      </p>
      <p className="muted dc-honest">{t("catalog.honest")}</p>
    </>
  );
}

function Search({ filter }: { filter: ReturnType<typeof useFilter> }) {
  const { t } = useT();
  const [text, setText] = useSearchBox(filter.get("q"), (q) => filter.hrefWith({ q }, "/data"));
  return <SearchBox value={text} onChange={setText} label={t("catalog.search")} />;
}

function Catalog() {
  const { t } = useT();
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const filter = useFilter(FIELDS, "/data");
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const catalog = useData<Catalog>(["catalog", qs.toString()], `/api/catalog${qs.size ? `?${qs}` : ""}`);

  // /data/target?u= is the catalog with one destination's drawer open over it.
  const u = pathname.endsWith("/data/target") ? (params.get("u") ?? "") : null;
  const target = useData<TargetDetail>(["catalog-target", u], `/api/catalog/target?u=${encodeURIComponent(u ?? "")}`, { enabled: !!u, keep: false });
  const missing = u !== null && target.error instanceof ApiError && target.error.status === 404;

  return (
    <>
      <Search filter={filter} />
      {missing && <p className="dc-missing">{t("catalog.missing", { target: u ?? "" })}</p>}
      <div className="dc-list" aria-busy={catalog.isFetching}>
        {catalog.isPending ? (
          <CatalogSkeleton />
        ) : catalog.isError ? (
          <p role="alert" className="dc-missing">
            {(catalog.error as Error).message}
          </p>
        ) : (
          <CatalogList data={catalog.data} filter={filter} />
        )}
      </div>
      {u !== null && !missing && (
        <Suspense fallback={null}>
          <TargetDrawer u={u} query={target} closeTo={filter.hrefWith({}, "/data")} />
        </Suspense>
      )}
    </>
  );
}

export default function CatalogRoute() {
  return (
    <>
      <Suspense fallback={<Skeleton w="12rem" h="1.5rem" />}>
        <Lead />
      </Suspense>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog />
      </Suspense>
    </>
  );
}
