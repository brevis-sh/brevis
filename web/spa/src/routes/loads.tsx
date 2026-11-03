import { Link, useNavigate } from "react-router";
import { useData } from "../api/live";
import type { LoadRow, Loads, Source } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { localStamp, useSince } from "../ui/format";
import { Icon } from "../ui/icon";
import { ButtonLink, Empty, FilterRow, Lead, PageHead, linkUnderline, Page } from "../ui/kit";
import { Logo } from "../ui/logo";
import { Place, PlaceBlock } from "../ui/place";
import { Band, SearchBox, Segmented, Switch } from "../ui/segmented";
import { Skeleton } from "../ui/skeleton";
import { Sparkline } from "../ui/sparkline";
import { Freshness, FreshnessMark, freshnessKind } from "../ui/status";
import { Row, Table, Td, Th } from "../ui/table";
import { useFilter, useSearchBox } from "../ui/use-filter";

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
            {r.lastLoaded ? since(r.lastLoaded) : "—"}
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

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <tr key={i} aria-hidden="true">
          <Td edge="first">
            <Skeleton w="9rem" h="18px" />
            <Skeleton w="12rem" h="14px" className="mt-1" />
          </Td>
          <Td cls="max-[860px]:hidden"><Skeleton w="20rem" h="34px" /></Td>
          <Td><Skeleton w="5rem" h="18px" /></Td>
          <Td cls="max-[640px]:hidden"><Skeleton w="4rem" h="18px" /></Td>
          <Td cls="max-[1100px]:hidden"><Skeleton w="3rem" h="18px" className="ml-auto" /></Td>
          <Td edge="last" cls="max-[1100px]:hidden"><Skeleton w="120px" h="24px" /></Td>
        </tr>
      ))}
    </>
  );
}

function Summary({ v }: { v: Loads | undefined }) {
  const { t, n } = useT();
  if (!v) return <Skeleton w="30rem" h="18px" className="mb-4 max-w-full" />;
  if (v.total === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px]">
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

function Search({ filter }: { filter: Filter }) {
  const { t } = useT();
  const [text, setText] = useSearchBox(filter.get("q"), (q) => filter.hrefWith({ q }));
  return <SearchBox value={text} onChange={setText} label={t("loads.search")} />;
}

function LoadsData({ filter }: { filter: Filter }) {
  const { t } = useT();
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Loads>(["ingest", "loads", qs.toString()], `/api/ingest/loads${qs.size ? `?${qs}` : ""}`);
  const v = q.data;
  const status = filter.get("status");
  const source = filter.get("source");
  const legacy = filter.get("legacy") === "1";
  const shown = !v || v.total > 0 || v.hasLegacy;
  const band = [
    { key: "", status: "", label: t("catalog.status.all"), tip: "", mark: "" },
    { key: "attention", status: "attention", label: t("catalog.status.attention"), tip: t("catalog.tip.attention"), mark: "stale" },
    ...STATUSES.map((s) => ({ key: s, status: s, label: t(`state.${freshnessKind(s)}`), tip: t(`catalog.tip.${s}`), mark: s })),
  ];
  const none = v !== undefined && v.rows.length === 0;
  return (
    <>
      <Summary v={v} />
      {shown && (
        <FilterRow>
          <Search filter={filter} />
          <nav aria-label={t("catalog.band")}>
            {band.map((b) => (
              <Band
                key={b.key}
                to={filter.hrefWith({ status: b.status })}
                current={status === b.status}
                tip={b.tip}
                mark={b.mark ? <FreshnessMark status={b.mark} /> : null}
                label={b.label}
                count={v ? (v.counts[b.key] ?? 0) : undefined}
              />
            ))}
          </nav>
          {v && v.sources.length > 1 && (
            <Segmented
              label={t("loads.source")}
              choices={[
                { key: "", label: t("loads.source.all"), to: filter.hrefWith({ source: "" }), current: source === "" },
                ...v.sources.map((s) => ({
                  key: s.key,
                  label: (
                    <>
                      {s.key === "http" || s.key === "file" ? <Logo k={s.key} /> : s.key === "database" ? <Icon name="database" className="h-3.5 w-3.5 text-muted" /> : null}
                      {s.label}
                    </>
                  ),
                  to: filter.hrefWith({ source: s.key }),
                  current: source === s.key,
                })),
              ]}
            />
          )}
          {v?.hasLegacy && (
            <Switch on={legacy} to={filter.hrefWith({ legacy: legacy ? "" : "1" })}>
              {t("catalog.legacy")}
            </Switch>
          )}
        </FilterRow>
      )}
      <div aria-busy={q.isFetching}>
        {q.isError ? (
          <p role="alert" className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
            {(q.error as Error).message}
          </p>
        ) : none ? (
          filter.any && shown ? (
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
          )
        ) : (
          <Table id="load-rows" head={<Head />} foot={t("loads.honest")}>
            {v ? <Rows rows={v.rows} /> : <SkeletonRows />}
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
