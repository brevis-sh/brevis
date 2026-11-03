import { Fragment } from "react";
import { useFormat, useT } from "../i18n";

type Note = { head: string; rest: string };
type Node = { kind: string; main: string; detail: string };
export type WriterConfig = {
  key: string;
  gateway: string;
  stream: string;
  role: string;
  publishedAt: string | null;
  workflow: string;
  node: string;
  described: boolean;
  summary: string;
  flow: Node[];
  flowDeadLetter: Node | null;
  deadLetter: { where: string; readable: boolean; commands: string; write: string } | null;
  note: Note | null;
  sections: {
    title: string;
    note: Note | null;
    rows: { path: string; label: string; value: string; default: boolean; note: Note | null; before: { label: string; note: Note }[] }[];
  }[];
  changes: { at: string; runId: string; first: boolean; lines: { path: string; text: string }[] }[];
};

/** A comment from the config file: one line whole, a longer one folded to its first line. */
function ConfigNote({ note }: { note: Note }) {
  if (!note.rest) return <p className="cfg-note">{note.head}</p>;
  return (
    <details className="cfg-note">
      <summary>{note.head}</summary>
      <p>{note.rest}</p>
    </details>
  );
}

function Flow({ nodes, dead }: { nodes: Node[]; dead: Node | null }) {
  const { t } = useT();
  if (nodes.length === 0) return null;
  return (
    <div>
      <ol className="cfg-flow" style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {nodes.map((n, i) => (
          <li key={i} className={`cfg-node ${n.kind === "destination" ? "dest" : ""}`}>
            <p className="t">
              {i + 1} · {t(`flow.${n.kind}`)}
            </p>
            <p className="m">{n.main}</p>
            {n.detail && <p className="d">{n.detail}</p>}
          </li>
        ))}
      </ol>
      {dead && (
        <div className="cfg-node dead" style={{ marginTop: ".6rem" }}>
          <p className="t" style={{ color: "var(--st-bad)" }}>
            {t(`flow.${dead.kind}`)}
          </p>
          <p className="m">{dead.main}</p>
          <p className="d" style={{ color: "var(--st-bad)" }}>
            {dead.detail}
          </p>
        </div>
      )}
    </div>
  );
}

function DeadLetter({ dl }: { dl: NonNullable<WriterConfig["deadLetter"]> }) {
  const { t } = useT();
  return (
    <div>
      <h4>{t("deadletter.commands.title")}</h4>
      <p className="cfg-note">{t("deadletter.goes", { where: dl.where })}</p>
      {dl.readable ? (
        <>
          <p className="cfg-note">{t("deadletter.commands.where")}</p>
          <pre className="mono" style={{ overflowX: "auto", margin: ".4rem 0", padding: ".5rem", border: "1px solid var(--line)", borderRadius: ".4rem", background: "var(--card)" }}>
            {dl.commands}
          </pre>
          <p className="cfg-note">{t(dl.write === "append" ? "deadletter.resend.append" : dl.write === "merge" ? "deadletter.resend.merge" : "deadletter.resend.other")}</p>
        </>
      ) : (
        <p className="cfg-note">{t("deadletter.unreadable")}</p>
      )}
    </div>
  );
}

function One({ c }: { c: WriterConfig }) {
  const { t } = useT();
  const f = useFormat();
  return (
    <section className="cfg" data-config={c.key}>
      <div className="cfg-head">
        <h3>{t("config.title")}</h3>
        <span className="cat-muted">
          {c.gateway ? (
            <>
              gateway <strong>{c.gateway}</strong> · <span className="mono">{c.stream}</span> · {c.role} ·{" "}
              {t("config.published", { at: c.publishedAt ? f.dateTime(c.publishedAt) : "" })}
            </>
          ) : (
            <>
              {t("config.step")} <a href={`/workflows/${encodeURIComponent(c.workflow)}`}>{c.workflow}</a> · {c.node}
            </>
          )}
        </span>
      </div>
      {!c.described ? (
        <p className="cfg-box" style={{ padding: ".65rem .8rem", fontSize: ".75rem" }}>
          {t("config.undescribed")} <a href={`/workflows/${encodeURIComponent(c.workflow)}`}>{t("config.definition")}</a>.
        </p>
      ) : (
        <div className="cfg-box">
          <p style={{ margin: 0, fontSize: ".82rem" }}>{c.summary}</p>
          {c.flow.length > 0 && <Flow nodes={c.flow} dead={c.flowDeadLetter} />}
          {c.deadLetter && <DeadLetter dl={c.deadLetter} />}
          {c.note && (
            <div>
              <ConfigNote note={c.note} />
            </div>
          )}
          {c.sections.map((s) => (
            <div key={s.title}>
              <h4>{s.title}</h4>
              {s.note && <ConfigNote note={s.note} />}
              {s.rows.map((r) => (
                <Fragment key={r.path}>
                  {r.before.map((b) => (
                    <div key={b.label} style={{ margin: ".5rem 0 .2rem" }}>
                      <span className="mono">{b.label}</span>
                      <ConfigNote note={b.note} />
                    </div>
                  ))}
                  <div className="cfg-row" data-path={r.path}>
                    <div className="k">{r.label}</div>
                    <div>
                      {r.value === "" ? <span className="cat-muted">{t("config.empty")}</span> : <span className="v">{r.value}</span>}
                      {r.default && (
                        <span className="cfg-def" title={t("config.default.tip")}>
                          {t("config.default")}
                        </span>
                      )}
                      {r.note && <ConfigNote note={r.note} />}
                    </div>
                  </div>
                </Fragment>
              ))}
            </div>
          ))}
          {c.changes.length > 0 && (
            <div>
              <h4>{t("config.changes")}</h4>
              <ol className="cfg-changes">
                {c.changes.map((ch) => (
                  <li key={ch.at}>
                    <span className="cat-muted">{f.dateTime(ch.at)}</span>
                    {ch.runId && (
                      <a href={`/runs/${ch.runId}`} className="mono" style={{ marginLeft: ".5rem" }}>
                        {t("config.run", { run: ch.runId.slice(0, 8) })}
                      </a>
                    )}
                    {ch.first && c.gateway ? (
                      <span className="cat-muted"> {t("config.first_published")}</span>
                    ) : ch.first ? (
                      <span className="cat-muted"> {t("config.first_recorded")}</span>
                    ) : ch.lines.length === 0 ? (
                      <span className="cat-muted"> {t("config.earlier")}</span>
                    ) : null}
                    {ch.lines.length > 0 && (
                      <ul>
                        {ch.lines.map((l) => (
                          <li key={l.path}>
                            <span className="mono cat-muted">{l.path}</span> <span className="mono">{l.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** How each writer of a destination is configured: its settings by section, the defaults marked. */
export function Configurations({ configs }: { configs: WriterConfig[] }) {
  return (
    <>
      {configs.map((c) => (
        <One key={c.key} c={c} />
      ))}
    </>
  );
}
