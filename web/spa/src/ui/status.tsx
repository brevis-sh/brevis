import { useT } from "../i18n";
import "./status.css";

// One vocabulary of state: a shape and a colour, and always the word, so the
// colour never carries the meaning alone. Same looks as components/status.go.
const LOOK: Record<string, [shape: string, tone: string]> = {
  on_time: ["dot", "success"],
  late: ["triangle", "warn"],
  stale: ["diamond-hollow", "failed"],
  paused: ["square", "off"],
  continuous: ["pulse", "run"],
  no_schedule: ["ring", "off"],
  unidentified: ["ring", "off"],
};

/** A catalog status as a state kind: whatever the catalog does not name has no schedule to be late against. */
export function freshnessKind(s: string): string {
  return s in LOOK ? s : "no_schedule";
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT();
  const kind = freshnessKind(status);
  const [shape, tone] = LOOK[kind]!;
  return <span className={`st st-${shape} st-${tone}`}>{t(`state.${kind}`)}</span>;
}
