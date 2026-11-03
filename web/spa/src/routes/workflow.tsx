import { Suspense, lazy, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ApiError, getJSON } from "../api/client";
import { useScheduleToggle, type WorkflowDetail } from "../api/workflows";
import { useFormat, useT } from "../i18n";
import { buttonClass } from "../ui/button";
import { linkClass } from "../ui/card";
import { until, useAgo, useBrief, useNumbers } from "../ui/format";
import { Icon } from "../ui/icon";
import { Logo } from "../ui/logo";
import { PageFrame } from "../ui/page-frame";
import { LoadError } from "../ui/query-boundary";
import { Skeleton } from "../ui/skeleton";
import { Stats, type StatProps } from "../ui/stat";
import { Status, runKind } from "../ui/status";
import { TabBar } from "../ui/tab-bar";
import { useCrumb } from "../shell/nav";
import { YearOfRuns } from "./workflow-calendar";

// The graph's chunk (React Flow) loads only when the graph is drawn.
const Dag = lazy(() => import("../ui/dag/dag"));

const th = (extra = "") => `px-2.5 text-[11.5px] font-medium whitespace-nowrap text-faint ${extra}`;
const cell = "px-2.5 py-2.5";
const card = "rounded-card border border-line bg-surface shadow-warm-sm";

// A line of text in the place a data-bound line will take.
const Line = ({ w, h = "14px" }: { w: string; h?: string }) => <Skeleton w={w} h={h} />;
const Rows = ({ cols, rows = 4 }: { cols: string[]; rows?: number }) => (
  <>
    {Array.from({ length: rows }, (_, i) => (
      <tr key={i} aria-hidden="true">
        {cols.map((w, j) => (
          <td key={j} className={`${cell} ${j === 0 ? "pl-4" : ""} ${j === cols.length - 1 ? "pr-4" : ""}`}><Line w={w} h="13px" /></td>
        ))}
      </tr>
    ))}
  </>
);

// ---- the line under the title: whether the schedule runs, project, cron, size, tags ----

function Meta({ d }: { d?: WorkflowDetail }) {
  const { t, n } = useT();
  if (!d) return <p className="mb-3 flex h-[18px] items-center"><Line w="28rem" h="13px" /></p>;
  const zone = d.timezone && d.timezone !== "UTC" && d.timezone !== "Etc/UTC" ? ` (${d.timezone})` : "";
  return (
    <p data-workflow-meta className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
      {d.hasSchedule && (
        <>
          {d.active ? (
            <span className="inline-flex items-center gap-1.5 text-state-success"><span className="h-[7px] w-[7px] rounded-full bg-state-success" />{t("workflow.active")}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted"><span className="h-[7px] w-[7px] rounded-full bg-state-pending" />{t("workflow.paused")}</span>
          )}
          <span className="text-faint">·</span>
        </>
      )}
      {d.project && (
        <>
          <span>{t("workflows.chip.project")} <Link to={`/workflows?project=${encodeURIComponent(d.project)}`} className="font-mono text-ink-2 hover:underline">{d.project}</Link></span>
          <span className="text-faint">·</span>
        </>
      )}
      {d.cron === "" ? (
        <span>{t("workflows.manual_only")}</span>
      ) : (
        <>
          {d.schedule && <span className="text-ink">{d.schedule}{zone}</span>}
          <span className="font-mono text-[12px] text-faint">{d.cron}</span>
        </>
      )}
      <span className="text-faint">·</span>
      <span>{n("workflows.steps", d.steps.length)} · {n("workflow.dependencies", d.edges)}</span>
      {d.langs.length > 0 && (
        <>
          <span className="text-faint">·</span>
          {d.langs.map((l) => (
            <span key={l.key} className="inline-flex items-center gap-1 text-ink-2"><Logo k={l.key} />{l.name}</span>
          ))}
        </>
      )}
      {d.tags.map((tag) => (
        <Link key={tag} to={`/workflows?tag=${encodeURIComponent(tag)}`} className="inline-flex rounded-card border border-line bg-parchment px-2 py-0.5 text-[0.7rem] text-muted transition-colors hover:border-line-strong hover:text-ink">{tag}</Link>
      ))}
    </p>
  );
}

// ---- the five numbers: days without failure, days with, mean, in progress, next run ----

