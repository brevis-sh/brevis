import { Link, useNavigate } from "react-router";
import { useData } from "../api/live";
import { useT, type Vars } from "../i18n";
import { useSince } from "../ui/format";
import { useDrawer } from "../ui/drawer";
import { HowDrawer, HowSteps } from "../ui/how";
import { btn, Empty, FilterRow, Lead, MethodPill, PageHead, linkUnderline, Page } from "../ui/kit";
import { Icon } from "../ui/icon";
import { Logo } from "../ui/logo";
import { SearchBox, Segmented } from "../ui/segmented";
import { Skeleton } from "../ui/skeleton";
import { FreshnessMark } from "../ui/status";
import { Row, Table, Td, Th } from "../ui/table";
import { useFilter, useSearchBox } from "../ui/use-filter";

export type EndpointRow = {
  api: string;
  name: string;
  path: string;
  keyed: boolean;
  about: string;
  freshness: "stale" | "fresh" | "";
  reads: string[];
  rebuilt: { at: string; by: string } | null;
  ttl: string;
  params: number;
  required: number;
  publishedAt: string;
};
type Endpoints = {
  now: string;
  total: number;
  apis: number;
  fresh: number;
  stale: number;
  caches: string[];
  connections: string[];
  apiNames: string[];
  rows: EndpointRow[];
};

const FIELDS = ["api", "state", "q"] as const;
type Filter = ReturnType<typeof useFilter>;

// The example the publish drawer shows: an API's file with one endpoint, and how it reaches the console.
const PUBLISH_YAML = `name: metrics-api
connection: warehouse

cache:
  type: redis
  addr_from: BREVIS_CACHE_ADDR
  ttl: 6h

endpoints:
  #: Clicks per day, for the customer's dashboard.
  - name: clicks
    path: /v1/clicks
    tenant: key
    params:
      start_date: {type: date, required: true}
      end_date: {type: date, required: true}
    sql_file: endpoints/clicks.sql`;
const PUBLISH_COMMANDS = `brevis-sql-api describe --config api.yaml --out manifest.json
brevis endpoints publish manifest.json`;

export const endpointHref = (r: { api: string; name: string }) => `/data/endpoints/${encodeURIComponent(r.api)}/${encodeURIComponent(r.name)}`;

/** How an endpoint's data stands, by the tables it reads: fresh, stale, or not known to the catalog. */
export function EndpointFreshness({ value }: { value: string }) {
  const { t } = useT();
  if (value === "stale")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-state-queued">
        <FreshnessMark status="stale" />
        {t("endpoints.state.stale")}
      </span>
    );
  if (value === "fresh")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-state-success">
        <FreshnessMark status="on_time" />
        {t("endpoints.state.fresh")}
      </span>
    );
  return (
    <span className="text-[12.5px] text-faint" title={t("endpoints.state.unknown.tip")}>
      {t("endpoints.state.unknown")}
    </span>
  );
}

/** Splits `postgres://db/schema/` from `table`: the part every row shares is faint. */
export const splitTarget = (t: string): [string, string] => {
  if (!t.includes("://")) {
    const i = t.lastIndexOf(".");
    return i >= 0 ? [t.slice(0, i + 1), t.slice(i + 1)] : ["", t];
  }
  if (t.endsWith("/")) return [t, ""];
  const i = t.lastIndexOf("/");
  return [t.slice(0, i + 1), t.slice(i + 1)];
};

/** The scheme of a destination URI, which is the kind whose mark draws it. */
export const kindOf = (uri: string) => (uri.includes("://") ? uri.slice(0, uri.indexOf("://")) : "");

/** "8 · 2 required", or how many when none is required. */
export function useParamsSaid() {
  const { t } = useT();
  return (params: number, required: number) =>
    params === 0 ? t("endpoints.params.none") : required > 0 ? t("endpoints.params.required", { n: params, required } satisfies Vars) : String(params);
}

function Head() {
  const { t } = useT();
  return (
    <>
      <Th edge="first">{t("endpoints.col.endpoint")}</Th>
      <Th cls="max-[1280px]:hidden">{t("endpoints.col.api")}</Th>
      <Th cls="max-[960px]:hidden">{t("endpoints.col.reads")}</Th>
      <Th cls="max-[1180px]:hidden">{t("endpoints.col.cache")}</Th>
      <Th cls="max-[1180px]:hidden">{t("endpoints.col.params")}</Th>
      <Th>{t("endpoints.col.status")}</Th>
      <Th cls="max-[1280px]:hidden">{t("endpoints.col.published")}</Th>
      <Th edge="last" cls="w-8" />
    </>
  );
}

