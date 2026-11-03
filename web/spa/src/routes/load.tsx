import { Link, useLocation, useParams } from "react-router";
import { ApiError } from "../api/client";
import { useData } from "../api/live";
import type { Change, Load, LoadDetail } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { useSince } from "../ui/format";
import { useCrumb } from "../shell/nav";
import { Icon } from "../ui/icon";
import { btn, ButtonLink, Card, Empty, FilterRow, PageHead, ShortStamp, linkUnderline, Page } from "../ui/kit";
import { Logo, useLogoTitle } from "../ui/logo";
import { Skeleton } from "../ui/skeleton";
import { LoadBars } from "../ui/sparkline";
import { Freshness } from "../ui/status";
import { StepConfigPanel } from "./load-config";

const short = (id: string) => id.slice(0, 8);
const th = "px-2.5 py-2 text-[11.5px] font-medium whitespace-nowrap text-faint";
const dt = "text-muted";

function Changes({ changes }: { changes: Change[] }) {
  const { t } = useT();
  return (
    <Card title={t("config.changes.title")} count={String(changes.length)}>
      <ol className="divide-y divide-line-soft">
        {changes.map((c) => (
          <li key={c.at + c.runId} className="px-3.5 py-2 text-[12px]">
            <span className="font-mono text-muted tabular-nums">
              <ShortStamp at={c.at} />
            </span>
            {c.runId !== "" && (
              <Link to={`/runs/${c.runId}`} className={`ml-2 font-mono ${linkUnderline}`}>
                {short(c.runId)}
              </Link>
            )}
            {c.first ? <span className="ml-2 text-muted">{t("config.first_recorded")}</span> : c.earlier ? <span className="ml-2 text-muted">{t("config.earlier")}</span> : null}
            {c.lines.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {c.lines.map((l) => (
                  <li key={l.path}>
                    <span className="font-mono text-muted">{l.path}</span>
                    <span className="ml-2 font-mono break-all text-ink">{l.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Skel({ w = "8rem" }: { w?: string }) {
  return <Skeleton w={w} h="1rem" />;
}

/** The facts of the load: from where to where, when it runs, its last load. The labels are static; the values arrive. */
function Facts({ step, d }: { step: string; d: LoadDetail | undefined }) {
  const { t, n } = useT();
  const { number } = useFormat();
  const since = useSince();
  const kindName = useLogoTitle();
  return (
    <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-4 gap-y-3 rounded-card border border-line bg-surface px-4 py-3.5 text-[12.5px]">
      <dt className={dt}>{t("loads.drawer.from")}</dt>
      <dd className="min-w-0">
        {!d ? (
          <Skel />
        ) : d.source.kind === "" ? (
          <span className="text-faint" title={t("loads.source.none.tip")}>
            {t("loads.source.none")}
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-ink-2">
              {(d.source.kind === "http" || d.source.kind === "file") && <Logo k={d.source.kind} />}
              {d.source.label}
            </span>
            {d.source.where !== "" && <p className="mt-0.5 font-mono text-[12px] break-all text-ink">{d.source.where}</p>}
          </>
        )}
      </dd>
      <dt className={dt}>{t("loads.drawer.to")}</dt>
      <dd className="min-w-0">
        {!d ? (
          <Skel w="16rem" />
        ) : (
          <>
            {d.target.kind !== "" && (
              <span className="flex items-center gap-1.5 text-ink-2">
                <Logo k={d.target.kind} />
                {kindName(d.target.kind)}
              </span>
            )}
            <p className="mt-0.5 flex items-start gap-1.5 font-mono text-[12px] break-all text-ink">{d.target.uri}</p>
            {d.target.uri !== "" && !d.legacy && (
              <Link to={`/data/target?u=${encodeURIComponent(d.target.uri)}`} className="mt-1 inline-block text-[12px] text-ink-2 hover:text-ink hover:underline">
                {t("loads.drawer.catalog")} &rarr;
              </Link>
            )}
          </>
        )}
      </dd>
      <dt className={dt}>{t("loads.drawer.step")}</dt>
      <dd className="font-mono text-ink">{step}</dd>
      <dt className={dt}>{t("loads.drawer.when")}</dt>
      <dd className="text-ink">
        {!d ? (
          <Skel w="10rem" />
        ) : d.hasSchedule ? (
          <>
            {d.when} <span className="ml-1 font-mono text-[11.5px] text-muted">{d.cron} {d.timezone}</span>
          </>
        ) : (
          t("loads.manual")
        )}
      </dd>
      <dt className={dt}>{t("loads.drawer.last")}</dt>
      <dd className="text-ink">
        {!d ? (
          <Skel w="12rem" />
        ) : (
          <>
            {d.lastLoaded ? since(d.lastLoaded) : "—"}
            {d.lastRows !== null && <span className={`ml-1 ${d.readNothing ? "text-state-failed" : ""}`}>· {n("loads.drawer.rows", d.lastRows)}</span>}
            {d.read !== null && <span className="ml-1 text-muted">{t("loads.drawer.read", { n: number(d.read) })}</span>}
          </>
        )}
      </dd>
    </dl>
  );
}

function Body({ workflow, step, d }: { workflow: string; step: string; d: LoadDetail | undefined }) {
  const { t } = useT();
  const { number } = useFormat();
  return (
    <div className="space-y-3">
      {d && d.reason !== "" && <p className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">{d.reason}</p>}
      <Facts step={step} d={d} />
      {d?.fixing && (
        <Link to={`/runs/${d.fixing}`} className="inline-block text-[12px] text-state-running hover:underline">
          {t("loads.fixing")} &rarr;
        </Link>
      )}
      <section>
        <h3 className="mb-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{t("loads.drawer.bars", { n: d ? d.bars.length : "…" })}</h3>
        {d ? <LoadBars bars={d.bars.map((b) => ({ href: `/runs/${b.runId}`, rows: b.rows, title: b.title }))} missed={d.missed} /> : <Skeleton w="14rem" h="2.75rem" />}
        <p className="mt-1.5 text-[11.5px] text-faint">{t("catalog.drawer.legend")}</p>
        <p className="mt-1 text-[12px] text-muted">{t("loads.drawer.drop")}</p>
      </section>

      <Card title={t("config.title")}>
        {!d ? (
          <Skeleton h="12rem" />
        ) : d.described && d.config ? (
          <StepConfigPanel c={d.config} />
        ) : (
          <p className="px-3.5 py-3 text-[12.5px] text-muted">
            {t("config.undescribed")}{" "}
            <Link to={`/workflows/${encodeURIComponent(workflow)}`} className={linkUnderline}>
              {t("config.definition")}
            </Link>
            .
          </p>
        )}
      </Card>

      {d && d.changes.length > 0 && <Changes changes={d.changes} />}

      <Card title={t("loads.drawer.recent")} count={d?.loadsCount}>
        <div className="max-h-[28rem] overflow-auto">
          <table className="ct w-full text-[12.5px]">
            <thead className="sticky top-0 bg-surface">
              <tr className="text-left">
                <th className={`${th} pl-3.5`}>{t("loads.drawer.recent.at")}</th>
                <th className={`${th} text-right`}>{t("loads.col.rows")}</th>
                <th className={`${th} text-right`}>{t("loads.drawer.recent.bytes")}</th>
                <th className={`${th} pr-3.5`}>{t("loads.drawer.recent.run")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {!d
                ? [0, 1, 2].map((i) => (
                    <tr key={i} aria-hidden="true">
                      {[0, 1, 2, 3].map((j) => (
                        <td key={j} className="px-2.5 pl-3.5"><Skeleton w="5rem" h="1rem" /></td>
                      ))}
                    </tr>
                  ))
                : d.loads.map((l) => (
                    <tr key={l.runId}>
                      <td className="px-2.5 pl-3.5 font-mono text-[12px] whitespace-nowrap text-muted tabular-nums">
                        <ShortStamp at={l.loadedAt} />
                      </td>
                      <td className="px-2.5 text-right tabular-nums">{l.rows === null ? "—" : number(l.rows)}</td>
                      <td className="px-2.5 text-right tabular-nums">{l.bytes === null ? "—" : number(l.bytes)}</td>
                      <td className="px-2.5 pr-3.5">
                        <Link to={`/runs/${l.runId}`} className={`font-mono text-[12px] ${linkUnderline}`}>
                          {short(l.runId)}
                        </Link>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </Card>

      {d && d.readBy.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12.5px] font-semibold text-ink">{t("catalog.drawer.read_by")}</h3>
          <ul className="space-y-1 text-[12.5px]">
            {d.readBy.map((e) => (
              <li key={e.href}>
                <Link to={e.href} className="font-mono text-ink hover:underline">
                  GET {e.path}
                </Link>
                <span className="ml-1.5 text-muted">{e.api}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The page's verbs: a query of the destination, the workflow, and running it. */
function Actions({ workflow, d }: { workflow: string; d: LoadDetail | undefined }) {
  const { t } = useT();
  const here = useLocation();
  // Where the run comes back to: this address, as the server knows it.
  const back = here.pathname.replace(/^\/app(?=\/)/, "") + here.search;
  return (
    <>
      {d && d.query !== "" && (
        <ButtonLink to={d.query} icon="terminal">
          {t("loads.drawer.query")}
        </ButtonLink>
      )}
      <ButtonLink to={`/workflows/${encodeURIComponent(workflow)}`}>{t("loads.drawer.workflow")}</ButtonLink>
      {d?.run === "now" && (
        // A plain form post: the server runs it and comes back with a flash.
        <form method="post" action={`/workflows/${encodeURIComponent(workflow)}/trigger`}>
          <input type="hidden" name="back" value={back} />
          <button type="submit" className={btn(true)}>
            <Icon name="play" className="h-3.5 w-3.5" />
            {t("loads.drawer.run")}
          </button>
        </form>
      )}
      {d?.run === "params" && (
        <ButtonLink to={`/workflows/${encodeURIComponent(workflow)}#run`} icon="play" primary>
          {t("loads.drawer.run.params")}
        </ButtonLink>
      )}
    </>
  );
}

export default function LoadRoute() {
  const { workflow = "", step = "" } = useParams();
  const { t, n } = useT();
  const { search } = useLocation();
  useCrumb(`${workflow} · ${step}`);
  const q = useData<Load>(["ingest", "load", workflow, step, search], `/api/ingest/loads/${encodeURIComponent(workflow)}/${encodeURIComponent(step)}${search}`, {
    every: 15_000,
    keep: false,
  });
  const v = q.data;
  // Back to the list as it was filtered: the address minus the destination.
  const list = new URLSearchParams(search);
  list.delete("target");
  const back = `/ingest/loads${list.toString() === "" ? "" : `?${list}`}`;

  if (q.error instanceof ApiError && q.error.status === 404)
    return (
      <Empty msg={t("loads.missing", { step: `${workflow} · ${step}` })}>
        <Link to="/ingest/loads" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
          {t("nav.loads")}
        </Link>
      </Empty>
    );
  return (
    <Page>
      <PageHead
        mono
        title={step}
        eyebrow={
          <>
            <Link to={back} className="text-[0.75rem] text-muted hover:text-ink">
              &larr; {t("nav.loads")}
            </Link>
            <span className="text-faint">·</span>
            <span className="text-[0.7rem] font-medium tracking-[0.08em] text-muted uppercase">{t("loads.drawer.kicker", { workflow })}</span>
            {v?.detail ? <Freshness status={v.detail.status} /> : !v ? <Skeleton w="5rem" h=".8rem" /> : null}
          </>
        }
        actions={<Actions workflow={workflow} d={v?.detail ?? undefined} />}
      />
      {q.isError && (
        <p role="alert" className="mb-3 rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
          {(q.error as Error).message}
        </p>
      )}
      {v && v.choices.length > 0 && (
        <FilterRow>
          <span className="text-[12.5px] text-muted">{n("loads.drawer.choices", v.choices.length)}</span>
          {v.choices.map((c) => (
            <Link
              key={c.uri}
              to={{ search: `?target=${encodeURIComponent(c.uri)}` }}
              aria-current={c.current ? "true" : undefined}
              className={`inline-flex h-8 items-center rounded-card border px-3 font-mono text-[12px] whitespace-nowrap transition-colors ${
                c.current ? "border-ink text-ink" : "border-line text-ink-2 hover:border-line-strong"
              }`}
            >
              {c.uri}
            </Link>
          ))}
        </FilterRow>
      )}
      {!q.isError && (!v || v.detail) && <Body workflow={workflow} step={step} d={v?.detail ?? undefined} />}
    </Page>
  );
}
