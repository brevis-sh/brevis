import { useEffect, useRef, useState } from "react";
import { useFormat, useT } from "../i18n";
import { useAgo, useNumbers } from "./format";
import { RetryMark, StatusBadge } from "./status";
import { Skeleton } from "./skeleton";
import "./runs-table.css";

/** A run as /api/overview and /api/runs send it. */
export type RunRow = {
  id: string;
  workflow: string;
  status: string;
  trigger: string;
  attempt: number;
  logicalDate: string | null;
  createdAt: string;
  startedAt: string | null;
  durationMs: number | null;
  error: string;
  logos: string[];
};

function useTrigger() {
  const { t } = useT();
  return (kind: string) => {
    const key = `trigger.${kind}`;
    const word = t(key);
    return word === `[${key}]` ? kind : word;
  };
}

// The failure behind a run, in the browser's own modal: Esc, focus trap and
// return of focus come with <dialog>.
function ErrorDialog({ run, onClose }: { run: RunRow | null; onClose: () => void }) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (run && d && !d.open) d.showModal();
  }, [run]);
  return (
    <dialog ref={ref} className="rt-dialog" onClose={onClose} aria-labelledby="rt-err-title">
      {run && (
        <>
          <header>
            <div>
              <p className="muted" style={{ fontSize: ".72rem" }}>{t("run.error.title")}</p>
              <p id="rt-err-title" style={{ fontSize: "1.1rem", marginTop: ".2rem" }}>{run.workflow}</p>
            </div>
            <form method="dialog">
              <button autoFocus aria-label={t("dialog.close")}>{t("dialog.close_word")}</button>
            </form>
          </header>
          <div className="body">
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem", alignItems: "center", fontSize: ".78rem" }}>
              <StatusBadge status={run.status} />
              {/* The run's page is still the server's. */}
              <a href={`/runs/${run.id}`}>{t("run.error.open")}</a>
              <span className="mono muted">{run.id}</span>
            </div>
            <pre>{run.error}</pre>
          </div>
        </>
      )}
    </dialog>
  );
}

type Props = {
  runs: RunRow[];
  /** Show the workflow column; a workflow's own page leaves it out. */
  workflow?: boolean;
  /** Names the table for assistive technology. */
  label: string;
};

/**
 * Runs as a table from 48rem of its own width and as stacked cards below it.
 * The roles are written out because the cards turn table elements into grids,
 * which drops their semantics in some browsers.
 */
export function RunsTable({ runs, workflow = true, label }: Props) {
  const { t } = useT();
  const ago = useAgo();
  const trigger = useTrigger();
  const f = useFormat();
  const { elapsed } = useNumbers();
  const [failed, setFailed] = useState<RunRow | null>(null);
  const longest = Math.max(0, ...runs.map((r) => r.durationMs ?? 0));

  return (
    <div className="rt">
      <div className="rt-scroll">
        <table role="table" aria-label={label}>
          <thead role="rowgroup">
            <tr role="row">
              <th role="columnheader">{t("runs.col.state")}</th>
              {workflow && <th role="columnheader">{t("runs.col.workflow")}</th>}
              <th role="columnheader">{t("runs.col.trigger")}</th>
              <th role="columnheader">{t("runs.col.slot")}</th>
              <th role="columnheader">{t("runs.col.duration")}</th>
              <th role="columnheader" className="num">{t("runs.col.created")}</th>
              <th role="columnheader"><span className="rt-sr">{t("run.error.button")}</span></th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {runs.map((r) => (
              <tr role="row" key={r.id} data-status={r.status}>
                <td role="cell" className="c-state">
                  <StatusBadge status={r.status} />
                  <RetryMark attempt={r.attempt} />
                </td>
                {workflow && (
                  <td role="cell" className="c-wf">
                    {/* Run detail is not migrated yet: a full navigation. */}
                    <a className="wf" href={`/runs/${r.id}`}>{r.workflow}</a>
                  </td>
                )}
                <td role="cell" className="c-small c-trig" data-label={t("runs.col.trigger")}>{trigger(r.trigger)}</td>
                <td role="cell" className="c-small c-slot" data-label={t("runs.col.slot")}>
                  {r.logicalDate ? <span title={r.logicalDate}>{f.dateTime(r.logicalDate)}</span> : "—"}
                </td>
                <td role="cell" className="c-small c-dur" data-label={t("runs.col.duration")}>
                  {r.durationMs === null ? "—" : elapsed(r.durationMs)}
                  {r.durationMs !== null && longest > 0 && (
                    <span className="rt-bar" aria-hidden="true">
                      <span style={{ width: `${Math.max(1, Math.round((r.durationMs / longest) * 100))}%` }} />
                    </span>
                  )}
                </td>
                <td role="cell" className="c-small c-created num" title={r.createdAt}>{ago(r.createdAt)}</td>
                <td role="cell" className="c-err">
                  {r.error && (
                    <button type="button" className="rt-err" title={t("run.error.see")} onClick={() => setFailed(r)}>
                      {t("run.error.button")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorDialog run={failed} onClose={() => setFailed(null)} />
    </div>
  );
}

/** Rows of the same shape as RunsTable's, for the loading state. */
export function RunsTableSkeleton({ rows = 8, workflow = true }: { rows?: number; workflow?: boolean }) {
  return (
    <div className="rt" aria-hidden="true">
      <table>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className="c-state"><Skeleton w="5rem" h="1rem" /></td>
              {workflow && <td className="c-wf"><Skeleton w="9rem" h="1rem" /></td>}
              <td className="c-trig"><Skeleton w="3.5rem" h=".9rem" /></td>
              <td className="c-slot"><Skeleton w="5.5rem" h=".9rem" /></td>
              <td className="c-dur"><Skeleton w="3.5rem" h=".9rem" /></td>
              <td className="c-created num"><Skeleton w="3.5rem" h=".9rem" /></td>
              <td className="c-err" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
