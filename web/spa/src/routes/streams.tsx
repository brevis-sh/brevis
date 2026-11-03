import { Suspense, useDeferredValue } from "react";
import { Link, useSearchParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import type { StreamRow, Streams } from "../api/ingest";
import { useT } from "../i18n";
import { QueryBoundary } from "../ui/boundary";
import { LIVE } from "../ui/live";
import { Place } from "../ui/place";
import { Skeleton } from "../ui/skeleton";
import { StatusBadge } from "../ui/status";
import { Rt, Td, Th } from "../ui/table";
import "../ui/list.css";
import "./streams.css";

function withParam(params: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(params);
  if (value === "") next.delete(key);
  else next.set(key, value);
  const s = next.toString();
  return s === "" ? "" : `?${s}`;
}

function Row({ s }: { s: StreamRow }) {
  const { t } = useT();
  return (
    <tr role="row">
      <Td head>
        <Link to={s.href} className="row-link mono st-path">
          <span className="st-method">POST</span>
          <strong>{s.path}</strong>
        </Link>
        {s.note !== "" && (
          <p className="muted st-note" title={s.note}>
            {s.note}
          </p>
        )}
      </Td>
      <Td label={t("streams.col.flow")} col={2}>
        <div className="st-flow">
          <div className="place">
            <span className="place-kind">
              <span className="logo" aria-hidden="true">
                →
              </span>
              {t("streams.gateway")}
            </span>
            <p className="mono st-gw">{s.gateway}</p>
          </div>
          <span className="muted" aria-hidden="true">
            →
          </span>
          <Place p={s.sink} />
        </div>
      </Td>
      <Td label={t("streams.col.batch")} col={3}>
        {s.batch !== "" ? s.batch : <span className="muted">—</span>}
      </Td>
      <Td label={t("streams.col.status")}>
        <StatusBadge status="continuous" />
      </Td>
      <Td label={t("streams.col.dead_letter")} col={4}>
        {s.deadLetter ? <Place p={s.deadLetter} /> : <span className="muted">—</span>}
      </Td>
    </tr>
  );
}

function HowItWorks() {
  const { t } = useT();
  return (
    <ol className="st-how">
      {(["post", "batch", "write"] as const).map((k, i) => (
        <li key={k}>
          <p className="muted st-how-step">{t(`streams.how.${i + 1}`)}</p>
          <p>
            <strong>{t(`streams.how.${k}`)}</strong>
          </p>
          <p className="muted">{t(`streams.how.${k}.text`)}</p>
        </li>
      ))}
    </ol>
  );
}

function StreamsData({ query }: { query: string }) {
  const { t, n } = useT();
  const [params, setParams] = useSearchParams();
  const { data: v } = useSuspenseQuery({
    queryKey: ["ingest", "streams", query],
    queryFn: ({ signal }) => getJSON<Streams>(`/api/ingest/streams${query}`, signal),
    ...LIVE,
  });
  return (
    <>
      {v.total > 0 && (
        <>
          <p className="summary">
            <span className="muted">{n("streams.summary.streams", v.total)}</span>
            <span className="muted">{n("streams.summary.gateways", v.gateways)}</span>
            <StatusBadge status="continuous" />
            {v.withDeadLetter > 0 && <span className="muted">{n("streams.summary.dead_letter", v.withDeadLetter)}</span>}
          </p>
          <div className="toolbar">
            <input
              type="search"
              className="search"
              aria-label={t("streams.search")}
              placeholder={t("streams.search")}
              value={params.get("q") ?? ""}
              onChange={(e) => setParams((p) => new URLSearchParams(withParam(p, "q", e.target.value).slice(1)), { replace: true })}
            />
          </div>
        </>
      )}
      {v.kinds.length > 1 && (
        <div className="chips" role="group" aria-label={t("streams.kind")}>
          <Link className="chip" to={{ search: withParam(params, "kind", "") }} aria-current={v.filter.kind === ""}>
            {t("streams.kind.all")}
          </Link>
          {v.kinds.map((k) => (
            <Link key={k.key} className="chip" to={{ search: withParam(params, "kind", k.key) }} aria-current={v.filter.kind === k.key}>
              {k.label}
            </Link>
          ))}
        </div>
      )}
      {v.rows.length === 0 ? (
        <div className="empty">
          {v.total > 0 ? (
            <>
              <p>{t("streams.empty.filtered")}</p>
              <Link to={{ search: "" }}>{t("workflows.clear")}</Link>
            </>
          ) : (
            <>
              <p>{t("streams.empty")}</p>
              <p className="mono">brevis gateway publish gateway.yaml</p>
            </>
          )}
        </div>
      ) : (
        <Rt
          label={t("streams.title")}
          head={
            <>
              <Th>{t("streams.col.stream")}</Th>
              <Th col={2}>{t("streams.col.flow")}</Th>
              <Th col={3}>{t("streams.col.batch")}</Th>
              <Th>{t("streams.col.status")}</Th>
              <Th col={4}>{t("streams.col.dead_letter")}</Th>
            </>
          }
        >
          {v.rows.map((s) => (
            <Row key={s.href} s={s} />
          ))}
        </Rt>
      )}
      <HowItWorks />
    </>
  );
}

function Head() {
  const { t } = useT();
  return (
    <>
      <h1 className="page-title">{t("streams.title")}</h1>
      <p className="lede">
        {t("streams.lead.before")} <strong>{t("streams.lead.strong")}</strong>
        {t("streams.lead.after")}
      </p>
    </>
  );
}

export function StreamsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w="30%" h="1.5rem" />
      <div style={{ height: ".9rem" }} />
      <Skeleton w="60%" h=".9rem" />
      <div className="summary">
        <Skeleton w="18rem" h="1rem" />
      </div>
      <Skeleton w="min(24rem, 100%)" h="2.25rem" />
      <div className="st-sk-rows">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} h="3.6rem" />
        ))}
      </div>
    </div>
  );
}

export default function StreamsRoute() {
  const [params] = useSearchParams();
  const search = params.toString();
  const deferred = useDeferredValue(search);
  return (
    <QueryBoundary>
      <Suspense fallback={<StreamsSkeleton />}>
        <Head />
        <div aria-busy={search !== deferred}>
          <StreamsData query={deferred === "" ? "" : `?${deferred}`} />
        </div>
      </Suspense>
    </QueryBoundary>
  );
}
