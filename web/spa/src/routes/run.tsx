import { Component, type ReactNode, Suspense, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { ApiError, getJSON } from "../api/client";
import { cancelRun, pollEvery, type Run } from "../api/run";
import { useFormat, useT } from "../i18n";
import { LogView } from "../ui/log-view";
import { Skeleton } from "../ui/skeleton";
import { StatusBadge } from "../ui/status-badge";
import { Tabs } from "../ui/tabs";
import { ContextPanel, ParamsPanel, StepsPanel } from "./run-panels";
import "./run.css";

const TABS = ["logs", "steps", "params", "context"] as const;
type Tab = (typeof TABS)[number];

// The same grid as the page: head, meta line, four phases, live line, tabs, one panel.
export function RunSkeleton() {
  return (
    <div className="rn" aria-busy="true" aria-label="Loading run">
      <div className="rn-head">
        <div>
          <Skeleton w="5rem" h="1rem" />
          <div style={{ marginTop: ".4rem" }}>
            <Skeleton w="16rem" h="1.65rem" />
          </div>
        </div>
        <Skeleton w="9rem" h="1.9rem" />
      </div>
      <Skeleton w="60%" h="1rem" />
      <div className="rn-sk-phases">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} h="3.6rem" />
        ))}
      </div>
      <Skeleton h="1.25rem" w="8rem" />
      <Skeleton h="2.4rem" />
      <Skeleton h="20rem" />
    </div>
  );
}

function RunHead({ run, onGoto }: { run: Run; onGoto: () => void }) {
  const { t, n } = useT();
  const { utc, duration } = useFormat();
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelRun(run.id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["run", run.id] }),
  });
  const [copied, setCopied] = useState(false);
  const canceling = run.canceling || cancel.isPending || (cancel.isSuccess && run.inFlight);

  return (
    <>
      <div className="rn-head">
        <div style={{ minWidth: 0 }}>
          <StatusBadge status={run.status} label={run.statusLabel} attempt={run.attempt} />
          <h1 className="rn-title">{run.workflow}</h1>
        </div>
        <div className="rn-actions">
          <a className="link" href={`/workflows/${encodeURIComponent(run.workflow)}`}>
            {t("run.view_workflow")} <span aria-hidden="true">→</span>
          </a>
          {run.inFlight ? (
            canceling ? (
              <span className="muted" style={{ fontSize: ".8125rem" }} role="status">
                {t("run.canceling")}
              </span>
            ) : (
              <button
                type="button"
                className="rn-btn danger"
                onClick={() => window.confirm(t("run.cancel_confirm")) && cancel.mutate()}
              >
                ■ {t("run.cancel")}
              </button>
            )
          ) : run.rerun === "now" ? (
            // The old page's own trigger: a POST that comes back to the new run.
            <form method="post" action={`/workflows/${encodeURIComponent(run.workflow)}/trigger`}>
              <button type="submit" className="rn-btn" title={t("run.rerun_title")}>
                ↻ {t("run.rerun")}
              </button>
            </form>
          ) : run.rerun === "params" ? (
            // The run-now drawer is still the old page's.
            <a className="rn-btn" href={`/runs/${run.id}#run`} title={t("run.rerun_title")}>
              ↻ {t("run.rerun_more")}
            </a>
          ) : null}
        </div>
      </div>
      {cancel.isError && (
        <p role="alert" style={{ margin: 0, color: "var(--st-failed)", fontSize: ".8125rem" }}>
          {cancel.error.message}
        </p>
      )}

      <dl className="rn-meta">
        <div>
          <dt>{t("run.trigger")}</dt>
          <dd>{run.trigger}</dd>
        </div>
        {run.slot && (
          <div>
            <dt>{t("run.slot")}</dt>
            <dd className="mono">{utc(run.slot)}</dd>
          </div>
        )}
        <div>
          <dt>{t("run.duration")}</dt>
          <dd>{run.inFlight ? t("run.in_progress") : run.durationMs !== null ? duration(run.durationMs) : "—"}</dd>
        </div>
        <div>
          <dt style={{ position: "absolute", left: "-9999px" }}>ID</dt>
          <dd>
            <button
              type="button"
              className="rn-id"
              title={`${run.id} · ${t("run.copy_id")}`}
              aria-label={`${t("run.copy_id")}: ${run.id}`}
              onClick={() =>
                void navigator.clipboard?.writeText(run.id).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                })
              }
            >
              {copied ? t("copy.done") : run.id.slice(0, 8)}
            </button>
          </dd>
        </div>
      </dl>

      {run.why ? (
        <section className="rn-why" aria-label={t("run.error.title")}>
          <div className="rn-why-top">
            <h2>{run.why.title}</h2>
            {run.why.hasLine && (
              <button type="button" className="rn-btn" onClick={onGoto}>
                {t("run.why.goto")}
              </button>
            )}
          </div>
          {run.why.streak >= 2 && <p>{n("run.why.streak", run.why.streak)}</p>}
          <pre className="rn-pre err">{run.why.excerpt}</pre>
        </section>
      ) : (
        run.err && (
          <details className="rn-err">
            <summary>
              ⚠ {run.err.split("\n")[0]} <small>· {t("run.error.details")}</small>
            </summary>
            <pre className="rn-pre err">{run.err}</pre>
          </details>
        )
      )}

      <ol className="rn-phases" aria-label="Timeline">
        {run.phases.map((p) => (
          <li key={p.key} className="rn-phase" data-state={p.state} aria-current={p.state === "current" ? "step" : undefined}>
            <p className="l">{p.label}</p>
            <p className="d" title={p.detail}>
              {p.detail || "—"}
            </p>
          </li>
        ))}
      </ol>

      {run.wait && (
        <p className="rn-wait">
          <span className="for">{t("run.wait.for")}</span> {run.wait.group ? `${t("run.wait.group")} ` : t("run.wait.own")}
          {run.wait.group && <code>{run.wait.group}</code>} ({t("run.wait.limit", { n: run.wait.limit })})
          {run.wait.holders.length > 0 && <> — {t("run.wait.held_by")} </>}
          {run.wait.holders.map((h, i) => (
            <span key={h.runId}>
              {i > 0 && ", "}
              <a href={`/runs/${h.runId}`}>{h.workflow}</a> <span className="mono">{t("run.wait.since", { at: utc(h.since) })}</span>
            </span>
          ))}
          {run.wait.more > 0 && <> {t("run.wait.more", { n: run.wait.more })}</>}
          {run.wait.ahead > 0 && <> · {n("run.wait.ahead", run.wait.ahead)}</>}
        </p>
      )}
    </>
  );
}