function WorkflowStats({ d }: { d?: WorkflowDetail }) {
  const { t, n } = useT();
  const { number } = useFormat();
  const { percent, elapsed } = useNumbers();
  const brief = useBrief();
  const last30 = t("workflow.kpi.last_days", { days: number(30) });
  const labels = {
    clean: { label: t("workflow.kpi.clean"), dot: "var(--st-success)" },
    failed: { label: t("workflow.kpi.failed_days"), dot: "var(--st-failed)" },
    mean: { label: t("workflow.kpi.mean") },
    open: { label: t("workflow.kpi.open") },
    next: { label: t("workflow.kpi.next") },
  };
  if (!d) return <Stats items={Object.values(labels).map((l) => ({ ...l, loading: true }))} />;
  const { ranDays, failedDays, meanMs, running, queued } = d.stats;
  const clean: StatProps = { ...labels.clean, value: "—", note: last30 };
  if (ranDays > 0) {
    clean.value = percent(ranDays - failedDays, ranDays);
    clean.note = n("workflow.kpi.of_days", ranDays, { n: number(ranDays - failedDays) });
    clean.bar = (ranDays - failedDays) / ranDays;
  }
  const open: StatProps = { ...labels.open, value: number(running + queued), note: running + queued > 0 ? t("workflow.kpi.open_note", { running: number(running), queued: number(queued) }) : t("workflow.kpi.nothing_running") };
  const next: StatProps = { ...labels.next, value: "—" };
  if (!d.hasSchedule) next.value = t("workflows.manual_only");
  else if (!d.active) next.value = t("workflows.paused");
  else if (d.nextRun) {
    next.value = t("time.in", { span: until(new Date(d.nextRun).getTime() - new Date(d.now).getTime()) });
    next.note = `${brief(d.nextRun)} UTC`;
  }
  return (
    <Stats
      items={[
        clean,
        { ...labels.failed, value: number(failedDays), note: last30 },
        { ...labels.mean, value: meanMs > 0 ? elapsed(meanMs) : "—", note: last30 },
        open,
        next,
      ]}
    />
  );
}

// ---- the steps: the graph, or the list ----

