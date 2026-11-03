import { useT } from "../i18n";

// A state is a shape, a colour and a word, so the colour never carries the
// meaning alone. The table is web/components/status.go's, and the classes are
// the server sheet's own (st, st-<shape>, text-state-*).
const LOOK: Record<string, [shape: string, tone: string]> = {
  success: ["dot", "text-state-success"],
  failed: ["diamond", "text-state-failed"],
  running: ["spin", "text-state-running"],
  queued: ["ring", "text-state-queued"],
  retrying: ["spin-dashed", "text-state-retrying"],
  canceled: ["square", "text-state-canceled"],
  pending: ["ring", "text-state-pending"],
  skipped: ["square", "text-state-skipped"],
  never_ran: ["ring-dashed", "text-state-pending"],
  on_time: ["dot", "text-state-success"],
  late: ["triangle", "text-state-queued"],
  stale: ["diamond-hollow", "text-state-failed"],
  paused: ["square", "text-state-canceled"],
  continuous: ["pulse", "text-state-running"],
  no_schedule: ["ring", "text-muted"],
  unidentified: ["ring-dashed", "text-muted"],
  live: ["pulse", "text-state-success"],
};

/** A catalog status as a state kind: whatever the catalog does not name has no schedule to be late against. */
export function freshnessKind(s: string): string {
  return ["on_time", "late", "stale", "paused", "continuous", "unidentified"].includes(s) ? s : "no_schedule";
}

function useWord() {
  const { t } = useT();
  return (kind: string) => (kind in LOOK ? t(`state.${kind}`) : kind);
}

/** A state the way every screen says it: the mark, then the word, both in the state's colour. */
export function Status({ kind }: { kind: string }) {
  const word = useWord();
  const [shape, tone] = LOOK[kind] ?? ["ring", "text-muted"];
  return <span className={`st st-${shape} ${tone}`}>{word(kind)}</span>;
}

/** The mark alone, for a place that says the word beside it; the word stays in the title and for screen readers. */
export function StatusMark({ kind }: { kind: string }) {
  const word = useWord();
  const [shape, tone] = LOOK[kind] ?? ["ring", "text-muted"];
  return <span className={`st st-mark st-${shape} ${tone}`} title={word(kind)} role="img" aria-label={word(kind)} />;
}

/** A destination's or writer's status against its schedule (the catalog's names, "unscheduled" included). */
export function Freshness({ status }: { status: string }) {
  return <Status kind={freshnessKind(status)} />;
}

export function FreshnessMark({ status }: { status: string }) {
  return <StatusMark kind={freshnessKind(status)} />;
}
