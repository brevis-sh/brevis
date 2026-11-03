import { Link, useNavigate } from "react-router";
import { useData } from "../api/live";
import type { Streams, StreamRow } from "../api/ingest";
import { useT } from "../i18n";
import { useDrawer } from "../ui/drawer";
import { HowDrawer, HowSteps } from "../ui/how";
import { Icon } from "../ui/icon";
import { btn, Empty, FilterRow, Lead, MethodPill, PageHead, linkUnderline, Page } from "../ui/kit";
import { Logo } from "../ui/logo";
import { Place } from "../ui/place";
import { SearchBox, Segmented } from "../ui/segmented";
import { Skeleton } from "../ui/skeleton";
import { Status } from "../ui/status";
import { Row, Table, Td, Th } from "../ui/table";
import { useFilter, useSearchBox } from "../ui/use-filter";

const FIELDS = ["kind", "q"] as const;
type Filter = ReturnType<typeof useFilter>;

// The example the new-stream drawer shows: a stream as the gateway's file declares one, and how it reaches the console.
const NEW_YAML = `streams:
  #: What this stream is for, shown under its path.
  - name: orders
    path: /v1/orders
    format: json
    identity:
      provider: acme
      entity: order
      source_key: order_id
      record_ts: created_at
    buffer:
      flush:
        every: 1m
        records: 2000
    sink:
      type: bigquery
      project: acme-prod
      dataset: bronze
      table: orders
    dead_letter:
      type: files
      path: gs://acme-dead-letter/orders/`;
const NEW_COMMANDS = `gateway describe -out gateway.json gateway.yaml
brevis gateway publish gateway.json`;

function Head() {
  const { t } = useT();
  return (
    <>
      <Th edge="first">{t("streams.col.stream")}</Th>
      <Th cls="max-[960px]:hidden">{t("streams.col.flow")}</Th>
      <Th cls="max-[1180px]:hidden">{t("streams.col.batch")}</Th>
      <Th>{t("streams.col.status")}</Th>
      <Th cls="max-[1280px]:hidden">{t("streams.col.dead_letter")}</Th>
      <Th edge="last" cls="w-8" />
    </>
  );
}

function Rows({ rows }: { rows: StreamRow[] }) {
  const { t } = useT();
  const navigate = useNavigate();
  return (
    <>
      {rows.map((s) => (
        <Row key={s.href} onOpen={() => navigate(s.href)}>
          <Td edge="first">
            <Link to={s.href} className="inline-flex items-center gap-2 font-mono text-[13px]">
              <MethodPill method="POST" />
              <span className="font-medium text-ink">{s.path}</span>
            </Link>
            {s.note && (
              <p className="mt-1 max-w-[16rem] truncate text-[12px] text-muted" title={s.note}>
                {s.note}
              </p>
            )}
          </Td>
          <Td cls="max-[960px]:hidden">
            <div className="flex items-start gap-3">
              <div className="min-w-0">
                <span className="flex items-center gap-1.5 text-[12px] text-ink-2">
                  <Logo k="gateway" />
                  {t("streams.gateway")}
                </span>
                <p className="mt-0.5 font-mono text-[12px] text-ink">{s.gateway}</p>
              </div>
              <span className="mt-2 text-faint" aria-hidden="true">
                &rarr;
              </span>
              <Place p={s.sink} />
            </div>
          </Td>
          <Td cls="text-[12.5px] text-ink-2 max-[1180px]:hidden">{s.batch || <span className="text-faint">—</span>}</Td>
          <Td>
            <Status kind="continuous" />
          </Td>
          <Td cls="max-[1280px]:hidden">{s.deadLetter ? <Place p={s.deadLetter} max="max-w-[12rem]" /> : <span className="text-faint">—</span>}</Td>
          <Td edge="last" cls="text-right text-faint">
            <Icon name="chevron-right" className="ml-auto h-4 w-4" />
          </Td>
        </Row>
      ))}
    </>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }, (_, i) => (
        <tr key={i} aria-hidden="true">
          <Td edge="first"><Skeleton w="10rem" h="20px" /></Td>
          <Td cls="max-[960px]:hidden"><Skeleton w="22rem" h="34px" /></Td>
          <Td cls="max-[1180px]:hidden"><Skeleton w="7rem" h="18px" /></Td>
          <Td><Skeleton w="5rem" h="18px" /></Td>
          <Td cls="max-[1280px]:hidden"><Skeleton w="10rem" h="34px" /></Td>
          <Td edge="last" />
        </tr>
      ))}
    </>
  );
}

