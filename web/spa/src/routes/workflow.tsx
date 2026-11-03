import { Suspense, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, getJSON } from "../api/client";
import { useScheduleToggle, type WorkflowDetail } from "../api/workflows";
import { useFormat, useT } from "../i18n";
import { fmtDuration } from "../ui/duration";
import { LogoList } from "../ui/logo-chip";
import { Skeleton } from "../ui/skeleton";
import { StateChip } from "../ui/state-chip";
import { TabBar } from "../ui/tab-bar";
import "./workflows.css";
import "./workflow.css";

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="wd-card">
      <header>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

// ---- skeleton: the same blocks, in the same grid, as the page below ----

export function WorkflowSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workflow">
      <div className="wd-head">
        <Skeleton w="16rem" h="1.5rem" />
        <Skeleton w="6rem" h="2rem" />
      </div>
      <div className="wd-meta">
        <Skeleton w="28rem" h="1rem" />
      </div>
      <div className="wd-stats">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="wd-stat">
            <Skeleton w="60%" h=".7rem" />
            <Skeleton w="50%" h="1.5rem" />
            <Skeleton w="70%" h=".7rem" />
          </div>
        ))}
      </div>
      <section className="wd-card">
        <header>
          <Skeleton w="10rem" h="1rem" />
        </header>
        <div className="wd-pad">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} h="1.6rem" />
          ))}
        </div>
      </section>
      <section className="wd-card">
        <header>
          <Skeleton w="8rem" h="1rem" />
        </header>
        <div className="wd-pad">
          <Skeleton h="6rem" />
        </div>
      </section>
      <Skeleton w="22rem" h="2.2rem" />
      <section className="wd-card">
        <div className="wd-pad">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} h="1.6rem" />
          ))}
        </div>
      </section>
    </div>
  );
}

// ---- the year of runs: one square per day, colored by the day's worst outcome ----

const CELL = 11;
const STEP = 14;
const LEFT = 28;
const TOP = 16;
const WEEKS = 53;

