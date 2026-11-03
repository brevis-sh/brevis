import { useT } from "../i18n";
import "./ov-status.css";

/** The word for a run's state in the reader's language; a state nobody translated reads as itself. */
export function useStateWord() {
  const { t } = useT();
  return (status: string) => {
    const key = `state.${status || "never_ran"}`;
    const word = t(key);
    return word === `[${key}]` ? status : word;
  };
}

/** The state's mark alone, for dense places where the word is already in the column. */
export function StatusMark({ status }: { status: string }) {
  const word = useStateWord()(status);
  return <span className="ov-st-mark" data-status={status} role="img" aria-label={word} title={word} />;
}

/** A mark and its word. */
export function StatusBadge({ status }: { status: string }) {
  const word = useStateWord()(status);
  return (
    <span className="ov-st" data-status={status}>
      <span className="ov-st-mark" aria-hidden="true" />
      {word}
    </span>
  );
}

/** "↻2" on a run on its second attempt or later; attempt counts from 0, so nothing on a first try. */
export function RetryMark({ attempt }: { attempt: number }) {
  const { t } = useT();
  if (attempt < 1) return null;
  return (
    <span className="ov-st-retry" title={t("run.retry_title", { n: attempt + 1 })}>
      ↻{attempt + 1}
    </span>
  );
}
