import { Suspense, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "../api/client";
import type { Stream } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { QueryBoundary } from "../ui/boundary";
import { CopyButton } from "../ui/copy";
import { FlowDiagram } from "../ui/flow";
import { LIVE } from "../ui/live";
import { Note } from "../ui/cfg";
import { Skeleton } from "../ui/skeleton";
import { StatusBadge } from "../ui/status";
import { HashTabs } from "../ui/hash-tabs";
import "../ui/list.css";
import "./stream.css";

function Strip({ v }: { v: Stream }) {
  const { t } = useT();
  const { dateTime } = useFormat();
  return (
    <div className="sd-strip">
      <StatusBadge status="continuous" />
      <span>{t("streams.page.from")}</span>
      <span className="sd-pill">
        {t("streams.gateway")} <span className="mono">{v.gateway}</span>
      </span>
      <span>{t("streams.page.to")}</span>
      <span className="sd-pill">
        {v.sink.kindTitle}
        <span className="mono sd-clip" title={v.sink.uri}>
          {v.sink.uri || t("streams.unidentified")}
        </span>
      </span>
      {v.format !== "" && <span>{t("streams.page.format", { format: v.format })}</span>}
      {v.publishedAt && <span>{t("streams.page.published", { at: dateTime(v.publishedAt) })}</span>}
    </div>
  );
}

function Overview({ v }: { v: Stream }) {
  const { t } = useT();
  return (
    <>
      {v.flow && (
        <div className="panel">
          <FlowDiagram flow={v.flow} />
        </div>
      )}
      <div className="sd-grid">
        <section className="panel">
          <h3>{t("streams.page.sentence")}</h3>
          <div className="body">
            <p>{v.summary}</p>
            <p className="muted sd-small">{t("streams.page.metrics")}</p>
          </div>
        </section>
        <section className="panel">
          <h3>{t("streams.page.next")}</h3>
          <ol className="body sd-next">
            <li>
              <span className="sd-pill mono">
                <span className="muted">stream</span> {v.path}
              </span>
            </li>
            <li className="muted">↓ {t("streams.page.writes")}</li>
            <li>
              <span className="sd-pill mono">{v.tables.length > 0 ? v.tables.join(" · ") : v.sink.uri || t("streams.unidentified")}</span>
              {v.catalogHref !== "" && (
                <a className="sd-block" href={v.catalogHref}>
                  {t("loads.drawer.catalog")} →
                </a>
              )}
            </li>
            <li className="muted">↓ {t("streams.page.read_by")}</li>
            <li>
              {v.readBy.length === 0 ? (
                <span className="muted">{t("streams.page.read_by.none")}</span>
              ) : (
                <ul>
                  {v.readBy.map((e) => (
                    <li key={e.href}>
                      <a className="mono" href={e.href}>
                        GET {e.path}
                      </a>{" "}
                      <span className="muted">{e.api}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ol>
        </section>
      </div>
    </>
  );
}

function Config({ v }: { v: Stream }) {
  const { t } = useT();
  const { dateTime } = useFormat();
  const [view, setView] = useState<"explained" | "yaml">("explained");
  if (!v.hasConfig) return <p className="panel body muted">{t("streamcfg.v1")}</p>;
  return (
    <>
      <div className="sd-cfg-head">
        <p className="muted">{t("streamcfg.lead")}</p>
        <div role="group" aria-label={t("streams.tab.config")} className="sd-toggle">
          <button type="button" aria-pressed={view === "explained"} onClick={() => setView("explained")}>
            {t("streamcfg.explained")}
          </button>
          <button type="button" aria-pressed={view === "yaml"} onClick={() => setView("yaml")}>
            YAML
          </button>
        </div>
      </div>
      {view === "explained" ? (
        <div className="sd-cards">
          {v.cards.map((c) => (
            <section key={c.key} className="panel">
              <h3>{c.title}</h3>
              <dl className="sd-rows">
                {c.rows.map((r) => (
                  <div key={r.path} data-explained={r.path}>
                    <dt>
                      {r.label}
                      <span className="mono muted sd-path">{r.path}</span>
                    </dt>
                    <dd>
                      <span className="mono">{r.value}</span>
                      {r.default && (
                        <span className="cfg-default" title={t("config.default.tip")}>
                          {t("config.default")}
                        </span>
                      )}
                      {r.note !== "" && <Note text={r.note} />}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <section>
          <div className="sd-yaml-head">
            <h3 className="muted">{t("streamcfg.yaml")}</h3>
            <CopyButton text={v.yaml} label={t("loads.drawer.copy")} />
          </div>
          <pre className="code">{v.yaml}</pre>
          <p className="muted sd-small">{t("catalog.drawer.credentials")}</p>
        </section>
      )}
      {v.changes.length > 0 && (
        <p className="muted sd-small">
          {t("streamcfg.history")}{" "}
          {v.changes.map((c, i) => (
            <span key={c.at}>
              {i > 0 && " · "}
              {dateTime(c.at)} — {c.text}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

function DeadLetter({ v }: { v: Stream }) {
  const { t } = useT();
  const dl = v.deadLetter;
  if (!dl) return <p className="panel body muted">{t("deadletter.none")}</p>;
  const p = v.deadLetterPanel;
  const uri = dl.uri || t("streams.unidentified");
  return (
    <div className="sd-dl">
      <section className="panel">
        <h3>
          {t("deadletter.where")} <span className="muted">{dl.kind}</span>
        </h3>
        <div className="body sd-uri">
          <pre className="mono">{uri}</pre>
          <CopyButton text={uri} label={t("loads.drawer.copy")} />
        </div>
        {dl.note !== "" && <p className="body muted sd-small">{dl.note}</p>}
        <p className="panel-note">
          {t("deadletter.metric")} <code>{v.buriedMetric}</code>
        </p>
      </section>
      {p ? (
        <section className="panel body">
          <h4>{t("deadletter.commands.title")}</h4>
          <p className="muted">{t("deadletter.goes", { where: p.where })}</p>
          {p.readable ? (
            <>
              <p className="muted">{t("deadletter.commands.where")}</p>
              <pre className="code">{p.commands}</pre>
              <p className="muted">
                {p.write === "append" ? t("deadletter.resend.append") : p.write === "merge" ? t("deadletter.resend.merge") : t("deadletter.resend.other")}
              </p>
            </>
          ) : (
            <p className="muted">{t("deadletter.unreadable")}</p>
          )}
        </section>
      ) : (
        <p className="panel body muted">{t("deadletter.no_config")}</p>
      )}
      <p className="muted sd-small">{t("deadletter.count_later")}</p>
    </div>
  );
}

// The example event in the stream's format and the curl that would send it.
// It sends nothing: the console holds no token for the gateway. The body is
// editable and the curl follows it. (The old drawer also validated the body
// against the format; that check is not carried over.)
function TestEvent({ v }: { v: Stream }) {
  const { t } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [body, setBody] = useState(v.testEvent.body);
  const curl = `${v.testEvent.curlHead}\n${body}\nEOF`;
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => dialog.current?.showModal()}>
        {t("streams.page.test")}
      </button>
      <dialog ref={dialog} className="sd-dialog" aria-labelledby="sd-test-title">
        <header>
          <div>
            <p className="mono muted sd-small">
              POST {v.path} · {v.testEvent.format}
            </p>
            <h2 id="sd-test-title">{t("testevent.title")}</h2>
            <p className="muted">{t("testevent.lead")}</p>
          </div>
          <button type="button" className="btn" aria-label={t("dialog.close")} onClick={() => dialog.current?.close()}>
            ×
          </button>
        </header>
        <label>
          <span>{t("testevent.body")}</span>
          <textarea className="mono" rows={8} spellCheck={false} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="sd-yaml-head">
          <span className="muted">{t("testevent.send_with")}</span>
          <CopyButton text={curl} label={t("testevent.copy")} />
        </div>
        <pre className="code">{curl}</pre>
        <p className="muted sd-small">{t("testevent.note", { sink: v.sink.uri || t("streams.unidentified") })}</p>
      </dialog>
    </>
  );
}

function StreamData({ gateway, path }: { gateway: string; path: string }) {
  const { t } = useT();
  const { data: v } = useSuspenseQuery({
    queryKey: ["ingest", "stream", gateway, path],
    queryFn: ({ signal }) =>
      getJSON<Stream>(`/api/ingest/streams/${encodeURIComponent(gateway)}/${path.split("/").map(encodeURIComponent).join("/")}`, signal),
    ...LIVE,
  });
  return (
    <>
      <Link className="back" to="/ingest/streams">
        ← {t("nav.streams")}
      </Link>
      <header className="sd-head">
        <div>
          <p className="muted sd-kicker">
            {t("streams.page.kicker")} <span className="mono">{v.gateway}</span>
          </p>
          <h1 className="mono">POST {v.path}</h1>
        </div>
        <div className="sd-actions">
          {v.query !== "" && (
            <a className="btn" href={v.query}>
              {t("loads.drawer.query")}
            </a>
          )}
          <TestEvent v={v} />
        </div>
      </header>
      <p className="lede">{v.lede}</p>
      <Strip v={v} />
      <HashTabs
        id="stream-tabs"
        label={t("streams.page.tabs")}
        tabs={[
          { key: "overview", label: t("streams.tab.overview"), panel: <Overview v={v} /> },
          { key: "config", label: t("streams.tab.config"), panel: <Config v={v} /> },
          { key: "deadletter", label: t("streams.tab.dead_letter"), panel: <DeadLetter v={v} /> },
        ]}
      />
    </>
  );
}

export function StreamSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton w="6rem" h=".9rem" />
      <div className="sd-head">
        <div>
          <Skeleton w="10rem" h=".8rem" />
          <div style={{ height: ".4rem" }} />
          <Skeleton w="14rem" h="1.5rem" />
        </div>
        <Skeleton w="9rem" h="2.1rem" />
      </div>
      <Skeleton w="60%" h=".9rem" />
      <div style={{ height: "1rem" }} />
      <Skeleton h="3rem" />
      <div style={{ height: "1rem" }} />
      <Skeleton h="2.3rem" />
      <div style={{ height: ".75rem" }} />
      <Skeleton h="9rem" />
    </div>
  );
}

function Missing() {
  const { t } = useT();
  return (
    <div className="empty">
      <p>{t("streams.empty.filtered")}</p>
      <Link to="/ingest/streams">{t("nav.streams")}</Link>
    </div>
  );
}

export default function StreamRoute() {
  // The stream's path is the tail of the address: /ingest/streams/<gateway>/<path...>.
  const { gateway = "", "*": rest = "" } = useParams();
  return (
    <QueryBoundary
      notFound={
        <Suspense fallback={<StreamSkeleton />}>
          <Missing />
        </Suspense>
      }
    >
      <Suspense fallback={<StreamSkeleton />}>
        <StreamData gateway={gateway} path={rest} />
      </Suspense>
    </QueryBoundary>
  );
}
