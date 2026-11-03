import type { Place as PlaceData } from "../api/ingest";
import { useT } from "../i18n";

/**
 * A destination as a chip: its kind (with a monogram, the brand marks stay
 * server-side for now) and under it where, the path giving way to an
 * ellipsis and never the object.
 */
export function Place({ p }: { p: PlaceData }) {
  const { t } = useT();
  return (
    <div className="place">
      {p.kind !== "" && (
        <span className="place-kind">
          <span className="logo" aria-hidden="true">
            {p.kind.slice(0, 2).toUpperCase()}
          </span>
          {p.kindTitle}
        </span>
      )}
      {p.uri === "" ? (
        <p className="muted" title={p.note}>
          {t("streams.unidentified")}
        </p>
      ) : (
        <p className="place-uri mono" title={p.note ? `${p.uri} — ${p.note}` : p.uri}>
          <span className="place-where muted">{p.where}</span>
          <span className="place-what">{p.what}</span>
        </p>
      )}
    </div>
  );
}