function StepsList({ d }: { d?: WorkflowDetail }) {
  const { t } = useT();
  const { elapsed } = useNumbers();
  return (
    <div className="overflow-x-auto">
      <table className="ct w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-parchment-soft/60 text-left">
            <th className={th("w-10 pl-4")}>#</th>
            <th className={th()}>{t("graph.list.step")}</th>
            <th className={th()}>{t("workflows.col.lang")}</th>
            <th className={th()}>{t("graph.list.uses")}</th>
            <th className={th()}>{t("graph.list.needs")}</th>
            <th className={th()}>{t("graph.list.command")}</th>
            <th className={th("pr-4 text-right")}>{t("graph.list.last")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {!d ? (
            <Rows cols={["1.2rem", "6rem", "5rem", "3rem", "5rem", "14rem", "3rem"]} />
          ) : (
            d.steps.map((s, i) => (
              <tr key={s.id} className="align-top transition-colors hover:bg-hover">
                <td className={`${cell} pl-4 text-xs text-faint tabular-nums`}>{String(i + 1).padStart(2, "0")}</td>
                <td className={`${cell} font-mono text-[12.5px] text-ink`}>{s.id}</td>
                <td className={cell}>
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                    {s.langs.map((l) => <Logo key={l.key} k={l.key} />)}
                    {s.langs[0]?.name}
                  </span>
                </td>
                <td className={cell}><span className="inline-flex items-center gap-1">{s.uses.map((l) => <Logo key={l.key} k={l.key} />)}</span></td>
                <td className={`${cell} font-mono text-xs text-muted`}>{s.needs.join(", ")}</td>
                <td className={`${cell} max-w-[22rem] truncate font-mono text-xs text-muted`} title={s.command}>{s.command}</td>
                <td className={`${cell} pr-4 text-right text-xs text-muted tabular-nums`}>{s.lastStatus ? elapsed(s.lastMs) : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function StepsCard({ d, slug }: { d?: WorkflowDetail; slug: string }) {
  const { t, n } = useT();
  const [view, setView] = useState<"graph" | "list">("graph");
  const [picked, setPicked] = useState<string | null>(null);
  const btn = (v: "graph" | "list", label: string) => (
    <button type="button" aria-pressed={view === v} onClick={() => setView(v)} className="steps-view-btn">
      {label}
    </button>
  );
  // A one-step workflow has nothing to draw: its list is its line.
  const oneStep = !!d && d.steps.length < 2;
  const shown = oneStep ? "list" : view;
  return (
    <section className={card}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">
          {t("graph.title")}{" "}
          <span className="ml-1 font-normal text-faint tabular-nums">
            {d ? <>{n("workflows.steps", d.steps.length)} · {n("graph.stages", d.stages)}</> : <Skeleton w="8rem" h="12px" className="inline-block" />}
          </span>
        </h2>
        <p className="text-[12.5px] text-muted max-[860px]:hidden">{t("graph.hint")}</p>
        {!oneStep && (
          <div role="group" aria-label={t("graph.view")} className="ml-auto inline-flex h-8 items-center gap-0.5 rounded-card border border-line bg-surface p-0.5">
            {btn("graph", t("graph.view.graph"))}
            {btn("list", t("graph.view.list"))}
          </div>
        )}
      </header>
      {shown === "graph" ? (
        <div className="p-3">
          <Suspense fallback={<Skeleton h="22rem" />}>
            <Dag src={`/api/workflows/${encodeURIComponent(slug)}/graph`} onPick={setPicked} />
          </Suspense>
        </div>
      ) : (
        <StepsList d={d} />
      )}
      {shown === "graph" && (
        <div className="border-t border-line-soft px-4 py-3 text-[12.5px] text-muted">
          {picked ? <span className="font-mono text-ink">{picked}</span> : t("graph.panel.none")}
        </div>
      )}
    </section>
  );
}

// ---- the tabs ----

function RunsTab({ d }: { d?: WorkflowDetail }) {
  const { t } = useT();
  const ago = useAgo();
  const brief = useBrief();
  const { elapsed } = useNumbers();
  const { date } = useFormat();
  const slug = useParams().slug ?? "";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[12.5px] text-muted">
        {d?.day ? (
          <span data-day-filter className="inline-flex items-center gap-1.5 rounded-card border border-line-strong bg-surface-2 px-2.5 py-0.5 text-ink">
            {date(d.day)}
            <Link to="#runs" aria-label={t("workflow.runs.clear_day")} className="text-muted hover:text-ink">×</Link>
          </span>
        ) : (
          <span>{t("workflow.runs.lead")}</span>
        )}
        <Link to={`/runs?workflow=${encodeURIComponent(slug)}`} className="text-ink hover:underline">{t("workflow.runs.all")} →</Link>
      </div>
      {d && d.runs.length === 0 ? (
        <p className="border-t border-line-soft px-4 py-6 text-center text-[12.5px] text-muted">{t("workflow.runs.none")}</p>
      ) : (
        <div className="overflow-x-auto border-t border-line-soft">
          <table className="ct w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-parchment-soft/60 text-left">
                <th className={th("pl-4")}>{t("runs.col.state")}</th>
                <th className={th()}>{t("runs.col.trigger")}</th>
                <th className={th()}>{t("runs.col.slot")}</th>
                <th className={th()}>{t("workflow.runs.params")}</th>
                <th className={th()}>{t("runs.col.duration")}</th>
                <th className={th("pr-4 text-right")}>{t("workflow.runs.when")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {!d ? (
                <Rows cols={["4.5rem", "4rem", "5rem", "5rem", "3rem", "4rem"]} />
              ) : (
                d.runs.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-hover">
                    <td className={`${cell} pl-4`}>
                      <Link to={`/runs/${r.id}`} className="hover:underline"><Status kind={runKind(r.status)} /></Link>
                    </td>
                    <td className={`${cell} text-xs text-muted`}>{r.slot ? t("workflow.runs.manual_slot") : t(`trigger.${r.trigger}`)}</td>
                    <td className={`${cell} font-mono text-xs text-ink-2 tabular-nums`}>{r.logicalDate ? <span className="whitespace-nowrap">{brief(r.logicalDate)}</span> : <span className="text-faint">—</span>}</td>
                    <td className={`${cell} font-mono text-xs text-ink-2`}>{r.given.length > 0 ? r.given.join(" ") : <span className="font-sans text-muted">{t("workflow.runs.default")}</span>}</td>
                    <td className={`${cell} text-xs text-muted tabular-nums`}>{r.durationMs === null ? "—" : elapsed(r.durationMs)}</td>
                    <td className={`${cell} pr-4 text-right text-xs text-muted`}>{ago(r.createdAt, new Date(d.now).getTime())}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ParamsTab({ d }: { d?: WorkflowDetail }) {
  const { t } = useT();
  if (d && d.params.length === 0)
    return <p className="px-4 py-6 text-center text-[12.5px] text-muted">{t("workflow.params.none")} <code className="font-mono text-ink-2">$BREVIS_AUTO_*</code>.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="ct w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-parchment-soft/60 text-left">
            <th className={th("pl-4")}>{t("workflow.params.name")}</th>
            <th className={th()}>{t("workflow.params.type")}</th>
            <th className={th()}>{t("workflow.params.default")}</th>
            <th className={th("pr-4")}>{t("workflow.params.what")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {!d ? (
            <Rows cols={["7rem", "4rem", "5rem", "16rem"]} rows={3} />
          ) : (
            d.params.map((p) => (
              <tr key={p.name}>
                <td className={`${cell} pl-4 align-top`}>
                  <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px] text-ink">{p.name}{p.uses && <Logo k={p.uses} />}</span>
                  {p.group && <p className="mt-0.5 text-[11.5px] text-faint">{p.group}</p>}
                </td>
                <td className={`${cell} align-top font-mono text-xs text-muted`}>{p.type}</td>
                <td className={`${cell} align-top font-mono text-xs text-ink-2`}>{p.default || <span className="font-sans text-muted">{t("workflow.params.required")}</span>}</td>
                <td className={`${cell} pr-4 align-top text-[12.5px] text-ink-2`}>
                  {p.title && <strong className="font-medium text-ink">{p.title}. </strong>}
                  {p.description}
                  {p.warn && <p className="mt-0.5 text-[11.5px] text-warn">{p.warn}</p>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function DefinitionTab({ d }: { d?: WorkflowDetail }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <p className="px-4 py-2.5 text-[12.5px] text-muted">{t("workflow.definition.note")}</p>
      <div className="px-4 pb-4">
        {!d ? (
          <Skeleton h="12rem" />
        ) : d.yaml ? (
          <div className="relative">
            <pre tabIndex={0} className="overflow-x-auto rounded-card border border-line bg-canvas-subtle p-3 pr-11 font-mono text-[0.75rem] leading-relaxed text-ink"><code>{d.yaml}</code></pre>
            <span className="absolute top-1.5 right-1.5">
              <button
                type="button"
                aria-label={t("copy.label")}
                title={t("copy.label")}
                onClick={() => void navigator.clipboard?.writeText(d.yaml).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-card text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
              >
                <Icon name={copied ? "check" : "copy"} className="h-4 w-4" />
              </button>
            </span>
          </div>
        ) : (
          <p className="text-[12.5px] text-muted">{t("workflow.definition.none")}</p>
        )}
      </div>
    </>
  );
}

function Tabs({ d }: { d?: WorkflowDetail }) {
  const { t } = useT();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const current = ["params", "definition"].includes(hash.slice(1)) ? hash.slice(1) : "runs";
  const count = (n?: number) => (d ? n : <Skeleton w="1.2ch" h="10px" className="inline-block" />);
  return (
    <div className="mt-3">
      <div className="mb-3">
        <TabBar
          label={t("workflow.tabs")}
          current={current}
          onSelect={(key) => void navigate({ search: location.search, hash: `#${key}` }, { replace: true })}
          tabs={[
            { key: "runs", label: t("workflow.tab.runs"), count: count(d?.runs.length) },
            { key: "params", label: t("workflow.tab.params"), count: count(d?.params.length) },
            { key: "definition", label: t("workflow.tab.definition") },
          ]}
        />
      </div>
      <section id={`panel-${current}`} role="tabpanel" aria-labelledby={`tab-${current}`} className={card}>
        {current === "runs" ? <RunsTab d={d} /> : current === "params" ? <ParamsTab d={d} /> : <DefinitionTab d={d} />}
      </section>
    </div>
  );
}

// ---- the page's own header: the question mark, Pause or Resume, and Run ----

function About({ slug, text }: { slug: string; text: string }) {
  const { t } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button
        type="button"
        title="What this workflow is for"
        aria-label="What this workflow is for"
        onClick={() => dialog.current?.showModal()}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[0.7rem] font-semibold text-muted transition-colors hover:border-line-strong hover:text-ink focus-visible:text-ink"
      >
        ?
      </button>
      <dialog ref={dialog} className="w-[min(680px,92vw)] rounded-card border border-line bg-surface p-0 text-ink shadow-warm backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11.5px] text-muted">What this is for</p>
            <p className="display mt-1 truncate text-2xl">{slug}</p>
          </div>
          <form method="dialog">
            <button autoFocus aria-label={t("dialog.close")} className="rounded-card border border-line px-3 py-1 text-xs text-muted transition-colors hover:border-line-strong hover:text-ink">{t("dialog.close_word")}</button>
          </form>
        </div>
        <p className="px-6 py-5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-2">{text}</p>
      </dialog>
    </>
  );
}

function Actions({ slug, d, toggler }: { slug: string; d?: WorkflowDetail; toggler: ReturnType<typeof useScheduleToggle> }) {
  const { t } = useT();
  const href = `/workflows/${encodeURIComponent(slug)}`;
  return (
    <div className="flex items-center gap-2">
      {!d ? (
        <Skeleton w="5rem" h="2rem" />
      ) : (
        d.hasSchedule && (
          <button type="button" className={buttonClass("secondary", "regular")} disabled={toggler.pending === slug} onClick={() => toggler.toggle(slug)}>
            {t(d.active ? "workflow.pause" : "workflow.resume")}
          </button>
        )
      )}
      {/* The run-now dialog and the parameter drawer are still the server's. */}
      <a href={`${href}#run`} className={buttonClass("primary", "regular")}>
        <Icon name="play" className="h-3.5 w-3.5" />
        {t("workflows.run_now.open")}
      </a>
    </div>
  );
}

export default function WorkflowRoute() {
  const { t } = useT();
  const { slug = "" } = useParams();
  useCrumb(slug);
  const [sp] = useSearchParams();
  const day = sp.get("day") ?? "";
  const toggler = useScheduleToggle();
  const q = useQuery({
    queryKey: ["workflow", slug, day],
    queryFn: ({ signal }) => getJSON<WorkflowDetail>(`/api/workflows/${encodeURIComponent(slug)}${day ? `?day=${encodeURIComponent(day)}` : ""}`, signal),
    placeholderData: keepPreviousData,
    refetchInterval: 5_000,
    retry: (count, e) => !(e instanceof ApiError && e.status === 404) && count < 1,
  });
  const d = q.data;
  const { note, error, dismiss, toggle } = toggler;
  const missing = q.error instanceof ApiError && q.error.status === 404;
  let body: ReactNode;
  if (q.isError && !d) {
    body = missing ? (
      <p className="rounded-card border border-dashed border-line px-6 py-12 text-center text-sm text-muted">
        {`No workflow “${slug}”.`} <Link to="/workflows" className={linkClass}>{t("nav.workflows")}</Link>
      </p>
    ) : (
      <LoadError onRetry={() => void q.refetch()} />
    );
  } else {
    body = (
      <div aria-busy={q.isPlaceholderData || !d} className={q.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
        <Meta d={d} />
        <div role="status">
          {note && (
            <p className="mb-2 text-[12.5px] text-muted">
              {note.message}{" "}
              <button type="button" className={linkClass} onClick={() => (toggle(note.slug), dismiss())}>{t("workflows.undo")}</button>
            </p>
          )}
          {error && <p className="mb-2 text-[12.5px] text-state-failed">{error.message}</p>}
        </div>
        <div className="mb-3">
          <WorkflowStats d={d} />
        </div>
        <StepsCard d={d} slug={slug} />
        <div className="mt-3">
          <YearOfRuns d={d} />
        </div>
        <Tabs d={d} />
      </div>
    );
  }
  return (
    <PageFrame title={slug} mono actions={<Actions slug={slug} d={d} toggler={toggler} />} aside={d?.description ? <About slug={slug} text={d.description} /> : undefined}>
      {body}
    </PageFrame>
  );
}
