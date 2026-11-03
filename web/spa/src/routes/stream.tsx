import { useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ApiError } from "../api/client";
import { useData } from "../api/live";
import type { Stream } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { useCrumb } from "../shell/nav";
import { ConfigNote, DeadLetterPanel } from "../ui/cfg";
import { CopyButton } from "../ui/copy";
import { FlowDiagram } from "../ui/flow";
import { HashTabs } from "../ui/hash-tabs";
import { Icon } from "../ui/icon";
import { btn, ButtonLink, Card, Empty, PageHead, linkUnderline, Page } from "../ui/kit";
import { Logo, useLogoTitle } from "../ui/logo";
import { Skeleton } from "../ui/skeleton";
import { Status } from "../ui/status";

const pill = "inline-flex items-center gap-1.5 rounded-card border border-line px-2 py-0.5 text-ink-2";
const h2 = "mb-3 text-[13px] font-semibold text-ink";

function Strip({ gateway, v }: { gateway: string; v: Stream | undefined }) {
  const { t } = useT();
  const { utc } = useFormat();
  const kind = useLogoTitle();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border border-line bg-surface px-4 py-3 text-[12.5px] text-muted">
      <Status kind="continuous" />
      <span>{t("streams.page.from")}</span>
      <span className={pill}>
        <Logo k="gateway" />
        {t("streams.gateway")}
        <span className="font-mono text-ink">{gateway}</span>
      </span>
      <span>{t("streams.page.to")}</span>
      {!v ? (
        <Skeleton w="18rem" h="1.5rem" />
      ) : (
        <>
          <span className={`${pill} min-w-0`}>
            {v.sink.kind !== "" && (
              <>
                <Logo k={v.sink.kind} />
                {kind(v.sink.kind)}
              </>
            )}
            <span className="truncate font-mono text-ink" title={v.sink.uri}>
              {v.sink.uri || t("streams.unidentified")}
            </span>
          </span>
          {v.format !== "" && <span>{t("streams.page.format", { format: v.format })}</span>}
          {v.publishedAt && <span>{t("streams.page.published", { at: utc(v.publishedAt) })}</span>}
        </>
      )}
    </div>
  );
}