function Search({ filter }: { filter: Filter }) {
  const { t } = useT();
  const [text, setText] = useSearchBox(filter.get("q"), (q) => filter.hrefWith({ q }));
  return <SearchBox value={text} onChange={setText} label={t("streams.search")} />;
}

function StreamsData({ filter }: { filter: Filter }) {
  const { t, n } = useT();
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Streams>(["ingest", "streams", qs.toString()], `/api/ingest/streams${qs.size ? `?${qs}` : ""}`, { topic: "ingest" });
  const v = q.data;
  const kind = filter.get("kind");
  return (
    <>
      {!v ? (
        <Skeleton w="26rem" h="18px" className="mb-4 max-w-full" />
      ) : (
        v.total > 0 && (
          <div className="mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-muted">
            <span>{n("streams.summary.streams", v.total)}</span>
            <span>{n("streams.summary.gateways", v.gateways)}</span>
            <Status kind="continuous" />
            {v.withDeadLetter > 0 && <span>{n("streams.summary.dead_letter", v.withDeadLetter)}</span>}
          </div>
        )
      )}
      {(!v || v.total > 0) && (
        <FilterRow>
          <Search filter={filter} />
          {v && v.kinds.length > 1 && (
            <Segmented
              label={t("streams.kind")}
              choices={[
                { key: "", label: t("streams.kind.all"), to: filter.hrefWith({ kind: "" }), current: kind === "" },
                ...v.kinds.map((k) => ({
                  key: k.key,
                  label: (
                    <>
                      <Logo k={k.key} />
                      {k.label}
                    </>
                  ),
                  to: filter.hrefWith({ kind: k.key }),
                  current: kind === k.key,
                })),
              ]}
            />
          )}
        </FilterRow>
      )}
      <div aria-busy={q.isFetching}>
        {q.isError ? (
          <p role="alert" className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
            {(q.error as Error).message}
          </p>
        ) : v && v.rows.length === 0 ? (
          <Empty msg={v.total > 0 ? t("streams.empty.filtered") : t("streams.empty")} hint={v.total > 0 ? undefined : "brevis gateway publish gateway.yaml"}>
            {v.total > 0 && (
              <Link to="/ingest/streams" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
                {t("workflows.clear")}
              </Link>
            )}
          </Empty>
        ) : (
          <Table id="stream-rows" head={<Head />}>
            {v ? <Rows rows={v.rows} /> : <SkeletonRows />}
          </Table>
        )}
      </div>
    </>
  );
}

function HowItWorks() {
  const { t } = useT();
  return (
    <HowSteps
      steps={(["post", "batch", "write"] as const).map((k, i) => ({
        kicker: t(`streams.how.${i + 1}`),
        title: t(`streams.how.${k}`),
        text: t(`streams.how.${k}.text`),
      }))}
    />
  );
}

export default function StreamsRoute() {
  const { t } = useT();
  const filter = useFilter(FIELDS, "/ingest/streams");
  const { show } = useDrawer("novo");
  return (
    <Page>
      <PageHead
        title={t("streams.title")}
        actions={
          <button type="button" className={btn(true)} aria-haspopup="dialog" onClick={show}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            {t("streams.new")}
          </button>
        }
      />
      <Lead before={t("streams.lead.before")} strong={t("streams.lead.strong")} after={t("streams.lead.after")} />
      <StreamsData filter={filter} />
      <HowItWorks />
      <HowDrawer
        id="novo"
        title={t("streams.new")}
        lead={t("streams.new.lead")}
        blocks={[
          { title: t("streams.new.declare"), text: NEW_YAML },
          { title: t("streams.new.publish"), text: NEW_COMMANDS },
        ]}
        note={t("streams.new.note")}
      />
    </Page>
  );
}
