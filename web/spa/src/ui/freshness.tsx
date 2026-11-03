import { useT } from "../i18n";
import "./status.css";

// A status is a shape and a colour; the word is said beside it, never left to
// the colour alone. Same table as web/components/status.go.
const look: Record<string, [shape: string, colour: string]> = {
  success: ["dot", "ok"], failed: ["diamond", "bad"], running: ["spin", "info"], queued: ["ring", "warn"],
  on_time: ["dot", "ok"], late: ["triangle", "warn"], stale: ["diamond-hollow", "bad"], paused: ["square", "idle"],
  continuous: ["pulse", "info"], no_schedule: ["ring", "idle"], unidentified: ["ring-dashed", "idle"],
};

/** A catalog status as the state vocabulary knows it: "unscheduled" is "no_schedule". */
export const stateKind = (status: string) => (status === "unscheduled" ? "no_schedule" : status);

export function StatusMark({ kind }: { kind: string }) {
  const [shape, colour] = look[stateKind(kind)] ?? ["ring", "idle"];
  return <span className={`st-mark st-${shape} st-c-${colour}`} aria-hidden="true" />;
}

/** The mark and the word of a freshness status (on_time, late, stale, ...). */
export function Freshness({ status }: { status: string }) {
  const { t } = useT();
  const kind = stateKind(status);
  return (
    <span className="st">
      <StatusMark kind={kind} />
      <span className="st-word">{t(`state.${kind}`)}</span>
    </span>
  );
}