function Overview({ path, v }: { path: string; v: Stream | undefined }) {
  const { t } = useT();
  return (
    <section className="mb-3">
      <h2 className={h2}>{t("streams.tab.overview")}</h2>
      <div className="overflow-hidden rounded-card border border-line bg-surface">{v?.flow ? <FlowDiagram flow={v.flow} /> : !v ? <Skeleton h="9rem" /> : null}</div>
      <div className="mt-3 grid grid-cols-1 gap-3 min-[1180px]:grid-cols-[minmax(0,1fr)_360px]">
        <Card title={t("streams.page.sentence")}>
          <div className="px-4 py-3">
            {v ? <p className="text-[13.5px] text-ink">{v.summary}</p> : <Skeleton h="2.5rem" />}
            <p className="mt-3 border-t border-line-soft pt-3 text-[12px] text-muted">{t("streams.page.metrics")}</p>
          </div>
        </Card>
        <Card title={t("streams.page.next")}>
          <ol className="space-y-2 px-4 py-3 text-[12.5px]">
            <li>
              <span className="inline-flex items-center gap-1.5 rounded-card border border-line px-2 py-0.5 font-mono text-ink">
                <span className="font-sans text-[10.5px] tracking-[0.08em] text-muted uppercase">stream</span>
                {path}
              </span>
            </li>
            <li className="pl-2 text-muted">&darr; {t("streams.page.writes")}</li>
            <li>
              {!v ? (
                <Skeleton w="14rem" h="1.5rem" />
              ) : (
                <>
                  <span className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-card border border-line px-2 py-0.5 font-mono text-ink">
                    {v.sink.kind !== "" && <Logo k={v.sink.kind} />}
                    {v.tables.length > 0 ? v.tables.join(" · ") : <span className="break-all">{v.sink.uri || t("streams.unidentified")}</span>}
                  </span>
                  {v.catalogHref !== "" && (
                    <Link to={v.catalogHref} className="mt-1 block text-[12px] text-ink-2 hover:text-ink hover:underline">
                      {t("loads.drawer.catalog")} &rarr;
                    </Link>
                  )}
                </>
              )}
            </li>
            <li className="pl-2 text-muted">&darr; {t("streams.page.read_by")}</li>
            <li>
              {!v ? (
                <Skeleton w="10rem" h="1rem" />
              ) : v.readBy.length === 0 ? (
                <span className="text-faint">{t("streams.page.read_by.none")}</span>
              ) : (
                <ul className="space-y-1">
                  {v.readBy.map((e) => (
                    <li key={e.href}>
                      <Link to={e.href} className="font-mono text-ink hover:underline">
                        GET {e.path}
                      </Link>
                      <span className="ml-1.5 text-muted">{e.api}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          </ol>
        </Card>
      </div>
    </section>
  );
}

function Config({ v }: { v: Stream | undefined }) {
  const { t } = useT();
  const { utc } = useFormat();
  const [view, setView] = useState<"explained" | "yaml">("explained");
  const toggle = (k: "explained" | "yaml", label: string) => (
    <button
      type="button"
      aria-pressed={view === k}
      onClick={() => setView(k)}
      className="rounded-[5px] px-2.5 py-1 text-[12.5px] text-muted aria-pressed:bg-surface-2 aria-pressed:text-ink"
    >
      {label}
    </button>
  );
  return (
    <section className="mb-3">
      <h2 className={h2}>{t("streams.tab.config")}</h2>
      {!v ? (
        <Skeleton h="10rem" />
      ) : !v.hasConfig ? (
        <p className="rounded-card border border-line bg-surface px-4 py-3 text-xs text-muted">{t("streamcfg.v1")}</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted">{t("streamcfg.lead")}</p>
            <div role="group" aria-label={t("streams.tab.config")} className="inline-flex h-8 items-center gap-0.5 rounded-card border border-line bg-surface p-0.5">
              {toggle("explained", t("streamcfg.explained"))}
              {toggle("yaml", "YAML")}
            </div>
          </div>
          {view === "explained" ? (
            <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-2">
              {v.cards.map((c) => (
                <Card key={c.key} title={c.title}>
                  <dl className="divide-y divide-line-soft">
                    {c.rows.map((r) => (
                      <div key={r.path} data-explained={r.path} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-x-4 px-4 py-2.5 text-[12.5px]">
                        <dt>
                          <span className="text-ink-2">{r.label}</span>
                          <span className="mt-0.5 block font-mono text-[11px] text-faint">{r.path}</span>
                        </dt>
                        <dd className="min-w-0">
                          <span className="font-mono break-all text-ink">{r.value}</span>
                          {r.default && (
                            <span className="ml-2 rounded-card border border-line px-1 py-px text-[0.65rem] text-muted uppercase" title={t("config.default.tip")}>
                              {t("config.default")}
                            </span>
                          )}
                          {r.note !== "" && (
                            <div className="mt-1">
                              <ConfigNote text={r.note} />
                            </div>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ))}
            </div>
          ) : (
            <section>
              <div className="mb-1.5 flex items-center justify-between">
                <h3 className="text-[12.5px] text-muted">{t("streamcfg.yaml")}</h3>
                <CopyButton text={v.yaml} label={t("loads.drawer.copy")} />
              </div>
              <pre className="overflow-x-auto rounded-card border border-line bg-canvas px-4 py-3 font-mono text-[12px] text-ink-2">
                <code>{v.yaml}</code>
              </pre>
              <p className="mt-1.5 text-[11.5px] text-faint">{t("catalog.drawer.credentials")}</p>
            </section>
          )}
          {v.changes.length > 0 && (
            <p className="mt-3 text-[12px] text-muted">
              {t("streamcfg.history")}{" "}
              {v.changes.map((c, i) => (
                <span key={c.at}>
                  {i > 0 && <span className="text-faint"> · </span>}
                  {utc(c.at)} — {c.text}
                </span>
              ))}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function DeadLetter({ v }: { v: Stream | undefined }) {
  const { t } = useT();
  const dl = v?.deadLetter;
  const uri = dl ? dl.uri || t("streams.unidentified") : "";
  let body: ReactNode;
  if (!v) body = <Skeleton h="8rem" />;
  else if (!dl) body = <p className="rounded-card border border-line bg-surface px-4 py-3 text-sm text-muted">{t("deadletter.none")}</p>;
  else
    body = (
      <div className="flex flex-col gap-4">
        <Card title={t("deadletter.where")} count={dl.kind}>
          <div className="flex items-start gap-3 px-4 py-3">
            <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-[0.8rem] break-all whitespace-pre-wrap text-ink">{uri}</pre>
            <CopyButton text={uri} label={t("loads.drawer.copy")} />
          </div>
          {dl.note !== "" && <p className="px-4 pb-3 text-[12px] text-muted">{dl.note}</p>}
          <p className="border-t border-line-soft px-4 py-3 text-[0.75rem] text-muted">
            {t("deadletter.metric")} <code className="font-mono text-ink-2">{v.buriedMetric}</code>
          </p>
        </Card>
        {v.deadLetterPanel ? (
          <div className="rounded-card border border-line bg-surface">
            <DeadLetterPanel dl={v.deadLetterPanel} />
          </div>
        ) : (
          <p className="rounded-card border border-line bg-surface px-4 py-3 text-xs text-muted">{t("deadletter.no_config")}</p>
        )}
        <p className="text-[12px] text-faint">{t("deadletter.count_later")}</p>
      </div>
    );
  return (
    <section className="mb-3">
      <h2 className={h2}>{t("streams.tab.dead_letter")}</h2>
      {body}
    </section>
  );
}

// The example event in the stream's format and the curl that would send it.
// It sends nothing: the console holds no token for the gateway. The body is
// editable and the curl follows it. (The old drawer also validated the body
// against the format; that check is not carried over.)
function TestEvent({ path, v }: { path: string; v: Stream | undefined }) {
  const { t } = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [edited, setEdited] = useState<string | null>(null);
  const body = edited ?? v?.testEvent.body ?? "";
  const curl = v ? `${v.testEvent.curlHead}\n${body}\nEOF` : "";
  return (
    <>
      <button type="button" className={btn(true)} aria-haspopup="dialog" disabled={!v} onClick={() => dialog.current?.showModal()}>
        <Icon name="send" className="h-3.5 w-3.5" />
        {t("streams.page.test")}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="test-event-title"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="run-drawer fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(520px,100vw)] border-l border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                POST {path} · {v?.testEvent.format}
              </p>
              <p id="test-event-title" className="text-[15px] font-semibold text-ink">
                {t("testevent.title")}
              </p>
              <p className="mt-1 text-[12.5px] text-muted">{t("testevent.lead")}</p>
            </div>
            <button type="button" aria-label={t("dialog.close")} onClick={() => dialog.current?.close()} className="flex h-8 w-8 items-center justify-center rounded-card text-muted transition-colors hover:bg-surface-2 hover:text-ink">
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-ink">{t("testevent.body")}</span>
              <textarea
                rows={8}
                spellCheck={false}
                value={body}
                onChange={(e) => setEdited(e.target.value)}
                className="w-full rounded-card border border-line bg-canvas px-3 py-2 font-mono text-[0.78rem] text-ink focus:border-accent-strong focus:outline-none"
              />
            </label>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12.5px] text-muted">{t("testevent.send_with")}</span>
                <CopyButton text={curl} label={t("testevent.copy")} />
              </div>
              <pre className="overflow-x-auto rounded-card border border-line-soft bg-canvas px-3 py-2 font-mono text-[0.72rem] text-ink-2">
                <code>{curl}</code>
              </pre>
            </div>
            <p className="text-[12px] text-muted">{t("testevent.note", { sink: v?.sink.uri || t("streams.unidentified") })}</p>
          </div>
        </div>
      </dialog>
    </>
  );
}

export default function StreamRoute() {
  const { t } = useT();
  // The stream's path is the tail of the address: /ingest/streams/<gateway>/<path...>.
  const { gateway = "", "*": rest = "" } = useParams();
  const path = `/${rest}`;
  useCrumb(`POST ${path}`, { mono: true });
  const q = useData<Stream>(["ingest", "stream", gateway, rest], `/api/ingest/streams/${encodeURIComponent(gateway)}/${rest.split("/").map(encodeURIComponent).join("/")}`, {
    every: 15_000,
    keep: false,
  });
  const v = q.data;
  if (q.error instanceof ApiError && q.error.status === 404)
    return (
      <Empty msg={t("streams.empty.filtered")}>
        <Link to="/ingest/streams" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
          {t("nav.streams")}
        </Link>
      </Empty>
    );
  return (
    <Page>
      <PageHead
        mono
        title={`POST ${path}`}
        eyebrow={
          <>
            <Link to="/ingest/streams" className="text-[0.75rem] text-muted hover:text-ink">
              &larr; {t("nav.streams")}
            </Link>
            <span className="text-faint">·</span>
            <span className="text-[0.7rem] font-medium tracking-[0.08em] text-muted uppercase">{t("streams.page.kicker")}</span>
            <span className="font-mono text-[0.75rem] text-ink-2">{gateway}</span>
          </>
        }
        actions={
          <>
            {v && v.query !== "" && (
              <ButtonLink to={v.query} icon="terminal">
                {t("loads.drawer.query")}
              </ButtonLink>
            )}
            <TestEvent path={path} v={v} />
          </>
        }
      />
      {q.isError && (
        <p role="alert" className="mb-3 rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
          {(q.error as Error).message}
        </p>
      )}
      <div className="mb-4 max-w-3xl text-[13.5px] text-muted">{v ? v.lede : <Skeleton w="36rem" h="1.1rem" className="max-w-full" />}</div>
      <Strip gateway={gateway} v={v} />
      <HashTabs
        id="stream-tabs"
        label={t("streams.page.tabs")}
        tabs={[
          { key: "overview", label: t("streams.tab.overview"), panel: <Overview path={path} v={v} /> },
          { key: "config", label: t("streams.tab.config"), panel: <Config v={v} /> },
          { key: "deadletter", label: t("streams.tab.dead_letter"), panel: <DeadLetter v={v} /> },
        ]}
      />
    </Page>
  );
}
