import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFormat, useT } from "../i18n";
import type { RunLog } from "../api/run";
import { buttonClass } from "./buttons";
import "./bar.css";
import { Icon } from "./icon";
import { Skeleton } from "./skeleton";

type Props = {
  /** Undefined while the run is on its way: the tools stay, the lines are a skeleton. */
  log: RunLog | undefined;
  /** True while the run moves: the view follows the tail until the reader scrolls up. */
  live: boolean;
  downloadHref: string;
  /** Bump to scroll to the failing line (clearing the search and level first). */
  gotoCause?: number;
};

const LEVELS = ["all", "warn", "err"] as const;
type Level = (typeof LEVELS)[number];

const tone = (level?: string) => (level === "warn" ? "text-warn" : level === "err" ? "bg-state-failed/10 text-state-failed" : "text-ink");

function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const out: ReactNode[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
    out.push(text.slice(at, i), <mark key={i}>{text.slice(i, i + q.length)}</mark>);
    at = i + q.length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

/** The lines' shape while they load: a heading and a few numbered lines. */
function LinesSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-2 px-3 py-3">
      {[60, 90, 75, 40, 85, 55].map((w, i) => (
        <Skeleton key={i} w={`${w}%`} h="0.8rem" />
      ))}
    </div>
  );
}

/**
 * The run's log (web/pages logsPanel): attempts under sticky headings, numbered
 * lines, search, a level filter, wrap and copy. While `live` it follows the
 * tail; scrolling up stops that (a button brings it back), as `tail -f` does.
 * The tools are static and always drawn; only the lines wait for data.
 */
export function LogView({ log, live, downloadHref, gotoCause = 0 }: Props) {
  const { t, n } = useT();
  const { number } = useFormat();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<Level>("all");
  const [wrap, setWrap] = useState(false);
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(true);
  const [flash, setFlash] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const needle = q.trim().toLowerCase();
  const filtering = needle !== "" || level !== "all";
  const blocks = useMemo(() => log?.blocks ?? [], [log]);

  // Followed only while the reader is at the bottom: a few pixels of slack.
  const onScroll = () => {
    const el = box.current;
    if (el) setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (live && following && el) el.scrollTop = el.scrollHeight;
  }, [log?.lines, live, following]);

  useEffect(() => {
    if (!gotoCause) return;
    setQ("");
    setLevel("all");
    setFollowing(false);
    setFlash(gotoCause);
    // After the unfiltered lines are back in the DOM.
    requestAnimationFrame(() => {
      const el = document.getElementById("log-cause");
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el?.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
    });
  }, [gotoCause]);

  const visible = useMemo(
    () => blocks.map((b) => b.items.filter((it) => it.gap || ((level === "all" || it.level === level) && (!needle || (it.text ?? "").toLowerCase().includes(needle))))),
    [blocks, level, needle],
  );

  const copy = () => {
    const text = blocks.flatMap((_, i) => (visible[i] ?? []).filter((it) => !it.gap).map((it) => it.text ?? "")).join("\n");
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const small = buttonClass("secondary", "small");
  const toggle = "inline-flex shrink-0 items-center rounded-card px-2.5 py-1 text-[12.5px] whitespace-nowrap text-muted hover:text-ink aria-pressed:bg-surface-2 aria-pressed:text-ink";

  return (
    <div data-log data-wrap={wrap ? "" : undefined} className="overflow-hidden rounded-card border border-line bg-surface">
      <div className="bar-row flex flex-nowrap items-center gap-2 overflow-x-auto border-b border-line-soft px-3 py-2">
        <label className="relative min-w-[12rem] flex-1 shrink-0">
          <span className="sr-only">{t("run.log.search")}</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("run.log.search")}
            autoComplete="off"
            className="h-8 w-full rounded-card border border-line bg-canvas pr-2 pl-8 text-[13px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
        </label>
        <div role="group" aria-label={t("run.log.level")} className="inline-flex shrink-0 rounded-card border border-line p-0.5">
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)} className="rounded-[5px] px-2.5 py-1 text-[12.5px] text-muted hover:text-ink aria-pressed:bg-surface-2 aria-pressed:text-ink">
              {t(`run.log.level.${l}`)}
            </button>
          ))}
        </div>
        <span className="ml-auto shrink-0" />
        <button type="button" aria-pressed={wrap} onClick={() => setWrap(!wrap)} className={toggle}>
          {t("run.log.wrap")}
        </button>
        <button type="button" onClick={copy} className={small}>
          <Icon name={copied ? "check" : "copy"} className="h-3 w-3" />
          <span>{copied ? t("copy.done") : t("run.log.copy")}</span>
        </button>
        <a href={downloadHref} download className={small}>
          <Icon name="download" className="h-3 w-3" />
          {t("run.download_log")}
        </a>
      </div>
      {!log ? (
        <LinesSkeleton />
      ) : blocks.length === 0 ? (
        <p className="px-3.5 py-3 text-[12.5px] text-muted">{t("run.log.empty")}</p>
      ) : (
        <>
          {/* role=log is a polite live region: only the lines that are added are read. */}
          <div
            ref={box}
            role="log"
            aria-live={live ? "polite" : "off"}
            aria-relevant="additions"
            aria-label={t("run.tab.logs")}
            tabIndex={0}
            onScroll={onScroll}
            className="max-h-[70vh] overflow-auto pb-1 font-mono text-[12px] leading-[1.65]"
          >
            {blocks.map((b, bi) => (
              <Fragment key={`${b.step}#${b.attempt}`}>
                <div className="sticky top-0 border-b border-line-soft bg-surface-2 px-3 py-1 text-[11.5px] text-muted">
                  {b.step} · {t("run.log.attempt", { n: b.attempt })}
                  {b.status && <> · {b.statusLabel}</>}
                  {b.exitCode !== null && <> · exit {b.exitCode}</>}
                </div>
                {b.running && <div className="px-3 py-1 font-sans text-faint">{t("run.log.running", { step: b.step })}</div>}
                {(visible[bi] ?? []).map((it, i) =>
                  it.gap ? (
                    !filtering && (
                      <div key={`gap${i}`} className="px-3 py-1 font-sans text-[11.5px] text-faint italic">
                        {n("run.log.gap", it.gap)}
                      </div>
                    )
                  ) : (
                    <div
                      key={it.n}
                      id={it.cause ? "log-cause" : undefined}
                      data-level={it.level}
                      data-flash={it.cause && flash ? "" : undefined}
                      className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 px-3 ${tone(it.level)}`}
                    >
                      <span aria-hidden="true" className="text-right text-faint tabular-nums select-none">
                        {it.n}
                      </span>
                      <span data-text className="whitespace-pre">
                        <Marked text={it.text ?? ""} q={needle} />
                      </span>
                    </div>
                  ),
                )}
              </Fragment>
            ))}
          </div>
          {live && !following && (
            <div className="flex justify-center border-t border-line-soft p-1.5">
              <button
                type="button"
                className={small}
                onClick={() => {
                  setFollowing(true);
                  const el = box.current;
                  if (el) el.scrollTop = el.scrollHeight;
                }}
              >
                {t("run.live.following")} · {number(log?.lines ?? 0)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