function Rows({ rows, now }: { rows: EndpointRow[]; now: string }) {
  const { t } = useT();
  const since = useSince();
  const navigate = useNavigate();
  const paramsSaid = useParamsSaid();
  return (
    <>
      {rows.map((r) => {
        const first = r.reads[0] ?? "";
        const [where, what] = splitTarget(first);
        const href = endpointHref(r);
        return (
          <Row key={r.api + "/" + r.name} onOpen={() => navigate(href)}>
            <Td edge="first">
              <Link to={href} className="inline-flex items-center gap-2 font-mono text-[13px]">
                <MethodPill method="GET" />
                <span className="font-medium text-ink">{r.path}</span>
              </Link>
              {r.about && (
                <p className="mt-1 max-w-[22rem] truncate text-[12px] text-muted" title={r.about}>
                  {r.about}
                </p>
              )}
            </Td>
            <Td cls="max-[1280px]:hidden">
              <span className="rounded-card border border-line px-1.5 py-px font-mono text-[11.5px] text-ink-2">{r.api}</span>
            </Td>
            <Td cls="max-[960px]:hidden">
              {r.reads.length > 0 && (
                <div className="max-w-[18rem] min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 font-mono text-[12px]" title={first}>
                    <Logo k={kindOf(first)} />
                    <span className="truncate text-faint">{where}</span>
                    <span className="shrink-0 text-ink">{what}</span>
                    {r.reads.length > 1 && (
                      <span className="shrink-0 font-sans text-[11.5px] text-muted" title={r.reads.slice(1).join("\n")}>
                        +{r.reads.length - 1}
                      </span>
                    )}
                  </p>
                  {r.rebuilt && <p className="mt-0.5 truncate text-[11.5px] text-muted">{t("endpoints.rebuilt", { when: since(r.rebuilt.at, now), by: r.rebuilt.by })}</p>}
                </div>
              )}
            </Td>
            <Td cls="text-[12.5px] whitespace-nowrap text-ink-2 max-[1180px]:hidden">
              {r.ttl ? t("endpoints.ttl", { ttl: r.ttl }) : <span className="text-faint">—</span>}
            </Td>
            <Td cls="text-[12.5px] whitespace-nowrap text-ink-2 max-[1180px]:hidden">{paramsSaid(r.params, r.required)}</Td>
            <Td cls="whitespace-nowrap">
              <EndpointFreshness value={r.freshness} />
            </Td>
            <Td cls="text-xs whitespace-nowrap text-muted max-[1280px]:hidden">{since(r.publishedAt, now)}</Td>
            <Td edge="last" cls="text-right text-faint">
              <Icon name="chevron-right" className="ml-auto h-4 w-4" />
            </Td>
          </Row>
        );
      })}
    </>
  );
}

/** The rows' shape while the first answer is on its way: the same cells at the same height. */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <tr key={i} aria-hidden="true">
          <Td edge="first">
            <Skeleton w="12rem" h="20px" />
            <Skeleton w="16rem" h="14px" className="mt-1" />
          </Td>
          <Td cls="max-[1280px]:hidden"><Skeleton w="5rem" h="20px" /></Td>
          <Td cls="max-[960px]:hidden"><Skeleton w="12rem" h="18px" /></Td>
          <Td cls="max-[1180px]:hidden"><Skeleton w="4rem" h="18px" /></Td>
          <Td cls="max-[1180px]:hidden"><Skeleton w="3rem" h="18px" /></Td>
          <Td><Skeleton w="5rem" h="18px" /></Td>
          <Td cls="max-[1280px]:hidden"><Skeleton w="4rem" h="18px" /></Td>
          <Td edge="last" />
        </tr>
      ))}
    </>
  );
}

function Summary({ d }: { d: Endpoints | undefined }) {
  const { n, t } = useT();
  if (!d) return <Skeleton w="28rem" h="18px" className="mb-4 max-w-full" />;
  if (d.total === 0) return null;
  return (
    <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-muted">
      <span>{n("endpoints.summary.endpoints", d.total)}</span>
      <span>{n("endpoints.summary.apis", d.apis)}</span>
      {d.fresh > 0 && (
        <span className="inline-flex items-baseline gap-1.5">
          <FreshnessMark status="on_time" />
          {n("endpoints.summary.fresh", d.fresh)}
        </span>
      )}
      {d.stale > 0 && (
        <span className="inline-flex items-baseline gap-1.5">
          <FreshnessMark status="stale" />
          {n("endpoints.summary.stale", d.stale)}
        </span>
      )}
      {d.caches.map((c) => (
        <span key={c} className="text-faint">
          {t("endpoints.summary.cache", { type: c })}
        </span>
      ))}
      {d.connections.map((c) => (
        <span key={c} className="text-faint">
          {t("endpoints.summary.connection", { name: c })}
        </span>
      ))}
    </div>
  );
}

