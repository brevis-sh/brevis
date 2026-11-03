import { lazy, Suspense } from "react";
import { useFormat, useT } from "../i18n";
import type { Run, StepRow } from "../api/run";
import { KV, Panel, PanelEmpty } from "../ui/panel";
import { StatusBadge } from "../ui/status-badge";
import { Skeleton } from "../ui/skeleton";
import "./run.css";

// The graph's chunk (React Flow) loads only when the Steps tab is first opened.
const Dag = lazy(() => import("../ui/dag/dag"));

function Row({ r, opens }: { r: StepRow; opens: boolean }) {
  const { duration } = useFormat();
  const cells = (
    <>
      <span role="cell" className={`trunc mono${r.item ? " rn-item" : ""}`}>
        {r.item || r.node}
      </span>
      <span role="cell">
        <StatusBadge status={r.status} label={r.status} attempt={r.attempt} />
      </span>
      <span role="cell" />
      <span role="cell" className="mono">
        {r.exitCode ?? ""}
      </span>
      <span role="cell" className="num mono">
        {r.durationMs > 0 ? duration(r.durationMs) : ""}
      </span>
      <span role="cell" className="trunc mono" title={r.command}>
        {r.command}
      </span>
    </>
  );
  // A row with an error opens on it; one without is a plain row.
  return opens ? (
    <details role="rowgroup">
      <summary className="rn-row" role="row">
        {cells}
      </summary>
      <p className="rn-rowerr">{r.err}</p>
    </details>
  ) : (
    <div className="rn-row" role="row">
      {cells}
    </div>
  );
}

function StepsTable({ run }: { run: Run }) {
  const { t, n } = useT();
  if (run.steps.length === 0) return null;
  return (
    <Panel title={t("run.steps.output")} hint={n("run.steps.count", run.steps.length)}>
      <div className="rn-steps">
        <div role="table" aria-label={t("run.steps.output")}>
          <div className="rn-row h" role="row">
            <span role="columnheader">{t("run.steps.step")}</span>
            <span role="columnheader">{t("run.steps.state")}</span>
            <span role="columnheader" aria-label={t("run.steps.retry")} />
            <span role="columnheader">{t("run.steps.exit")}</span>
            <span role="columnheader" className="num">
              {t("run.steps.duration")}
            </span>
            <span role="columnheader">{t("run.steps.command")}</span>
          </div>
          {run.steps.map((g) =>
            g.mapped ? (
              <details key={g.node} role="rowgroup">
                <summary className="rn-row" role="row">
                  <span role="cell" className="trunc mono">
                    {g.node}
                  </span>
                  <span role="cell">
                    <StatusBadge status={g.status} label={g.status} />
                  </span>
                  <span role="cell" />
                  <span role="cell" />
                  <span role="cell" />
                  <span role="cell" className="mono">
                    {g.ok}/{g.total} ok
                  </span>
                </summary>
                {g.rows.map((r) => (
                  <Row key={`${r.node}#${r.item}#${r.attempt}`} r={r} opens={r.err !== ""} />
                ))}
              </details>
            ) : (
              g.rows.map((r) => <Row key={`${r.node}#${r.attempt}`} r={r} opens={r.err !== ""} />)
            ),
          )}
        </div>
      </div>
    </Panel>
  );
}

