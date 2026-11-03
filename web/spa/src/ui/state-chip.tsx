import { useT, useFormat } from "../i18n";
import "./wf-ui.css";

// StateChip is a run's state: a colored dot and the word.
export function StateChip({ status }: { status: string }) {
  const { t } = useT();
  return <span className={`state-chip st-${status}`}>{t(`state.${status || "never_ran"}`)}</span>;
}

// RunStrip is the last runs as squares, oldest to newest, each a link to its run.
export function RunStrip({ runs }: { runs: { id: string; status: string; at: string }[] }) {
  const { t } = useT();
  const { dateTime } = useFormat();
  if (runs.length === 0) return null;
  return (
    <div className="run-strip" role="group">
      {runs.map((r) => {
        const label = `${t(`state.${r.status}`)} · ${dateTime(r.at)}`;
        // A plain link: the run page is still the server's.
        return <a key={r.id} href={`/runs/${r.id}`} className={`st-${r.status}`} title={label} aria-label={label} />;
      })}
    </div>
  );
}