function Search({ filter }: { filter: Filter }) {
  const { t } = useT();
  const [text, setText] = useSearchBox(filter.get("q"), (q) => filter.hrefWith({ q }));
  return <SearchBox value={text} onChange={setText} label={t("endpoints.search")} />;
}

function Endpoints({ filter }: { filter: Filter }) {
  const { t } = useT();
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Endpoints>(["endpoints", qs.toString()], `/api/endpoints${qs.size ? `?${qs}` : ""}`);
  const d = q.data;
  const api = filter.get("api");
  const state = filter.get("state");
  const none = d !== undefined && d.rows.length === 0;
  return (
    <>
      <Summary d={d} />
      {(!d || d.total > 0) && (
        <FilterRow>
          <Search filter={filter} />
          {d && d.apiNames.length > 1 && (
          <Segmented
            label={t("endpoints.col.api")}
            choices={[
              { key: "", label: t("endpoints.filter.api.all"), to: filter.hrefWith({ api: "" }), current: api === "" },
              ...d.apiNames.map((a) => ({ key: a, label: <span className="font-mono text-[12px]">{a}</span>, to: filter.hrefWith({ api: a }), current: api === a })),
            ]}
          />
        )}
        <Segmented
          label={t("endpoints.col.status")}
          choices={[
            { key: "", label: t("endpoints.filter.state.all"), to: filter.hrefWith({ state: "" }), current: state === "" },
            {
              key: "fresh",
              label: (
                <>
                  <FreshnessMark status="on_time" />
                  {t("endpoints.filter.state.fresh")}
                </>
              ),
              to: filter.hrefWith({ state: "fresh" }),
              current: state === "fresh",
            },
            {
              key: "stale",
              label: (
                <>
                  <FreshnessMark status="stale" />
                  {t("endpoints.filter.state.stale")}
                </>
              ),
              to: filter.hrefWith({ state: "stale" }),
              current: state === "stale",
            },
          ]}
        />
        </FilterRow>
      )}
      <div aria-busy={q.isFetching}>
        {q.isError ? (
          <p role="alert" className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
            {(q.error as Error).message}
          </p>
        ) : none ? (
          <Empty msg={d.total > 0 ? t("endpoints.empty.filtered") : t("endpoints.empty")} hint={d.total > 0 ? undefined : "brevis endpoints publish manifest.json"}>
            {d.total > 0 && (
              <Link to="/data/endpoints" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
                {t("workflows.clear")}
              </Link>
            )}
          </Empty>
        ) : (
          <Table id="endpoint-rows" head={<Head />}>
            {d ? <Rows rows={d.rows} now={d.now} /> : <SkeletonRows />}
          </Table>
        )}
      </div>
    </>
  );
}

function HowItWorks() {
  const { t } = useT();
  return (
    <HowSteps
      steps={[
        { kicker: t("endpoints.how.1"), title: t("endpoints.how.declare"), text: t("endpoints.how.declare.text") },
        {
          kicker: t("endpoints.how.2"),
          title: t("endpoints.how.publish"),
          text: (
            <>
              <code className="font-mono">brevis endpoints publish</code> {t("endpoints.how.publish.text")}
            </>
          ),
        },
        { kicker: t("endpoints.how.3"), title: t("endpoints.how.serve"), text: t("endpoints.how.serve.text") },
      ]}
    />
  );
}

export default function EndpointsRoute() {
  const { t } = useT();
  const filter = useFilter(FIELDS, "/data/endpoints");
  const { show } = useDrawer("publicar");
  return (
    <Page>
      <PageHead
        title={t("endpoints.title")}
        actions={
          <button type="button" className={btn(true)} aria-haspopup="dialog" onClick={show}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("endpoints.publish")}
          </button>
        }
      />
      <Lead before={t("endpoints.lead.before")} strong={t("endpoints.lead.strong")} after={t("endpoints.lead.after")} />
      <Endpoints filter={filter} />
      <HowItWorks />
      <HowDrawer
        id="publicar"
        title={t("endpoints.publish")}
        lead={t("endpoints.publish.lead")}
        blocks={[
          { title: t("endpoints.publish.declare"), text: PUBLISH_YAML },
          { title: t("endpoints.publish.commands"), text: PUBLISH_COMMANDS },
        ]}
        note={t("endpoints.publish.note")}
      />
    </Page>
  );
}
