import type { CfgRow } from "../api/ingest";
import { useT } from "../i18n";
import "./cfg.css";

/** A file comment: its first line, the rest a click away. */
export function Note({ text }: { text: string }) {
  const [head, ...rest] = text.split("\n");
  const more = rest.join("\n").trim();
  if (more === "") return <p className="cfg-note">{text}</p>;
  return (
    <details className="cfg-note">
      <summary>{head}</summary>
      <p>{more}</p>
    </details>
  );
}

/** A list of settings: label, value, default flag and note, with the block comments a row begins. */
export function CfgRows({ rows }: { rows: CfgRow[] }) {
  const { t } = useT();
  if (rows.length === 0) return null;
  return (
    <div className="cfg">
      {rows.map((r) => (
        <div key={r.path}>
          {r.before.map((b) => (
            <div key={b.label} className="cfg-block">
              <span className="mono">{b.label}</span>
              <Note text={b.text} />
            </div>
          ))}
          <div className="cfg-row" data-path={r.path}>
            <div className="mono muted cfg-label">{r.label}</div>
            <div>
              {r.value === "" ? <span className="muted">{t("config.empty")}</span> : <span className="mono cfg-value">{r.value}</span>}
              {r.default && (
                <span className="cfg-default" title={t("config.default.tip")}>
                  {t("config.default")}
                </span>
              )}
              {r.note !== "" && <Note text={r.note} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
