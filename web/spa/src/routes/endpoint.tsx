import { useMutation } from "@tanstack/react-query";
import { Suspense, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { ApiError, postJSON } from "../api/client";
import { useData } from "../api/live";
import { useFormat, useT } from "../i18n";
import { CodeBlock } from "../ui/code-block";
import { Freshness, StatusMark } from "../ui/freshness";
import { KindMark } from "../ui/kind-mark";
import { Panel } from "../ui/panel";
import { Skeleton } from "../ui/skeleton";
import { Table, Td, Th } from "../ui/table";
import { EndpointFreshness, endpointHref, useParamsSaid } from "./endpoints";
import "../ui/code-block.css";
import "./endpoints.css";

type Lineage = {
  target: string;
  where: string;
  what: string;
  kind: string;
  known: boolean;
  status: string;
  lastAt: string | null;
  origin: { main: string; sub: string } | null;
  writer: { name: string; href: string } | null;
  sql: boolean;
  cacheTtl: string;
};
type Field = { name: string; kind: string; value: string; options: string[]; required: boolean; maxLen: number };
type Endpoint = {
  api: string;
  name: string;
  path: string;
  about: string;
  keyed: boolean;
  freshness: "stale" | "fresh" | "";
  publishedAt: string;
  stale: { reason: string; target: string } | null;
  lineage: Lineage[];
  cache: { state: "set" | "none" | "unknown"; ttl: string; type: string; addrFrom: string; reads: string[]; bump: string };
  params: { name: string; type: string; required: boolean; note: string; accepts: string; default: string }[];
  paramCount: number;
  required: number;
  limits: { timeout: string; maxRows: number; maxBytes: number };
  canRun: boolean;
  form: Field[];
  curlHead: string;
  curlBase: string;
};
type Answer = {
  status: number;
  statusText: string;
  cache: string;
  millis: number;
  received: number;
  truncated: boolean;
  columns: string[];
  rows: string[][];
  error: string;
};

/** A byte count somebody can judge at a glance (the server's pages say it the same way). */
function bytesText(n: number): string {
  const units: [number, string][] = [[2 ** 40, "TB"], [2 ** 30, "GB"], [2 ** 20, "MB"], [2 ** 10, "kB"]];
  for (const [size, name] of units) if (n >= size) return `${(n / size).toFixed(1)} ${name}`;
  return `${n} B`;
}

function Eyebrow({ d }: { d: Endpoint }) {
  const { t } = useT();
  const f = useFormat();
  return (
    <div className="ed-eyebrow">
      <Link to="/data/endpoints">← {t("endpoint.back")}</Link>
      <span className="muted">·</span>
      <span className="method">GET</span>
      <span className="mono">{d.api}</span>
      <span className="muted">{t("endpoint.published", { when: f.since(d.publishedAt) })}</span>
      {d.freshness && <EndpointFreshness value={d.freshness} />}
    </div>
  );
}

function Stale({ s }: { s: NonNullable<Endpoint["stale"]> }) {
  const { t } = useT();
  return (
    <section role="note" className="ed-stale">
      <p className="head">
        <StatusMark kind="stale" />
        {t("endpoint.stale.title")}
      </p>
      {s.reason && <p>{s.reason}</p>}
      <p className="muted">{t("endpoint.stale.serves")}</p>
      <p>
        <Link to={`/data/target?u=${encodeURIComponent(s.target)}`}>{t("endpoint.stale.catalog")} →</Link>
      </p>
    </section>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ed-step">
      <small>{label}</small>
      {children}
    </div>
  );
}
const Arrow = () => (
  <span className="ed-arrow" aria-hidden="true">
    →
  </span>
);

/** Where the data comes from: per table read, origin, writer, table and this endpoint; stacked on a narrow screen. */
function LineagePanel({ d }: { d: Endpoint }) {
  const { t } = useT();
  const f = useFormat();
  return (
    <Panel title={t("endpoint.lineage")} note={String(d.lineage.length)} id="lineage">
      <ul className="ed-lineage">
        {d.lineage.map((l) => (
          <li key={l.target}>
            <Step label={t("endpoint.lineage.origin")}>
              {l.origin ? (
                <>
                  <p>{l.origin.main}</p>
                  {l.origin.sub && (
                    <p className="mono muted" title={l.origin.sub}>
                      {l.origin.sub}
                    </p>
                  )}
                </>
              ) : (
                <p className="muted">—</p>
              )}
            </Step>
            <Arrow />
            <Step label={t("endpoint.lineage.writer")}>
              {l.writer ? (
                <p>
                  <a className="mono" href={l.writer.href} title={l.writer.name}>
                    {l.writer.name}
                  </a>
                </p>
              ) : (
                <p className="muted">—</p>
              )}
            </Step>
            <Arrow />
            <Step label={t("endpoint.lineage.table")}>
              <Link to={`/data/target?u=${encodeURIComponent(l.target)}`} className="ep-reads" title={l.target} style={{ display: "flex", gap: ".35rem", alignItems: "center", color: "inherit" }}>
                <KindMark kind={l.kind} />
                <span className="mono">
                  <span className="muted">{l.where}</span>
                  {l.what}
                </span>
              </Link>
              {l.known ? (
                <p className="muted" style={{ display: "flex", flexWrap: "wrap", gap: ".35rem", marginTop: ".15rem" }}>
                  <Freshness status={l.status} />
                  {l.lastAt && <span>· {t("endpoint.lineage.rebuilt", { when: f.since(l.lastAt) })}</span>}
                </p>
              ) : (
                <p className="muted">{t("endpoint.lineage.unknown")}</p>
              )}
              {l.sql && (
                <p>
                  <a className="muted" href={`/sql?target=${encodeURIComponent(l.target)}`}>
                    {t("endpoint.lineage.sql")}
                  </a>
                </p>
              )}
            </Step>
            <Arrow />
            <Step label={t("endpoint.lineage.endpoint")}>
              <p className="mono">GET {d.path}</p>
              {l.cacheTtl && <p className="muted">{t("endpoint.lineage.cache", { ttl: l.cacheTtl })}</p>}
            </Step>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** How long an answer is kept, what clears it, what holds it, and the command to clear it by hand. */
function CachePanel({ c }: { c: Endpoint["cache"] }) {
  const { t } = useT();
  return (
    <Panel title={t("endpoints.col.cache")} id="cache">
      {c.state === "set" ? (
        <>
          <dl className="ed-cache">
            <div>
              <dt>{t("endpoint.cache.ttl")}</dt>
              <dd className="big">{c.ttl}</dd>
              <dd className="sub">{t("endpoint.cache.ttl.hint")}</dd>
            </div>
            <div>
              <dt>{t("endpoint.cache.cleared")}</dt>
              <dd className="big">{t("endpoint.cache.cleared.value")}</dd>
              <dd className="sub" title={c.reads.join("\n")}>
                {c.reads.join(" · ")}
              </dd>
            </div>
            <div>
              <dt>{t("endpoint.cache.type")}</dt>
              <dd className="big">{c.type}</dd>
              <dd className="sub">{c.addrFrom}</dd>
            </div>
          </dl>
          <div className="ed-pad" style={{ borderTop: "1px solid var(--line)" }}>
            <p className="muted">{t("endpoint.cache.explain")}</p>
            {c.bump && (
              <div>
                <p style={{ fontWeight: 500, marginBottom: ".35rem" }}>{t("endpoint.cache.clear")}</p>
                <CodeBlock text={c.bump} label="brevis-sql generation bump" />
                <p className="muted" style={{ marginTop: ".35rem" }}>
                  {t("endpoint.cache.clear.when")}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="ed-pad muted">{t(c.state === "unknown" ? "endpoint.cache.unknown" : "endpoint.cache.none")}</p>
      )}
    </Panel>
  );
}

function ParamsPanel({ d }: { d: Endpoint }) {
  const { t } = useT();
  const paramsSaid = useParamsSaid();
  return (
    <Panel title={t("endpoints.col.params")} note={paramsSaid(d.paramCount, d.required)}>
      {d.params.length === 0 ? (
        <p className="ed-pad muted">{t("endpoint.params.none")}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>{t("endpoint.params.name")}</Th>
              <Th>{t("endpoint.params.type")}</Th>
              <Th>{t("endpoint.params.accepts")}</Th>
              <Th>{t("endpoint.params.default")}</Th>
            </tr>
          </thead>
          <tbody>
            {d.params.map((p) => (
              <tr key={p.name}>
                <Td>
                  <span className="mono">{p.name}</span>
                  {p.required && <span className="req">{t("endpoint.params.required")}</span>}
                  {p.note && <p className="ed-pnote">{p.note}</p>}
                </Td>
                <Td label={t("endpoint.params.type")} className="mono muted">
                  {p.type}
                </Td>
                <Td label={t("endpoint.params.accepts")}>{p.accepts}</Td>
                <Td label={t("endpoint.params.default")} className="mono">
                  {p.default === "" ? <span className="muted">—</span> : p.default}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function Limits({ l }: { l: Endpoint["limits"] }) {
  const { t } = useT();
  const f = useFormat();
  const stats: [string, string][] = [
    [t("endpoint.limits.timeout"), l.timeout],
    [t("endpoint.limits.rows"), f.number(l.maxRows)],
    [t("endpoint.limits.bytes"), l.maxBytes > 0 ? bytesText(l.maxBytes) : t("endpoint.limits.no_ceiling")],
  ];
  return (
    <section>
      <h2 className="ed-h2">{t("endpoint.limits")}</h2>
      <div className="ed-stats">
        {stats.map(([label, value]) => (
          <div key={label} className="ed-stat">
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The call from outside, with the key a placeholder; it follows Try it's form. */
function Curl({ d, values }: { d: Endpoint; values: Record<string, string> }) {
  const { t } = useT();
  const q = d.form
    .filter((f) => values[f.name])
    // The server's pages escape with a "+" for a space: the same curl in both.
    .map((f) => `${encodeURIComponent(f.name)}=${encodeURIComponent(values[f.name] ?? "").replace(/%20/g, "+")}`);
  const text = `${d.curlHead}'${d.curlBase}${q.length ? `?${q.join("&")}` : ""}'`;
  return (
    <Panel title={t("endpoint.call")}>
      <div className="ed-pad">
        <CodeBlock text={text} label="curl" />
      </div>
    </Panel>
  );
}

function AnswerView({ a }: { a: Answer }) {
  const { t, n } = useT();
  const cache = a.cache === "hit" || a.cache === "miss" || a.cache === "bypass" ? t(`endpoint.try.cache.${a.cache}`) : "";
  const total = a.truncated ? `${a.received}+` : String(a.received);
  return (
    <>
      <div className="ans-head">
        <span className={`ans-status ${a.status < 300 ? "ok" : "bad"}`}>
          {a.status} {a.statusText}
        </span>
        {a.cache && <span className="chip">{a.cache.toUpperCase()}</span>}
        <span>{a.millis} ms</span>
        {a.status === 200 && <span>{t("endpoint.try.rows", { n: total })}</span>}
      </div>
      {cache && <p className="muted" style={{ margin: "0 0 .5rem", fontSize: ".72rem" }}>{cache}</p>}
      {a.received > a.rows.length && (
        <p className="muted" style={{ margin: "0 0 .5rem", fontSize: ".72rem" }}>
          {t("endpoint.try.part", { shown: a.rows.length, n: a.received })}
        </p>
      )}
      {a.error ? (
        <p className="ans-err">{a.error}</p>
      ) : a.rows.length === 0 ? (
        <p className="muted">{t("endpoint.try.no_rows")}</p>
      ) : (
        <div className="ans-grid" tabIndex={0} role="region" aria-label={n("endpoint.try.rows", a.rows.length)}>
          <table>
            <thead>
              <tr>
                {a.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {a.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Try it: a POST of the parameters; nothing is asked of the API until Run is pressed. */
function TryIt({ d, values, setValues }: { d: Endpoint; values: Record<string, string>; setValues: (v: Record<string, string>) => void }) {
  const { t } = useT();
  const run = useMutation({
    mutationFn: () => postJSON<Answer>(`/api/endpoints/${encodeURIComponent(d.api)}/${encodeURIComponent(d.name)}/call`, { params: values }),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run.mutate();
  };
  return (
    <Panel title={t("endpoint.try")}>
      <form className="try" onSubmit={submit} onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === "Enter" && run.mutate()}>
        <p className="muted" style={{ margin: 0, fontSize: ".75rem" }}>
          {t("endpoint.try.lead")}
        </p>
        <div className="try-fields">
          {d.form.map((f) => (
            <label key={f.name}>
              <span>
                {f.name}
                {f.required && <span className="req">{t("endpoint.params.required")}</span>}
              </span>
              {f.kind === "select" ? (
                <select value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}>
                  <option value="">{t("endpoint.try.default")}</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.kind}
                  value={values[f.name] ?? ""}
                  maxLength={f.maxLen > 0 ? f.maxLen : undefined}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                />
              )}
            </label>
          ))}
        </div>
        <button type="submit" className="btn btn-primary" disabled={run.isPending}>
          ▶ {t("endpoint.try.run")} <span className="mono" style={{ opacity: 0.6 }}>⌘↵</span>
        </button>
        <div className="try-answer" aria-live="polite" aria-busy={run.isPending}>
          {run.isError ? (
            <p className="ans-err">{(run.error as ApiError).message}</p>
          ) : run.data ? (
            <AnswerView a={run.data} />
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: ".78rem" }}>
              {t("endpoint.try.empty")}
            </p>
          )}
        </div>
      </form>
    </Panel>
  );
}

function EndpointPage({ d }: { d: Endpoint }) {
  const { t } = useT();
  // Try it starts from each parameter's default; the curl follows what is typed.
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(d.form.map((f) => [f.name, f.value])));
  return (
    <>
      <Eyebrow d={d} />
      <h1 className="ed-title">{d.path}</h1>
      <div className={`ed-grid ${d.canRun ? "has-side" : ""}`}>
        <div className="ed-col">
          {d.about && <p className="ed-about">{d.about}</p>}
          {d.stale && <Stale s={d.stale} />}
          <div className="ed-note">
            <span aria-hidden="true">{d.keyed ? "🔑" : "ⓘ"}</span>
            <span>{t(d.keyed ? "endpoint.tenant.key" : "endpoint.tenant.none")}</span>
          </div>
          <LineagePanel d={d} />
          <CachePanel c={d.cache} />
          <ParamsPanel d={d} />
          <Limits l={d.limits} />
          {!d.canRun && <Curl d={d} values={values} />}
        </div>
        {d.canRun && (
          <div className="ed-col ed-side">
            <TryIt d={d} values={values} setValues={setValues} />
            <Curl d={d} values={values} />
          </div>
        )}
      </div>
    </>
  );
}

/** The page's shape while it loads: eyebrow, title, and the same one- or two-column grid. */
export function EndpointSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w="22rem" h=".9rem" className="ep-sk-line" />
      <Skeleton w="14rem" h="1.5rem" className="ep-sk-line" />
      <div className="ed-sk">
        <Skeleton h="9rem" />
        <Skeleton h="7rem" />
        <Skeleton h="10rem" />
      </div>
    </div>
  );
}

function Endpoint() {
  const { api = "", name = "" } = useParams();
  const q = useData<Endpoint>(["endpoint", api, name], `/api/endpoints/${encodeURIComponent(api)}/${encodeURIComponent(name)}`, { keep: false });
  if (q.isPending) return <EndpointSkeleton />;
  if (q.isError)
    return (
      <p role="alert" className="dc-missing">
        {q.error instanceof ApiError && q.error.status === 404 ? (
          <Link to="/data/endpoints">← All endpoints</Link>
        ) : null}{" "}
        {q.error.message}
      </p>
    );
  // The key resets Try it when another endpoint opens; a poll keeps what was typed.
  return <EndpointPage key={endpointHref(q.data)} d={q.data} />;
}

export default function EndpointRoute() {
  return (
    <Suspense fallback={<EndpointSkeleton />}>
      <Endpoint />
    </Suspense>
  );
}
