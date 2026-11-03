import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useT } from "../i18n";
import { Freshness, StatusMark } from "../ui/freshness";
import { Skeleton } from "../ui/skeleton";
import type { CatalogRow } from "./catalog";
import { Configurations, type WriterConfig } from "./target-config";
import "../ui/code-block.css";

type Writer = {
  name: string;
  gateway: { name: string; stream: string } | null;
  workflow: string;
  node: string;
  status: string;
  cron: string;
  runInFlight: string | null;
  reason: string;
  href: string;
};
export type TargetDetail = {
  row: CatalogRow;
  writers: Writer[];
  bars: { href: string; rows: number | null; title: string }[];
  missed: number;
  readBy: { api: string; name: string; path: string }[];
  configs: WriterConfig[];
  sql: boolean;
};

/**
 * A destination's loads, oldest first, each bar a link to its run, then the
 * slots that went by without a load as dashed bars. A load that did not say
 * its rows is hollow at full height, never a zero; one that wrote zero is a
 * red sliver.
 */
function LoadBars({ bars, missed }: { bars: TargetDetail["bars"]; missed: number }) {
  const { t } = useT();
  const n = bars.length + missed;
  if (n === 0) return <p className="muted">{t("bars.none")}</p>;
  const H = 96, gap = 3;
  const width = Math.max(200, n * 14 + (n - 1) * gap);
  const bw = (width - gap * (n - 1)) / n;
  const top = Math.max(0, ...bars.map((b) => b.rows ?? 0));
  return (
    <svg className="dc-loads" viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("bars.label")} style={{ maxWidth: `${(width * 25) / 17}px` }}>
      {bars.map((b, i) => {
        const x = i * (bw + gap);
        let shape;
        if (b.rows === null) {
          shape = <rect x={x} y={1} width={bw} height={H - 2} fill="none" stroke="var(--muted)" strokeWidth={1} />;
        } else {
          const h = top > 0 ? Math.max(2, (b.rows / top) * (H - 2)) : 2;
          shape = <rect x={x} y={H - h} width={bw} height={h} fill={b.rows === 0 ? "var(--st-bad)" : "var(--accent-bar)"} />;
        }
        return (
          <a key={i} href={b.href}>
            <title>{b.title}</title>
            {shape}
          </a>
        );
      })}
      {Array.from({ length: missed }, (_, i) => (
        <rect key={`m${i}`} x={(bars.length + i) * (bw + gap)} y={1} width={bw} height={H - 2} fill="none" stroke="var(--st-bad)" strokeWidth={1} strokeDasharray="3 2" />
      ))}
    </svg>
  );
}

function DrawerSkeleton() {
  return (
    <div className="dc-drawer-body" aria-busy="true">
      <Skeleton h="5rem" />
      <Skeleton h="5rem" />
      <Skeleton h="3rem" />
      <Skeleton h="8rem" />
    </div>
  );
}

function Body({ d }: { d: TargetDetail }) {
  const { t } = useT();
  return (
    <div className="dc-drawer-body">
      {d.writers.map((w) => (
        <section key={w.name} className="dc-writer-card">
          <div className="dc-writer-head">
            <StatusMark kind={w.status} />
            <a href={w.href}>{w.name}</a>
            {w.cron && <span className="muted">{w.cron}</span>}
            {w.runInFlight && (
              <a className="dc-run" href={`/runs/${w.runInFlight}`}>
                {t("catalog.drawer.queued")} →
              </a>
            )}
          </div>
          {w.reason && <p className="dc-why">{w.reason}</p>}
        </section>
      ))}
      <section>
        <h3 className="dc-h3">{t("catalog.drawer.loads")}</h3>
        <LoadBars bars={d.bars} missed={d.missed} />
        <p className="muted dc-legend">{t("catalog.drawer.legend")}</p>
      </section>
      {d.readBy.length > 0 && (
        <section>
          <h3 className="dc-h3">{t("catalog.drawer.read_by")}</h3>
          <ul className="dc-readby">
            {d.readBy.map((e) => (
              <li key={e.api + e.name}>
                <Link to={`/data/endpoints/${encodeURIComponent(e.api)}/${encodeURIComponent(e.name)}`}>GET {e.path}</Link>{" "}
                <span className="muted">
                  {e.api} · {t("catalog.drawer.cache")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Configurations configs={d.configs} />
      <p className="muted dc-fine">{t("catalog.drawer.credentials")}</p>
    </div>
  );
}

/**
 * One destination, over the catalog. A native <dialog> opened modally: it
 * traps focus, closes on Escape and gives focus back to the row that opened it.
 */
export default function TargetDrawer({ u, query, closeTo }: { u: string; query: UseQueryResult<TargetDetail>; closeTo: string }) {
  const { t } = useT();
  const navigate = useNavigate();
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);

  const d = query.data;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(u);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no clipboard: the destination above is selectable */
    }
  };
  return (
    <dialog
      ref={ref}
      className="dc-drawer"
      aria-labelledby="target-title"
      onCancel={(e) => {
        e.preventDefault();
        navigate(closeTo);
      }}
      onClick={(e) => {
        if (e.target === ref.current) navigate(closeTo);
      }}
    >
      <div className="dc-drawer-in">
        <header className="dc-drawer-head">
          <div style={{ minWidth: 0 }}>
            <p className="dc-kicker">{d ? t("catalog.drawer.kicker", { kind: d.row.kind || "file" }) : <Skeleton w="8rem" h=".7rem" />}</p>
            <h2 id="target-title" className="dc-uri">
              {u}
            </h2>
            {d ? (
              <p className="muted" style={{ margin: 0, fontSize: ".75rem", display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
                <Freshness status={d.row.status} />
                <span>{t("catalog.drawer.best")}</span>
              </p>
            ) : (
              <Skeleton w="6rem" h="1rem" />
            )}
          </div>
          <Link to={closeTo} className="dc-close" aria-label={t("dialog.close")}>
            ×
          </Link>
        </header>
        {query.isError ? (
          <div className="dc-drawer-body">
            <p role="alert">{(query.error as Error).message}</p>
          </div>
        ) : d ? (
          <Body d={d} />
        ) : (
          <DrawerSkeleton />
        )}
        <footer className="dc-drawer-foot">
          {d?.sql && (
            <a className="btn" href={`/sql?target=${encodeURIComponent(u)}`}>
              {t("catalog.drawer.query")}
            </a>
          )}
          <button type="button" className="btn btn-primary" onClick={copy} aria-live="polite">
            {copied ? "✓" : t("catalog.drawer.copy")}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