// A one-step run draws its step as a line where a larger run has its graph.
function StepLine({ run }: { run: Run }) {
  const { t } = useT();
  const { duration } = useFormat();
  const s = run.step;
  if (!s) return null;
  return (
    <Panel title={t("run.tab.steps")} hint="1">
      <div className="rn-line">
        <StatusBadge status={s.status || "pending"} label="" />
        <strong className="mono">{s.name}</strong>
        {s.action && (
          <span className="mono trunc" title={s.action} style={{ maxWidth: "28rem", color: "var(--muted)" }}>
            {s.action}
          </span>
        )}
        {s.runtime && (
          <span className={`rn-chip${s.runtimeInferred ? " inferred" : ""}`} title={s.runtimeInferred ? t("run.step.inferred") : undefined}>
            {s.runtime}
          </span>
        )}
        {s.sdk && <span className="rn-chip">SDK {s.sdk}</span>}
        {s.status && (
          <span style={{ marginLeft: "auto", fontSize: ".72rem", color: "var(--muted)" }}>
            {s.published > 0 && `${s.published} ${s.published === 1 ? "value" : "values"} published · `}
            {s.durationMs > 0 ? duration(s.durationMs) : "—"}
          </span>
        )}
      </div>
      {s.stages.length > 0 && (
        <ol className="rn-stages">
          {s.stages.map((st) => (
            <li key={st.label}>
              <div style={{ display: "flex", gap: ".4rem", fontSize: ".8125rem" }}>
                <StatusBadge status={st.state} label={st.label} />
                <span className="mono" style={{ marginLeft: "auto", color: "var(--muted)" }}>
                  {st.ms !== null ? duration(st.ms) : "—"}
                </span>
              </div>
              <div style={{ fontSize: ".72rem", color: "var(--muted)", display: "flex", gap: ".5rem", minWidth: 0 }}>
                {st.numbers.map((x) => (
                  <span key={x.key}>
                    <b>{x.value}</b> {x.key}
                  </span>
                ))}
                {st.detail && <span className="trunc mono">{st.detail}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function Alerts({ run }: { run: Run }) {
  const { t, n } = useT();
  const { dateTime } = useFormat();
  if (run.alerts.length === 0) return null;
  return (
    <Panel title={t("run.alerts")} hint={String(run.alerts.length)}>
      {run.alerts.map((a, i) => (
        <details key={i}>
          <summary className="rn-alert" style={{ cursor: a.err ? "pointer" : "default" }}>
            <StatusBadge status={a.tone} label="" />
            <span>{a.wording}</span>
            <span className="mono" style={{ color: "var(--muted)" }}>
              {a.channel}
            </span>
            {a.attempts > 0 && <small style={{ color: "var(--muted)" }}>{n("run.alert.tries", a.attempts)}</small>}
            <small style={{ marginLeft: "auto", color: "var(--muted)" }}>
              {a.deliveredAt ? dateTime(a.deliveredAt) : `${t("run.alert.raised")} ${dateTime(a.createdAt)}`}
            </small>
          </summary>
          {a.err && (
            <pre className="rn-pre err" style={{ margin: "0 .9rem .6rem" }}>
              {a.err}
            </pre>
          )}
        </details>
      ))}
    </Panel>
  );
}

export function StepsPanel({ run, active }: { run: Run; active: boolean }) {
  return (
    <>
      {run.step ? (
        <StepLine run={run} />
      ) : (
        // Mounted only while the tab shows: React Flow measures its box, and a hidden one has no size.
        active && (
          <div style={{ marginBottom: ".75rem" }}>
            <Suspense
              fallback={
                <div aria-busy="true" style={{ height: 380 }}>
                  <Skeleton h="100%" />
                </div>
              }
            >
              <Dag runId={run.id} />
            </Suspense>
          </div>
        )
      )}
      <StepsTable run={run} />
      <Alerts run={run} />
    </>
  );
}

export function ParamsPanel({ run }: { run: Run }) {
  const { t } = useT();
  return (
    <>
      <Panel title={t("run.params.auto")} hint={t("run.params.auto_hint")}>
        <KV items={run.auto} />
        <p className="panel-empty" style={{ borderTop: "1px solid var(--line)", fontSize: ".75rem" }}>
          {t("run.params.auto_note")}
        </p>
      </Panel>
      <Panel title={t("run.params.used")}>
        {run.params.length === 0 ? <PanelEmpty>{t("run.params.none")}</PanelEmpty> : <KV items={run.params} />}
      </Panel>
    </>
  );
}

export function ContextPanel({ run }: { run: Run }) {
  const { t, n } = useT();
  if (run.context.length === 0) return <PanelEmpty>{t("run.log.empty")}</PanelEmpty>;
  return (
    <>
      {run.context.map((c) => (
        <Panel key={c.step} title={c.step} hint={c.json ? n("run.context.bytes", c.bytes) : undefined}>
          {c.json ? <pre className="rn-ctx">{c.json}</pre> : <PanelEmpty>{c.note}</PanelEmpty>}
        </Panel>
      ))}
    </>
  );
}