function YearOfRuns({ d }: { d: WorkflowDetail }) {
  const { t, n } = useT();
  const { date, number } = useFormat();
  const { lang } = useT();
  const [sp] = useSearchParams();
  const byDay = new Map(d.calendar.days.map((x) => [x.date, x]));
  const today = new Date(d.now);
  today.setUTCHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const start = new Date(monday);
  start.setUTCDate(start.getUTCDate() - 7 * (WEEKS - 1));
  const month = new Intl.DateTimeFormat(lang, { month: "short", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" });

  const squares: React.ReactNode[] = [];
  const months: React.ReactNode[] = [];
  const used = new Set<string>();
  for (let i = 0; i < WEEKS * 7; i++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    const col = Math.floor(i / 7);
    const row = i % 7;
    const key = day.toISOString().slice(0, 10);
    const x = LEFT + col * STEP;
    const y = TOP + row * STEP;
    if (row === 0 && day.getUTCDate() <= 7) {
      const m = month.format(day);
      if (!used.has(m)) {
        used.add(m);
        months.push(
          <text key={`m${i}`} x={x} y={10} className="cal-label">
            {m}
          </text>,
        );
      }
    }
    const future = day > today;
    const info = byDay.get(key);
    const ran = !!info && info.total > 0;
    const when = date(day.toISOString());
    const fill = !ran ? "var(--sk)" : info.failed > 0 ? "var(--st-bad)" : info.open > 0 ? "var(--st-wait)" : "var(--st-ok)";
    const tip = !ran
      ? `${when} · ${t("calendar.no_run")}`
      : `${when} · ${n("calendar.runs", info.total)} · ${info.failed > 0 ? n("calendar.failed", info.failed) : info.open > 0 ? t("calendar.open") : t("calendar.ok")}`;
    const rect = (
      <rect x={x} y={y} width={CELL} height={CELL} rx={2} fill={fill} opacity={future ? 0.35 : ran ? 1 : 0.8} stroke={sp.get("day") === key ? "var(--fg)" : "none"} strokeWidth={2}>
        <title>{tip}</title>
      </rect>
    );
    squares.push(
      ran ? (
        <Link key={key} to={`?day=${key}#runs`} aria-label={tip}>
          {rect}
        </Link>
      ) : (
        <g key={key}>{rect}</g>
      ),
    );
  }
  const labels = [0, 2, 4].map((r) => {
    const day = new Date(monday);
    day.setUTCDate(day.getUTCDate() + r);
    return (
      <text key={r} x={0} y={TOP + r * STEP + CELL - 2} className="cal-label">
        {weekday.format(day)}
      </text>
    );
  });
  const c = d.calendar;
  return (
    <Card title={t("calendar.title")}>
      <div className="wd-pad">
        <p className="muted small">{t("calendar.lead")}</p>
        <p className="wd-sum small muted">
          <span>
            <b>{number(c.ranDays)}</b> {n("calendar.ran_days", c.ranDays)}
          </span>
          <span>
            <b>{number(c.failedDays)}</b> {t("calendar.failed_days")}
          </span>
          {c.ranDays > 0 && (
            <span>
              <b>{number(c.streak)}</b> {n("calendar.streak", c.streak)}
            </span>
          )}
          {c.lastFailure && (
            <span>
              {t("calendar.last_failure")} <b>{date(c.lastFailure)}</b>{" "}
              <Link to={`?day=${c.lastFailure}#runs`}>{t("calendar.see")}</Link>
            </span>
          )}
          {c.since && (
            <span>
              {t("calendar.since")} <b>{date(c.since)}</b>
            </span>
          )}
        </p>
        <div className="cal-scroll">
          <svg role="group" aria-label={t("calendar.label")} viewBox={`0 0 ${LEFT + WEEKS * STEP - 3} ${TOP + 7 * STEP - 3}`} className="cal">
            {labels}
            {months}
            {squares}
          </svg>
        </div>
      </div>
    </Card>
  );
}

// ---- tabs ----

function RunsTab({ d }: { d: WorkflowDetail }) {
  const { t } = useT();
  const { since, date } = useFormat();
  return (
    <>
      <div className="wd-bar small muted">
        {d.day ? (
          <span className="chip">
            {date(d.day)}{" "}
            <Link to="#runs" aria-label={t("workflow.runs.clear_day")}>
              ×
            </Link>
          </span>
        ) : (
          <span>{t("workflow.runs.lead")}</span>
        )}
        {/* A plain link: the Runs screen is still the server's. */}
        <a href={`/runs?workflow=${encodeURIComponent(d.slug)}`}>{t("workflow.runs.all")} →</a>
      </div>
      {d.runs.length === 0 ? (
        <p className="wd-none muted">{t("workflow.runs.none")}</p>
      ) : (
        <table className="dt">
          <thead>
            <tr>
              <th>{t("runs.col.state")}</th>
              <th>{t("runs.col.trigger")}</th>
              <th>{t("runs.col.slot")}</th>
              <th>{t("workflow.runs.params")}</th>
              <th>{t("runs.col.duration")}</th>
              <th className="r">{t("workflow.runs.when")}</th>
            </tr>
          </thead>
          <tbody>
            {d.runs.map((r) => (
              <tr key={r.id}>
                <td data-label={t("runs.col.state")}>
                  <a href={`/runs/${r.id}`}>
                    <StateChip status={r.status} />
                  </a>
                </td>
                <td data-label={t("runs.col.trigger")} className="muted">
                  {r.slot ? t("workflow.runs.manual_slot") : t(`trigger.${r.trigger}`)}
                </td>
                <td data-label={t("runs.col.slot")} className="mono">
                  {r.logicalDate ? r.logicalDate.slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td data-label={t("workflow.runs.params")} className="mono">
                  {r.given.length > 0 ? r.given.join(" ") : <span className="muted sans">{t("workflow.runs.default")}</span>}
                </td>
                <td data-label={t("runs.col.duration")} className="muted">
                  {fmtDuration(r.durationMs)}
                </td>
                <td data-label={t("workflow.runs.when")} className="r muted">
                  {since(r.createdAt, new Date(d.now).getTime())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function ParamsTab({ d }: { d: WorkflowDetail }) {
  const { t } = useT();
  if (d.params.length === 0)
    return (
      <p className="wd-none muted">
        {t("workflow.params.none")} <code>$BREVIS_AUTO_*</code>.
      </p>
    );
  return (
    <table className="dt">
      <thead>
        <tr>
          <th>{t("workflow.params.name")}</th>
          <th>{t("workflow.params.type")}</th>
          <th>{t("workflow.params.default")}</th>
          <th>{t("workflow.params.what")}</th>
        </tr>
      </thead>
      <tbody>
        {d.params.map((p) => (
          <tr key={p.name}>
            <td data-label={t("workflow.params.name")}>
              <span className="mono">{p.name}</span>
              {p.group && <p className="muted tiny">{p.group}</p>}
            </td>
            <td data-label={t("workflow.params.type")} className="mono muted">
              {p.type}
            </td>
            <td data-label={t("workflow.params.default")} className="mono">
              {p.default || <span className="muted sans">{t("workflow.params.required")}</span>}
            </td>
            <td data-label={t("workflow.params.what")}>
              {p.title && <strong>{p.title}. </strong>}
              {p.description}
              {p.warn && <p className="warn tiny">{p.warn}</p>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DefinitionTab({ d }: { d: WorkflowDetail }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="wd-pad">
      <p className="muted small">{t("workflow.definition.note")}</p>
      {d.yaml ? (
        <>
          <button
            type="button"
            className="btn"
            onClick={() =>
              void navigator.clipboard?.writeText(d.yaml).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
            }
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <pre className="yaml" tabIndex={0}>
            <code>{d.yaml}</code>
          </pre>
        </>
      ) : (
        <p className="muted small">{t("workflow.definition.none")}</p>
      )}
    </div>
  );
}

function Tabs({ d }: { d: WorkflowDetail }) {
  const { t } = useT();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const current = ["params", "definition"].includes(hash.slice(1)) ? hash.slice(1) : "runs";
  return (
    <div className="wd-tabs">
      <TabBar
        label={t("workflow.tabs")}
        current={current}
        onSelect={(key) => void navigate({ search: location.search, hash: `#${key}` }, { replace: true })}
        tabs={[
          { key: "runs", label: t("workflow.tab.runs"), count: d.runs.length },
          { key: "params", label: t("workflow.tab.params"), count: d.params.length },
          { key: "definition", label: t("workflow.tab.definition") },
        ]}
      />
      <section id={`panel-${current}`} role="tabpanel" aria-labelledby={`tab-${current}`} className="wd-card">
        {current === "runs" ? <RunsTab d={d} /> : current === "params" ? <ParamsTab d={d} /> : <DefinitionTab d={d} />}
      </section>
    </div>
  );
}

// ---- the page ----

function Stats({ d }: { d: WorkflowDetail }) {
  const { t, n } = useT();
  const { number, since } = useFormat();
  const { ranDays, failedDays, meanMs, running, queued } = d.stats;
  const last30 = t("workflow.kpi.last_days", { days: number(30) });
  const next = !d.hasSchedule ? t("workflows.manual_only") : !d.active ? t("workflows.paused") : d.nextRun ? since(d.nextRun, new Date(d.now).getTime()) : "—";
  const cards: [string, string, string][] = [
    [
      t("workflow.kpi.clean"),
      ranDays > 0 ? `${number(Math.round(((ranDays - failedDays) / ranDays) * 1000) / 10)}%` : "—",
      ranDays > 0 ? n("workflow.kpi.of_days", ranDays, { n: number(ranDays - failedDays) }) : last30,
    ],
    [t("workflow.kpi.failed_days"), number(failedDays), last30],
    [t("workflow.kpi.mean"), meanMs > 0 ? fmtDuration(meanMs) : "—", last30],
    [
      t("workflow.kpi.open"),
      number(running + queued),
      running + queued > 0 ? t("workflow.kpi.open_note", { running: number(running), queued: number(queued) }) : t("workflow.kpi.nothing_running"),
    ],
    [t("workflow.kpi.next"), next, d.nextRun && d.active ? new Date(d.nextRun).toISOString().slice(0, 16).replace("T", " ") + " UTC" : ""],
  ];
  return (
    <div className="wd-stats">
      {cards.map(([label, value, note]) => (
        <div key={label} className="wd-stat">
          <span className="muted tiny">{label}</span>
          <b>{value}</b>
          <span className="muted tiny">{note || " "}</span>
        </div>
      ))}
    </div>
  );
}

function StepsCard({ d }: { d: WorkflowDetail }) {
  const { t, n } = useT();
  return (
    <Card
      title={t("graph.title")}
      aside={
        <span className="muted small">
          {n("workflows.steps", d.steps.length)} · {n("graph.stages", d.stages)}
          {/* The graph is the DAG island, still on the server's page. */}
          {d.steps.length > 1 && (
            <>
              {" · "}
              <a href={`/workflows/${encodeURIComponent(d.slug)}`}>Open the graph →</a>
            </>
          )}
        </span>
      }
    >
      <table className="dt">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>{t("graph.list.step")}</th>
            <th>{t("workflows.col.lang")}</th>
            <th>{t("graph.list.uses")}</th>
            <th>{t("graph.list.needs")}</th>
            <th>{t("graph.list.command")}</th>
            <th className="r">{t("graph.list.last")}</th>
          </tr>
        </thead>
        <tbody>
          {d.steps.map((s, i) => (
            <tr key={s.id}>
              <td className="num muted">{String(i + 1).padStart(2, "0")}</td>
              <td data-label={t("graph.list.step")} className="mono">
                {s.id}
              </td>
              <td data-label={t("workflows.col.lang")}>
                <span className="wf-lang">
                  <LogoList logos={s.langs} />
                  {s.langs[0] && <span className="small">{s.langs[0].name}</span>}
                </span>
              </td>
              <td data-label={t("graph.list.uses")}>
                <LogoList logos={s.uses} />
              </td>
              <td data-label={t("graph.list.needs")} className="mono muted">
                {s.needs.join(", ")}
              </td>
              <td data-label={t("graph.list.command")} className="mono muted cmd" title={s.command}>
                {s.command}
              </td>
              <td data-label={t("graph.list.last")} className="r muted">
                {s.lastStatus ? fmtDuration(s.lastMs) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Detail({ slug }: { slug: string }) {
  const { t, n } = useT();
  const [sp] = useSearchParams();
  const day = sp.get("day") ?? "";
  const { toggle, pending, error, note, dismiss } = useScheduleToggle();
  const { data: d, isPending, isError, error: err, refetch, isPlaceholderData } = useQuery({
    queryKey: ["workflow", slug, day],
    queryFn: ({ signal }) => getJSON<WorkflowDetail>(`/api/workflows/${encodeURIComponent(slug)}${day ? `?day=${encodeURIComponent(day)}` : ""}`, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 1,
  });
  if (isPending) return <WorkflowSkeleton />;
  if (isError || !d)
    return (
      <div className="wf-empty" role="alert">
        <p>{err instanceof ApiError && err.status === 404 ? `No workflow “${slug}”.` : (err?.message ?? "The workflow is unavailable.")}</p>
        <Link to="/workflows">{t("nav.workflows")}</Link> <button type="button" className="btn" onClick={() => void refetch()}>Retry</button>
      </div>
    );
  return (
    <div aria-busy={isPlaceholderData} className={isPlaceholderData ? "wf-stale" : undefined}>
      <div className="wd-head">
        <div>
          <small className="muted">Workflow</small>
          <h1 className="page-title mono">{d.slug}</h1>
        </div>
        <div className="wd-actions">
          {d.hasSchedule && (
            <button type="button" className="btn" disabled={pending === d.slug} onClick={() => toggle(d.slug)}>
              {t(d.active ? "workflow.pause" : "workflow.resume")}
            </button>
          )}
          {/* The run-now drawer and the parameter form are a later wave. */}
          <a className="btn" href={`/workflows/${encodeURIComponent(d.slug)}#run`}>
            {t("workflows.run_now.open")}
          </a>
        </div>
      </div>
      <div role="status" className="toast-line">
        {note && (
          <>
            {note.message}{" "}
            <button type="button" className="link" onClick={() => (toggle(note.slug), dismiss())}>
              {t("workflows.undo")}
            </button>
          </>
        )}
        {error && <span className="error">{error.message}</span>}
      </div>
      {d.description && <p className="muted small wd-desc">{d.description}</p>}
      <p className="wd-meta small muted">
        {d.hasSchedule && (
          <>
            <span className={d.active ? "on" : "off"}>{t(d.active ? "workflow.active" : "workflow.paused")}</span> ·{" "}
          </>
        )}
        {d.project && (
          <>
            <span>
              {t("workflows.chip.project")} <Link to={`/workflows?project=${encodeURIComponent(d.project)}`} className="mono">{d.project}</Link>
            </span>{" "}
            ·{" "}
          </>
        )}
        {d.cron === "" ? (
          t("workflows.manual_only")
        ) : (
          <>
            {d.schedule && <span>{d.schedule}{d.timezone && d.timezone !== "UTC" && d.timezone !== "Etc/UTC" ? ` (${d.timezone})` : ""} </span>}
            <span className="mono">{d.cron}</span>
          </>
        )}{" "}
        · {n("workflows.steps", d.steps.length)} · {n("workflow.dependencies", d.edges)}
        {d.langs.length > 0 && (
          <>
            {" · "}
            {d.langs.map((l) => (
              <span key={l.key} className="wd-lang">
                <LogoList logos={[l]} /> {l.name}
              </span>
            ))}
          </>
        )}
        {d.tags.map((tag) => (
          <Link key={tag} className="tag" to={`/workflows?tag=${encodeURIComponent(tag)}`}>
            {tag}
          </Link>
        ))}
      </p>
      <Stats d={d} />
      <StepsCard d={d} />
      <YearOfRuns d={d} />
      <Tabs d={d} />
    </div>
  );
}

export default function WorkflowRoute() {
  const { slug = "" } = useParams();
  return (
    <Suspense fallback={<WorkflowSkeleton />}>
      <Detail slug={slug} />
    </Suspense>
  );
}
