import type { CfgRow, StepConfig } from "../api/ingest";
import { useT } from "../i18n";
import { CfgRows, Note } from "../ui/cfg";
import { FlowDiagram } from "../ui/flow";
import { DefinitionList } from "../ui/kv";
import { HashTabs, type HashTab } from "../ui/hash-tabs";

function Stage({ c }: { c: StepConfig["stage"] }) {
  const { t, n } = useT();
  return (
    <ol className="lc-stage">
      <li>
        <p>
          <strong>{t("config.stage.source")}</strong> <span className="mono muted">{c.sourceDriver}</span>
        </p>
        <p className="muted">
          {c.sourceCount > 0
            ? [n("config.stage.sources", c.sourceCount), c.workers !== null && n("config.stage.workers", c.workers)].filter(Boolean).join(" · ")
            : t("config.stage.one_source")}
        </p>
      </li>
      <li>
        <p>
          <strong>{t("config.stage.transform")}</strong> <span className="mono muted">{n("config.stage.stages", c.transformCount)}</span>
        </p>
        <p className="muted lc-clip" title={c.transformNames}>
          {c.transformCount === 0 ? t("config.stage.as_read") : c.transformNames}
        </p>
      </li>
      <li>
        <p>
          <strong>{t("config.stage.target")}</strong> <span className="mono muted">{c.targetDriver}</span>
        </p>
        <p className="muted">{c.dedup !== "" ? `dedup ${c.dedup}` : t("config.stage.appends")}</p>
      </li>
    </ol>
  );
}

function Cell({ r }: { r: CfgRow }) {
  const { t } = useT();
  return (
    <td className="mono" title={r.note ? `${r.value}\n${r.note}` : r.value}>
      {r.value}
      {r.default && <span className="muted"> ({t("config.default")})</span>}
    </td>
  );
}

/** A step's configuration in tabs: Summary and Destination always, the others when they have something. */
export function StepConfigPanel({ c }: { c: StepConfig }) {
  const { t } = useT();
  const tabs: HashTab[] = [
    {
      key: "summary",
      label: t("config.tab.summary"),
      panel: (
        <>
          <p className="lc-pad">{c.summary}</p>
          <Stage c={c.stage} />
          {c.flow && <FlowDiagram flow={c.flow} />}
          {c.note !== "" && (
            <div className="lc-pad">
              <Note text={c.note} />
            </div>
          )}
          {c.other.map((s) => (
            <div key={s.title}>
              <h4 className="lc-pad">{s.title}</h4>
              <CfgRows rows={s.rows} />
            </div>
          ))}
        </>
      ),
    },
  ];
  if (c.sourceHead.length > 0 || c.sourceCount > 0) {
    tabs.push({
      key: "sources",
      label: `${t("config.tab.sources")}${c.sourceCount > 0 ? ` ${c.sourceCount}` : ""}`,
      panel: (
        <>
          <CfgRows rows={c.sourceHead} />
          {c.sourceCount > 0 && (
            <>
              <p className="lc-pad lc-common">
                <strong>{t("config.common", { n: c.sourceCount })}</strong>
                {c.common.length === 0 && <span className="muted">{t("config.common.none")}</span>}
                {c.common.map((r) => (
                  <span key={r.label} className="mono lc-chip" title={r.note}>
                    <span className="muted">{r.label}</span> {r.value}
                    {r.default && <span className="muted"> ({t("config.default")})</span>}
                  </span>
                ))}
              </p>
              {c.varying.length > 0 && (
                <div className="lc-scroll">
                  <table className="lc-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {c.varying.map((k) => (
                          <th key={k}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.sources.map((s) => (
                        <tr key={s.index}>
                          <td className="mono muted">{s.index}</td>
                          {s.cells.map((cell, i) => (cell ? <Cell key={i} r={cell} /> : <td key={i} className="muted">—</td>))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      ),
    });
  }
  if (c.transform.length > 0) {
    tabs.push({
      key: "transform",
      label: `${t("config.tab.transform")} ${c.transform.length}`,
      panel: (
        <ol className="lc-ops">
          {c.transform.map((op) => (
            <li key={op.index}>
              <span className="mono muted">{op.index}</span>
              <div>
                {op.rows.map((r) => (
                  <div key={r.path} className="lc-op" data-path={r.path}>
                    <span className="mono muted">{r.label.replace(`${op.index}.`, "")}</span>{" "}
                    <span className="mono">{r.list.length > 0 ? r.list.join(" · ") : r.value}</span>
                    {r.note !== "" && <Note text={r.note} />}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      ),
    });
  }
  tabs.push({
    key: "destination",
    label: t("config.tab.destination"),
    panel: (
      <>
        <div className="lc-pad">
          <DefinitionList
            items={[
              { term: t("config.identity.kind"), value: c.identity.legacy ? t("config.identity.legacy") : c.identity.kind || "—", mono: true },
              { term: t("config.identity.where"), value: c.identity.where || "—", mono: true },
              { term: t("config.identity.object"), value: c.identity.object, mono: true },
            ]}
          />
        </div>
        <CfgRows rows={c.destination} />
      </>
    ),
  });
  if (c.hasSchema) {
    tabs.push({
      key: "schema",
      label: `${t("config.tab.schema")}${c.schema.length > 0 ? ` ${c.schema.length}` : ""}`,
      panel: (
        <>
          {c.schema.length > 0 && (
            <div className="lc-scroll">
              <table className="lc-table">
                <thead>
                  <tr>
                    <th>{t("config.schema.column")}</th>
                    <th>{t("config.schema.type")}</th>
                    <th>{t("config.schema.role")}</th>
                  </tr>
                </thead>
                <tbody>
                  {c.schema.map((col) => (
                    <tr key={col.name}>
                      <td className="mono">{col.name}</td>
                      <td className="mono muted">{col.type}</td>
                      <td className="muted">{col.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CfgRows rows={c.schemaExtra} />
        </>
      ),
    });
  }
  return <HashTabs id="load-config" label={t("config.title")} tabs={tabs} />;
}