function RunScreen({ id }: { id: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [goto, setGoto] = useState(0);
  // Polling stops by itself when the tab is hidden (refetchIntervalInBackground
  // defaults to false) and when the run is terminal.
  const { data: run } = useSuspenseQuery({
    queryKey: ["run", id],
    queryFn: ({ signal }) => getJSON<Run>(`/api/runs/${id}`, signal),
    refetchInterval: (q) => pollEvery(q.state.data),
    staleTime: 0,
    retry: (n, e) => !(e instanceof ApiError && e.status === 404) && n < 1,
  });

  const wanted = hash.slice(1);
  const tab: Tab = (TABS as readonly string[]).includes(wanted) ? (wanted as Tab) : "logs";
  const pick = (k: string) => void navigate({ hash: `#${k}` }, { replace: true });
  const panel = (k: Tab, body: ReactNode) => (
    <div role="tabpanel" id={`run-tab-panel-${k}`} aria-labelledby={`run-tab-${k}`} className="rn-panel" hidden={tab !== k}>
      {body}
    </div>
  );

  return (
    <div className="rn">
      <RunHead
        run={run}
        onGoto={() => {
          pick("logs");
          setGoto((g) => g + 1);
        }}
      />
      <p className={`rn-live${run.terminal ? " done" : ""}`} role="status">
        {run.terminal ? t("run.live.finished") : t("run.live.following")}
      </p>
      <div>
        <Tabs
          label={t("run.tabs")}
          idPrefix="run-tab"
          active={tab}
          onChange={pick}
          tabs={[
            { key: "logs", label: t("run.tab.logs"), count: run.log.lines },
            { key: "steps", label: t("run.tab.steps"), count: run.steps.length },
            { key: "params", label: t("run.tab.params"), count: run.auto.length + run.params.length },
            { key: "context", label: t("run.tab.context") },
          ]}
        />
        {/* Panels stay mounted (a search in the log survives a tab change); the graph mounts only when shown. */}
        {panel("logs", <LogView log={run.log} live={!run.terminal} downloadHref={`/runs/${run.id}/log.txt`} gotoCause={goto} />)}
        {panel("steps", <StepsPanel run={run} active={tab === "steps"} />)}
        {panel("params", <ParamsPanel run={run} />)}
        {panel("context", <ContextPanel run={run} />)}
      </div>
    </div>
  );
}

// A missing run or a failed read: the message, not a blank page.
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <section className="rn-error" role="alert">
        <p style={{ margin: 0 }}>{e instanceof ApiError && e.status === 404 ? "Run not found." : "The run could not be loaded."}</p>
        <a href="/runs">Runs</a>
      </section>
    );
  }
}

export default function RunRoute() {
  const { id = "" } = useParams();
  return (
    <Boundary key={id}>
      <Suspense fallback={<RunSkeleton />}>
        <RunScreen id={id} />
      </Suspense>
    </Boundary>
  );
}
