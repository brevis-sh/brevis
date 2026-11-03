import { Suspense } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import type { Change, Load, LoadDetail } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { QueryBoundary } from "../ui/boundary";
import { DefinitionList } from "../ui/kv";
import { LIVE } from "../ui/live";
import { Skeleton } from "../ui/skeleton";
import { LoadBars } from "../ui/sparkline";
import { StatusBadge } from "../ui/status";
import { StepConfigPanel } from "./load-config";
import "../ui/list.css";
import "./load.css";

const short = (id: string) => id.slice(0, 8);

function Changes({ changes }: { changes: Change[] }) {
  const { t } = useT();
  const { dateTime } = useFormat();
  return (
    <section className="panel">
      <h2>
        {t("config.changes.title")} <span className="muted">{changes.length}</span>
      </h2>
      <ol className="ld-changes">
        {changes.map((c) => (
          <li key={c.at + c.runId}>
            <span className="mono muted">{dateTime(c.at)}</span>
            {c.runId !== "" && (
              <a className="mono" href={`/runs/${c.runId}`}>
                {short(c.runId)}
              </a>
            )}
            {c.first && <span className="muted">{t("config.first_recorded")}</span>}
            {c.earlier && <span className="muted">{t("config.earlier")}</span>}
            {c.lines.length > 0 && (
              <ul>
                {c.lines.map((l) => (
                  <li key={l.path}>
                    <span className="mono muted">{l.path}</span> <span className="mono">{l.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Detail({ workflow, step, d }: { workflow: string; step: string; d: LoadDetail }) {
  const { t, n } = useT();
  const { since, number, dateTime } = useFormat();
  const here = useLocation();
  // Where the run comes back to: this address, as the server knows it.
  const back = here.pathname.replace(/^\/app(?=\/)/, "") + here.search;
  return (
    <>
      {d.reason !== "" && <p className="ld-reason">{d.reason}</p>}
      <section className="panel">
        <div className="body">
          <DefinitionList
            items={[
              {
                term: t("loads.drawer.from"),
                value:
                  d.source.kind === "" ? (
                    <span className="muted" title={t("loads.source.none.tip")}>
                      {t("loads.source.none")}
                    </span>
                  ) : (
                    <>
                      {d.source.label}
                      {d.source.where !== "" && <p className="mono ld-where">{d.source.where}</p>}
                    </>
                  ),
              },
              {
                term: t("loads.drawer.to"),
                value: (
                  <>
                    {d.target.kind !== "" && <span>{d.target.kindTitle}</span>}
                    <p className="mono ld-where">{d.target.uri}</p>
                    {d.target.uri !== "" && !d.legacy && (
                      <a href={`/data/target?u=${encodeURIComponent(d.target.uri)}`}>{t("loads.drawer.catalog")} →</a>
                    )}
                  </>
                ),
              },
              { term: t("loads.drawer.step"), value: step, mono: true },
              {
                term: t("loads.drawer.when"),
                value: d.hasSchedule ? (
                  <>
                    {d.when} <span className="mono muted">{d.cron} {d.timezone}</span>
                  </>
                ) : (
                  t("loads.manual")
                ),
              },
              {
                term: t("loads.drawer.last"),
                value: (
                  <>
                    {d.lastLoaded ? <span title={dateTime(d.lastLoaded)}>{since(d.lastLoaded)}</span> : "—"}
                    {d.lastRows !== null && (
                      <span className={d.readNothing ? "ld-bad" : undefined}> · {n("loads.drawer.rows", d.lastRows)}</span>
                    )}
                    {d.read !== null && <span className="muted"> {t("loads.drawer.read", { n: number(d.read) })}</span>}
                  </>
                ),
              },
            ]}
          />
          {d.fixing && (
            <p>
              <a className="ld-fixing" href={`/runs/${d.fixing}`}>
                {t("loads.fixing")} →
              </a>
            </p>
          )}
        </div>
      </section>

      <section className="panel">
        <h2>{t("loads.drawer.bars", { n: d.bars.length })}</h2>
        <div className="body">
          <LoadBars bars={d.bars.map((b) => ({ href: `/runs/${b.runId}`, rows: b.rows, title: b.title }))} missed={d.missed} />
          <p className="muted ld-small">{t("catalog.drawer.legend")}</p>
          <p className="muted ld-small">{t("loads.drawer.drop")}</p>
        </div>
      </section>

      {d.described ? (
        d.config && (
          <section className="panel">
            <h2>{t("config.title")}</h2>
            <div className="body ld-flush">
              <StepConfigPanel c={d.config} />
            </div>
          </section>
        )
      ) : (
        <section className="panel">
          <h2>{t("config.title")}</h2>
          <p className="body muted">
            {t("config.undescribed")} <a href={`/workflows/${encodeURIComponent(workflow)}`}>{t("config.definition")}</a>.
          </p>
        </section>
      )}

      {d.changes.length > 0 && <Changes changes={d.changes} />}

      <section className="panel">
        <h2>
          {t("loads.drawer.recent")} <span className="muted">{d.loadsCount}</span>
        </h2>
        <div className="ld-scroll">
          <table className="ld-loads">
            <thead>
              <tr>
                <th>{t("loads.drawer.recent.at")}</th>
                <th className="num">{t("loads.col.rows")}</th>
                <th className="num">{t("loads.drawer.recent.bytes")}</th>
                <th>{t("loads.drawer.recent.run")}</th>
              </tr>
            </thead>
            <tbody>
              {d.loads.map((l) => (
                <tr key={l.runId}>
                  <td className="mono muted">{dateTime(l.loadedAt)}</td>
                  <td className="num">{l.rows === null ? "—" : number(l.rows)}</td>
                  <td className="num">{l.bytes === null ? "—" : number(l.bytes)}</td>
                  <td>
                    <a className="mono" href={`/runs/${l.runId}`}>
                      {short(l.runId)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d.readBy.length > 0 && (
        <section className="panel">
          <h2>{t("catalog.drawer.read_by")}</h2>
          <ul className="body ld-readers">
            {d.readBy.map((e) => (
              <li key={e.href}>
                <a className="mono" href={e.href}>
                  GET {e.path}
                </a>{" "}
                <span className="muted">{e.api}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="ld-actions">
        {d.query !== "" && (
          <a className="btn" href={d.query}>
            {t("loads.drawer.query")}
          </a>
        )}
        <a className="btn" href={`/workflows/${encodeURIComponent(workflow)}`}>
          {t("loads.drawer.workflow")}
        </a>
        {d.run === "now" && (
          // A plain form post: the server runs it and comes back with a flash.
          <form method="post" action={`/workflows/${encodeURIComponent(workflow)}/trigger`}>
            <input type="hidden" name="back" value={back} />
            <button type="submit" className="btn btn-primary">
              {t("loads.drawer.run")}
            </button>
          </form>
        )}
        {d.run === "params" && (
          <a className="btn btn-primary" href={`/workflows/${encodeURIComponent(workflow)}#run`}>
            {t("loads.drawer.run.params")}
          </a>
        )}
      </div>
    </>
  );
}

function LoadData({ workflow, step }: { workflow: string; step: string }) {
  const { t, n } = useT();
  const { search } = useLocation();
  const { data: v } = useSuspenseQuery({
    queryKey: ["ingest", "load", workflow, step, search],
    queryFn: ({ signal }) =>
      getJSON<Load>(`/api/ingest/loads/${encodeURIComponent(workflow)}/${encodeURIComponent(step)}${search}`, signal),
    ...LIVE,
  });
  // Back to the list as it was filtered: the address minus the destination.
  const list = new URLSearchParams(search);
  list.delete("target");
  const target = (uri: string) => ({ search: `?target=${encodeURIComponent(uri)}` });
  return (
    <>
      <Link className="back" to={{ pathname: "/ingest/loads", search: list.toString() === "" ? "" : `?${list}` }}>
        ← {t("nav.loads")}
      </Link>
      <header className="ld-head">
        <p className="muted ld-kicker">{t("loads.drawer.kicker", { workflow: v.workflow })}</p>
        <h1 className="mono">{v.step}</h1>
        {v.detail && <StatusBadge status={v.detail.status} />}
      </header>
      {v.choices.length > 0 && (
        <section className="panel">
          <p className="body">{n("loads.drawer.choices", v.choices.length)}</p>
          <ul className="ld-choices">
            {v.choices.map((c) => (
              <li key={c.uri}>
                <Link className="mono" to={target(c.uri)} aria-current={c.current}>
                  {c.uri}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {v.detail && <Detail workflow={v.workflow} step={v.step} d={v.detail} />}
    </>
  );
}

export function LoadSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w="5rem" h=".9rem" />
      <div className="ld-head">
        <Skeleton w="8rem" h=".8rem" />
        <Skeleton w="14rem" h="1.5rem" />
        <Skeleton w="5rem" h="1rem" />
      </div>
      <Skeleton h="11rem" />
      <div style={{ height: "1rem" }} />
      <Skeleton h="7rem" />
      <div style={{ height: "1rem" }} />
      <Skeleton h="14rem" />
    </div>
  );
}

function Missing({ workflow, step }: { workflow: string; step: string }) {
  const { t } = useT();
  return (
    <div className="empty">
      <p>{t("loads.missing", { step: `${workflow} · ${step}` })}</p>
      <Link to="/ingest/loads">{t("nav.loads")}</Link>
    </div>
  );
}

export default function LoadRoute() {
  const { workflow = "", step = "" } = useParams();
  return (
    <QueryBoundary
      notFound={
        <Suspense fallback={<LoadSkeleton />}>
          <Missing workflow={workflow} step={step} />
        </Suspense>
      }
    >
      <Suspense fallback={<LoadSkeleton />}>
        <LoadData workflow={workflow} step={step} />
      </Suspense>
    </QueryBoundary>
  );
}
