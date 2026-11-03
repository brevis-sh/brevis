import { Link, useNavigate } from "react-router";
import { useData } from "../api/live";
import type { Choice, Streams, StreamRow } from "../api/ingest";
import { useFormat, useT } from "../i18n";
import { useDrawer } from "../ui/drawer";
import { HowDrawer, HowSteps } from "../ui/how";
import { Icon } from "../ui/icon";
import { btn, Empty, Lead, MethodPill, PageHead, linkUnderline, Page } from "../ui/kit";
import { Logo } from "../ui/logo";
import { Place } from "../ui/place";
import { FilterBar, ResultCount, SearchField, useUrlSearch, type Chip, type FilterDef } from "../ui/filters";
import { useSeen } from "../ui/seen";
import { Status } from "../ui/status";
import { Row, Table, Td, Th } from "../ui/table";
import { useFilter } from "../ui/use-filter";

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
          <Td cls="text-[12.5px] text-ink-2 max-[1180px]:hidden">{s.batch ? <span>{s.batch}</span> : <span className="text-faint">—</span>}</Td>
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

// What the screen shows before its first answer: the last shape it saw, or this one on a first visit,
// drawn from the real row markup with placeholder values so it takes the height the loaded rows take.
type Shape = { n: number; total: number; gateways: number; withDeadLetter: number; kinds: number };
const FIRST: Shape = { n: 2, total: 2, gateways: 1, withDeadLetter: 1, kinds: 2 };
const shapeOf = (v: Streams): Shape => ({ n: v.rows.length, total: v.total, gateways: v.gateways, withDeadLetter: v.withDeadLetter, kinds: v.kinds.length });
const PLACE = { uri: "", kind: "postgres", kindTitle: "", where: "postgres://warehouse/", what: "table_name", note: "" };
const GHOST_ROW: StreamRow = { gateway: "events_gateway", path: "/v1/stream_path", href: "", note: "", sink: PLACE, batch: "1 second or 500", deadLetter: PLACE };
const ghostOf = (s: Shape): Streams => ({
  rows: Array.from({ length: s.n }, (_, i) => ({ ...GHOST_ROW, href: `#${i}` })),
  total: s.total,
  gateways: s.gateways,
  withDeadLetter: s.withDeadLetter,
  kinds: Array.from({ length: s.kinds }, (_, i): Choice => ({ key: `kind${i}`, label: "Kind" })),
  filter: { kind: "", q: "" },
});

// The bar (see ui/filters): a search and the destination kinds, drawn at once from the last shape seen.
function StreamsBar({ filter, v, ghost }: { filter: Filter; v: Streams; ghost: boolean }) {
  const { t, n } = useT();
  const { number } = useFormat();
  const navigate = useNavigate();
  const [text, setText] = useUrlSearch("q");
  const go = (patch: Record<string, string>) => void navigate(filter.hrefWith(patch));
  const kind = filter.get("kind");
  const q = filter.get("q");
  const filters: FilterDef[] = v.kinds.length > 1
    ? [{
        id: "kind", label: t("streams.kind"), allLabel: t("streams.kind.all"), pending: ghost,
        options: v.kinds.map((k) => ({ key: k.key, label: k.label, icon: <Logo k={k.key} /> })),
        value: kind ? [kind] : [], onChange: (x) => go({ kind: x[0] ?? "" }),
      }]
    : [];
  const chips: Chip[] = kind ? [{ id: "kind", group: t("streams.kind"), value: v.kinds.find((k) => k.key === kind)?.label ?? kind, onRemove: () => go({ kind: "" }) }] : [];
  return (
    <FilterBar
      search={<SearchField value={text} onChange={setText} label={t("streams.search")} />}
      filters={filters}
      chips={chips}
      clearable={filter.any}
      onClearAll={() => go({ kind: "", q: "" })}
      count={<ResultCount pending={ghost} shown={v.rows.length} tail={<>{n("streams.count", v.total, { count: number(v.total) })}{q && <> {t("workflows.count.search", { q })}</>}</>} />}
    />
  );
}

function StreamsData({ filter }: { filter: Filter }) {
  const { t, n } = useT();
  const qs = new URLSearchParams();
  for (const f of FIELDS) if (filter.get(f)) qs.set(f, filter.get(f));
  const q = useData<Streams>(["ingest", "streams", qs.toString()], `/api/ingest/streams${qs.size ? `?${qs}` : ""}`, { topic: "ingest" });
  const ghost = !q.data;
  // Only the unfiltered answer is remembered: a filter's counts are not the list's shape.
  const seen = useSeen("streams", qs.size === 0 && q.data ? shapeOf(q.data) : undefined, FIRST);
  const v = q.data ?? ghostOf(seen);
  return (
    <>
      {v.total > 0 && (
        <div aria-hidden={ghost || undefined} className={`mb-4 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[13px] text-muted ${ghost ? "sk-ghost" : ""}`}>
          <span>{n("streams.summary.streams", v.total)}</span>
          <span>{n("streams.summary.gateways", v.gateways)}</span>
          <Status kind="continuous" />
          {v.withDeadLetter > 0 && <span>{n("streams.summary.dead_letter", v.withDeadLetter)}</span>}
        </div>
      )}
      {v.total > 0 && (
        <StreamsBar filter={filter} v={v} ghost={ghost} />
      )}
      <div aria-busy={ghost}>
        {q.isError ? (
          <p role="alert" className="rounded-card border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted">
            {(q.error as Error).message}
          </p>
        ) : v.rows.length === 0 ? (
          <div aria-hidden={ghost || undefined} className={ghost ? "sk-ghost" : undefined}>
          <Empty msg={v.total > 0 ? t("streams.empty.filtered") : t("streams.empty")} hint={v.total > 0 ? undefined : "brevis gateway publish gateway.yaml"}>
            {v.total > 0 && (
              <Link to="/ingest/streams" className={`mt-2 inline-block text-xs ${linkUnderline}`}>
                {t("workflows.clear")}
              </Link>
            )}
          </Empty>
          </div>
        ) : (
          <Table id="stream-rows" head={<Head />} ghost={ghost} memo="streams">
            <Rows rows={v.rows} />
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
