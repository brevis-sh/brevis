import { Suspense } from "react";
import { Link } from "react-router";
import { useData } from "../api/live";
import { useFormat, useT, type Vars } from "../i18n";
import { StatusMark } from "../ui/freshness";
import { KindMark } from "../ui/kind-mark";
import { SearchBox, Segmented } from "../ui/segmented";
import { Skeleton } from "../ui/skeleton";
import { Table, Td, Th } from "../ui/table";
import { useFilter, useSearchBox } from "../ui/use-filter";
import "./endpoints.css";

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

export const endpointHref = (r: { api: string; name: string }) => `/data/endpoints/${encodeURIComponent(r.api)}/${encodeURIComponent(r.name)}`;

/** How an endpoint's data stands, by the tables it reads: fresh, stale, or not known to the catalog. */
export function EndpointFreshness({ value }: { value: string }) {
  const { t } = useT();
  if (value === "stale")
    return (
      <span className="st ep-stale">
        <StatusMark kind="stale" />
        {t("endpoints.state.stale")}
      </span>
    );
  if (value === "fresh")
    return (
      <span className="st ep-fresh">
        <StatusMark kind="on_time" />
        {t("endpoints.state.fresh")}
      </span>
    );
  return (
    <span className="muted" title={t("endpoints.state.unknown.tip")}>
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

/** "8 · 2 required", or how many when none is required. */
export function useParamsSaid() {
  const { t } = useT();
  return (params: number, required: number) =>
    params === 0 ? t("endpoints.params.none") : required > 0 ? t("endpoints.params.required", { n: params, required } satisfies Vars) : String(params);
}

function EndpointsTable({ rows }: { rows: EndpointRow[] }) {
  const { t } = useT();
  const f = useFormat();
  const paramsSaid = useParamsSaid();
  return (
    <Table id="endpoint-rows">
      <thead>
        <tr>
          <Th>{t("endpoints.col.endpoint")}</Th>
          <Th hide="xl">{t("endpoints.col.api")}</Th>
          <Th hide="md">{t("endpoints.col.reads")}</Th>
          <Th hide="lg">{t("endpoints.col.cache")}</Th>
          <Th hide="lg">{t("endpoints.col.params")}</Th>
          <Th>{t("endpoints.col.status")}</Th>
          <Th hide="xl">{t("endpoints.col.published")}</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const first = r.reads[0] ?? "";
          const [where, what] = splitTarget(first);
          const kind = first.includes("://") ? first.slice(0, first.indexOf("://")) : "";
          return (
            <tr key={r.api + "/" + r.name}>
              <Td>
                <Link to={endpointHref(r)} className="ep-path">
                  <span className="method">GET</span>
                  <strong>{r.path}</strong>
                </Link>
                {r.about && (
                  <p className="ep-about muted" title={r.about}>
                    {r.about}
                  </p>
                )}
              </Td>
              <Td label={t("endpoints.col.api")} hide="xl">
                <span className="chip ep-api">{r.api}</span>
              </Td>
              <Td label={t("endpoints.col.reads")} hide="md">
                {r.reads.length > 0 && (
                  <div className="ep-reads">
                    <p title={first}>
                      <KindMark kind={kind} />
                      <span className="ep-where">{where}</span>
                      <span>{what}</span>
                      {r.reads.length > 1 && (
                        <span className="muted" title={r.reads.slice(1).join("\n")}>
                          +{r.reads.length - 1}
                        </span>
                      )}
                    </p>
                    {r.rebuilt && (
                      <small className="muted">{t("endpoints.rebuilt", { when: f.since(r.rebuilt.at), by: r.rebuilt.by })}</small>
                    )}
                  </div>
                )}
              </Td>
              <Td label={t("endpoints.col.cache")} hide="lg" className="ep-nowrap">
                {r.ttl ? t("endpoints.ttl", { ttl: r.ttl }) : <span className="muted">—</span>}
              </Td>
              <Td label={t("endpoints.col.params")} hide="lg" className="ep-nowrap">
                {paramsSaid(r.params, r.required)}
              </Td>
              <Td label={t("endpoints.col.status")} className="ep-nowrap">
                <EndpointFreshness value={r.freshness} />
              </Td>
              <Td label={t("endpoints.col.published")} hide="xl" className="muted ep-nowrap">
                {f.since(r.publishedAt)}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** The same columns and row height as the list, while the first answer arrives. */
export function EndpointsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w="60%" h=".9rem" className="ep-sk-line" />
      <Skeleton w="24rem" h="2.25rem" className="ep-sk-line" />
      <Table>
        <thead>
          <tr>
            <Th>
              <Skeleton w="5rem" h=".7rem" />
            </Th>
            <Th hide="xl">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
            <Th hide="md">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
            <Th hide="lg">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
            <Th hide="lg">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
            <Th>
              <Skeleton w="3rem" h=".7rem" />
            </Th>
            <Th hide="xl">
              <Skeleton w="3rem" h=".7rem" />
            </Th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }, (_, i) => (
            <tr key={i}>
              <Td>
                <Skeleton w="12rem" h="1rem" />
                <Skeleton w="16rem" h=".7rem" className="ep-sk-sub" />
              </Td>
              <Td hide="xl">
                <Skeleton w="5rem" h="1rem" />
              </Td>
              <Td hide="md">
                <Skeleton w="12rem" h="1rem" />
              </Td>
              <Td hide="lg">
                <Skeleton w="4rem" h="1rem" />
              </Td>
              <Td hide="lg">
                <Skeleton w="3rem" h="1rem" />
              </Td>
              <Td>
                <Skeleton w="5rem" h="1rem" />
              </Td>
              <Td hide="xl">
                <Skeleton w="4rem" h="1rem" />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

function Summary({ d }: { d: Endpoints }) {
  const { n, t } = useT();
  return (
    <div className="ep-summary">
      <span>{n("endpoints.summary.endpoints", d.total)}</span>
      <span>{n("endpoints.summary.apis", d.apis)}</span>
      {d.fresh > 0 && (
        <span className="st">
          <StatusMark kind="on_time" />
          {n("endpoints.summary.fresh", d.fresh)}
        </span>
      )}
      {d.stale > 0 && (
        <span className="st">
          <StatusMark kind="stale" />
          {n("endpoints.summary.stale", d.stale)}
        </span>
      )}
      {d.caches.map((c) => (
        <span key={c} className="muted">
          {t("endpoints.summary.cache", { type: c })}
        </span>
      ))}
      {d.connections.map((c) => (
        <span key={c} className="muted">
          {t("endpoints.summary.connection", { name: c })}
        </span>
      ))}
    </div>
  );
}

function Search({ filter }: { filter: ReturnType<typeof useFilter> }) {
  const { t } = useT();
  const [text, setText] = useSearchBox(filter.get("q"), (q) => filter.hrefWith({ q }));
  return <SearchBox value={text} onChange={setText} label={t("endpoints.search")} />;
}

function HowItWorks() {
  const { t } = useT();
  return (
    <ol className="ep-how">
      <li>
        <small>{t("endpoints.how.1")}</small>
        <strong>{t("endpoints.how.declare")}</strong>
        <p className="muted">{t("endpoints.how.declare.text")}</p>
      </li>
      <li>
        <small>{t("endpoints.how.2")}</small>
        <strong>{t("endpoints.how.publish")}</strong>
        <p className="muted">
          <code>brevis endpoints publish</code> {t("endpoints.how.publish.text")}
        </p>
      </li>
      <li>
        <small>{t("endpoints.how.3")}</small>
        <strong>{t("endpoints.how.serve")}</strong>
        <p className="muted">{t("endpoints.how.serve.text")}</p>
      </li>
    </ol>
  );
}

function Endpoints() {
  const { t } = useT();
  const filter = useFilter(FIELDS, "/data/endpoints");
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Endpoints>(["endpoints", qs.toString()], `/api/endpoints${qs.size ? `?${qs}` : ""}`);
  const api = filter.get("api");
  const state = filter.get("state");

  if (q.isPending) return <EndpointsSkeleton />;
  if (q.isError)
    return (
      <p role="alert" className="dc-missing">
        {(q.error as Error).message}
      </p>
    );
  const d = q.data;
  return (
    <>
      {d.total > 0 && (
        <>
          <Summary d={d} />
          <Search filter={filter} />
          <div className="ep-tools">
            {d.apiNames.length > 1 && (
              <Segmented
                label={t("endpoints.col.api")}
                choices={[
                  { key: "", label: t("endpoints.filter.api.all"), to: filter.hrefWith({ api: "" }), current: api === "" },
                  ...d.apiNames.map((a) => ({ key: a, label: <span className="mono">{a}</span>, to: filter.hrefWith({ api: a }), current: api === a })),
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
                      <StatusMark kind="on_time" />
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
                      <StatusMark kind="stale" />
                      {t("endpoints.filter.state.stale")}
                    </>
                  ),
                  to: filter.hrefWith({ state: "stale" }),
                  current: state === "stale",
                },
              ]}
            />
          </div>
        </>
      )}
      <div className="dc-list" aria-busy={q.isFetching}>
        {d.rows.length === 0 ? (
          <div className="dc-empty">
            {d.total > 0 ? (
              <>
                <p>{t("endpoints.empty.filtered")}</p>
                <Link to="/data/endpoints">{t("workflows.clear")}</Link>
              </>
            ) : (
              <>
                <p>{t("endpoints.empty")}</p>
                <p className="mono">brevis endpoints publish manifest.json</p>
              </>
            )}
          </div>
        ) : (
          <EndpointsTable rows={d.rows} />
        )}
      </div>
      <HowItWorks />
    </>
  );
}

function Head() {
  const { t } = useT();
  return (
    <>
      <div className="ep-title">
        <h1 className="page-title">{t("endpoints.title")}</h1>
        {/* The publish drawer is the old page's: it only says how, with copyable blocks. */}
        <a className="btn btn-primary" href="/data/endpoints#publicar">
          + {t("endpoints.publish")}
        </a>
      </div>
      <p className="muted lead">
        {t("endpoints.lead.before")} <strong>{t("endpoints.lead.strong")}</strong>
        {t("endpoints.lead.after")}
      </p>
    </>
  );
}

export default function EndpointsRoute() {
  return (
    <>
      <Suspense fallback={<Skeleton w="12rem" h="1.5rem" />}>
        <Head />
      </Suspense>
      <Suspense fallback={<EndpointsSkeleton />}>
        <Endpoints />
      </Suspense>
    </>
  );
}

