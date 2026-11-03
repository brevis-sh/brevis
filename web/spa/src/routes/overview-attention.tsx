import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { getJSON } from "../api/client";
import { useT } from "../i18n";
import { useAgo } from "../ui/format";
import { StatusMark, useStateWord } from "../ui/status";
import { Skeleton } from "../ui/skeleton";

type Cause = { step: string; mapIndex: number | null; exitCode: number | null; line: string };
type Item = {
  workflow: string;
  runId: string;
  failedAt: string;
  streak: number;
  cause: Cause | null;
  rerunnable: boolean;
  params: Record<string, string>;
  rerunning: string;
};
type Target = { target: string; status: string; workflow: string; missed: string };
export type Attention = { total: number; items: Item[]; more: number; targets: Target[]; targetsMore: number };

/** "Needs your attention" follows itself every ten seconds (the old page's cadence); a hidden tab pauses it. */
export const attentionQuery = {
  queryKey: ["overview", "attention"],
  queryFn: ({ signal }: { signal: AbortSignal }) => getJSON<Attention>("/api/overview/attention", signal),
  refetchInterval: 10_000,
};

export function AttentionSkeleton() {
  return (
    <section className="att att-empty" aria-busy="true" aria-label="Loading">
      <Skeleton w="1rem" h="1rem" />
      <div style={{ flex: 1 }}>
        <Skeleton w="14rem" h="1rem" />
        <div style={{ marginTop: ".4rem" }}>
          <Skeleton w="60%" h=".8rem" />
        </div>
      </div>
    </section>
  );
}

// What stopped the run: its step, and how it exited; "The run failed" when it died before any step.
function useWhy() {
  const { t } = useT();
  return (c: Cause) => {
    if (!c.step) return t("run.why.run");
    const step = c.mapIndex === null ? c.step : `${c.step}[${c.mapIndex}]`;
    return c.exitCode === null ? t("run.why.step", { step }) : t("run.why.step_exit", { step, code: c.exitCode });
  };
}

function ItemRow({ it }: { it: Item }) {
  const { t, n } = useT();
  const ago = useAgo();
  const why = useWhy();
  const streak = it.streak < 2 ? "" : it.streak === 2 ? t("overview.second_time") : n("run.why.streak", it.streak);
  return (
    <li className="att-row" data-attention-item={it.workflow}>
      <StatusMark status="failed" />
      <div className="att-main">
        <p>
          <span className="mono att-name">{it.workflow}</span>{" "}
          <span className="muted">
            {t("overview.failed")} {ago(it.failedAt)}
            {streak && ` · ${streak}`}
          </span>
        </p>
        {it.cause && (
          <p className="att-why">
            {why(it.cause)}
            {it.cause.line && (
              <>
                {" — "}
                <code>{it.cause.line}</code>
              </>
            )}
          </p>
        )}
      </div>
      <div className="att-acts">
        {/* The run's page is still the server's. */}
        <a className="btn" href={`/runs/${it.runId}#logs`}>{t("overview.view_log")}</a>
        {it.rerunning ? (
          <a className="att-going" href={`/runs/${it.rerunning}`}>
            <StatusMark status="running" /> {t("overview.rerunning")}
          </a>
        ) : (
          it.rerunnable && (
            // The server's trigger, as the old page posts it; it comes back to the app.
            <form method="post" action={`/workflows/${encodeURIComponent(it.workflow)}/trigger`}>
              <input type="hidden" name="back" value="/app/" />
              {Object.entries(it.params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => (
                <input key={k} type="hidden" name={`param.${k}`} value={v} />
              ))}
              <button type="submit" className="btn">{t("overview.rerun")}</button>
            </form>
          )
        )}
      </div>
    </li>
  );
}

function TargetRow({ tg }: { tg: Target }) {
  const { t } = useT();
  const ago = useAgo();
  const word = useStateWord();
  return (
    <li className="att-row" data-attention-target={tg.target}>
      <StatusMark status={tg.status} />
      <div className="att-main">
        <p>
          <span className="mono att-name" style={{ overflowWrap: "anywhere" }}>{tg.target}</span> <span className="muted">{word(tg.status)}</span>
        </p>
        <p className="att-why">{t("overview.target.missed", { workflow: tg.workflow, when: ago(tg.missed) })}</p>
      </div>
      <a className="btn" href={`/data/target?u=${encodeURIComponent(tg.target)}`}>{t("overview.open_catalog")}</a>
    </li>
  );
}

export function AttentionSection() {
  const { t, n } = useT();
  const { data: a } = useSuspenseQuery(attentionQuery);

  if (a.total === 0) {
    return (
      <section className="att att-empty" data-attention-empty aria-labelledby="att-none">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--st-success)" strokeWidth="2" aria-hidden="true">
          <path d="M3 8.5l3.2 3.2L13 4.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <p id="att-none" style={{ margin: 0, fontWeight: 500 }}>{t("overview.attention.none")}</p>
          <p className="muted" style={{ margin: ".15rem 0 0", fontSize: ".8rem" }}>{t("overview.attention.none_hint")}</p>
        </div>
      </section>
    );
  }
  return (
    <section className="att att-bad" aria-labelledby="att-title">
      <header>
        <h2 id="att-title">{t("overview.attention")}</h2>
        <span className="mono muted">{a.total}</span>
        <span className="muted att-hint">{t("overview.attention.hint")}</span>
      </header>
      <ul>
        {a.items.map((it) => (
          <ItemRow key={it.workflow} it={it} />
        ))}
      </ul>
      {a.more > 0 && (
        <Link className="att-more" to="/runs?state=failed">{n("overview.attention.more", a.more)} →</Link>
      )}
      {a.targets.length > 0 && (
        <ul className="att-targets">
          {a.targets.map((tg) => (
            <TargetRow key={tg.target} tg={tg} />
          ))}
        </ul>
      )}
      {a.targetsMore > 0 && <a className="att-more" href="/data?status=attention">{n("overview.target.more", a.targetsMore)} →</a>}
    </section>
  );
}
