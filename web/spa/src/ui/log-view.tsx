import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFormat, useT } from "../i18n";
import type { RunLog } from "../api/run";
import "./log-view.css";

type Props = {
  log: RunLog;
  /** True while the run moves: the view follows the tail until the reader scrolls up. */
  live: boolean;
  downloadHref: string;
  /** Bump to scroll to the failing line (clearing the search and level first). */
  gotoCause?: number;
};

const LEVELS = ["all", "warn", "err"] as const;
type Level = (typeof LEVELS)[number];

function Marked({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let at = 0;
  for (let i = lower.indexOf(q); i >= 0; i = lower.indexOf(q, at)) {
    out.push(text.slice(at, i), <mark key={i}>{text.slice(i, i + q.length)}</mark>);
    at = i + q.length;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

/**
 * The run's log: attempts under sticky headings, numbered lines, search, a
 * level filter, wrap and copy. While `live` it follows the tail; scrolling up
 * stops that (a button brings it back), as `tail -f` in a terminal does.
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

  // Followed only while the reader is at the bottom: a few pixels of slack.
  const onScroll = () => {
    const el = box.current;
    if (el) setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
  };
  useLayoutEffect(() => {
    const el = box.current;
    if (live && following && el) el.scrollTop = el.scrollHeight;
  }, [log.lines, live, following]);

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
    () =>
      log.blocks.map((b) =>
        b.items.filter((it) => it.gap || ((level === "all" || it.level === level) && (!needle || (it.text ?? "").toLowerCase().includes(needle)))),
      ),
    [log.blocks, level, needle],
  );

  const copy = () => {
    const text = log.blocks.flatMap((_, i) => (visible[i] ?? []).filter((it) => !it.gap).map((it) => it.text ?? "")).join("\n");
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const levelLabel = (l: Level) => t(`run.log.level.${l}`);

  return (
    <div className={`log${wrap ? " log-wrap" : ""}`}>
      <div className="log-tools">
        <input
          type="search"
          className="log-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("run.log.search")}
          aria-label={t("run.log.search")}
          autoComplete="off"
        />
        <div className="seg" role="group" aria-label={t("run.log.level")}>
          {LEVELS.map((l) => (
            <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}>
              {levelLabel(l)}
            </button>
          ))}
        </div>
        <button type="button" className="btn" aria-pressed={wrap} onClick={() => setWrap(!wrap)} style={{ marginLeft: "auto" }}>
          {t("run.log.wrap")}
        </button>
        <button type="button" className="btn outline" onClick={copy}>
          {copied ? t("copy.done") : t("run.log.copy")}
        </button>
        <a className="btn outline" href={downloadHref} download>
          {t("run.download_log")}
        </a>
      </div>
      {log.blocks.length === 0 ? (
        <p className="log-empty">{t("run.log.empty")}</p>
      ) : (
        <>
          {/* role=log is a polite live region: only the lines that are added are read. */}
          <div
            ref={box}
            className="log-lines"
            role="log"
            aria-live={live ? "polite" : "off"}
            aria-relevant="additions"
            aria-label={t("run.tab.logs")}
            tabIndex={0}
            onScroll={onScroll}
          >
            {log.blocks.map((b, bi) => (
              <Fragment key={`${b.step}#${b.attempt}`}>
                <div className="log-step">
                  {b.step} · {t("run.log.attempt", { n: b.attempt })}
                  {b.status && <> · {b.statusLabel}</>}
                  {b.exitCode !== null && <> · exit {b.exitCode}</>}
                </div>
                {b.running && <div className="log-note">{t("run.log.running", { step: b.step })}</div>}
                {(visible[bi] ?? []).map((it, i) =>
                  it.gap ? (
                    !filtering && (
                      <div key={`gap${i}`} className="log-note">
                        {n("run.log.gap", it.gap)}
                      </div>
                    )
                  ) : (
                    <div
                      key={it.n}
                      id={it.cause ? "log-cause" : undefined}
                      className={`log-line ${it.level ?? ""}${it.cause ? " cause" : ""}${it.cause && flash ? " flash" : ""}`}
                    >
                      <span className="log-n" aria-hidden="true">
                        {it.n}
                      </span>
                      <span>
                        <Marked text={it.text ?? ""} q={needle} />
                      </span>
                    </div>
                  ),
                )}
              </Fragment>
            ))}
          </div>
          {live && !following && (
            <div className="log-follow">
              <button
                type="button"
                className="btn outline"
                onClick={() => {
                  setFollowing(true);
                  const el = box.current;
                  if (el) el.scrollTop = el.scrollHeight;
                }}
              >
                {t("run.live.following")} · {number(log.lines)}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
