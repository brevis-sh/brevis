import type { Flow } from "../api/ingest";
import { useT } from "../i18n";
import "./flow.css";

/**
 * How data reaches a destination, as the configuration declares it: nodes left
 * to right (top to bottom on a phone), the destination marked, and the dead
 * letter as a dashed branch under it. Words arrive finished from the server.
 */
export function FlowDiagram({ flow }: { flow: Flow }) {
  const { t } = useT();
  const title = (kind: string) => t(`flow.${kind}`);
  return (
    <div className="flow">
      <ol>
        {flow.nodes.map((n, i) => (
          <li key={i} data-kind={n.kind}>
            <p className="flow-kicker">
              {i + 1} · {title(n.kind)}
            </p>
            <p className="mono flow-main">{n.main}</p>
            {n.detail !== "" && <p className="muted flow-detail">{n.detail}</p>}
          </li>
        ))}
      </ol>
      {flow.deadLetter && (
        <div className="flow-dl">
          <p className="flow-kicker">{title(flow.deadLetter.kind)}</p>
          <p className="mono flow-main">{flow.deadLetter.main}</p>
          <p className="flow-detail">{flow.deadLetter.detail}</p>
        </div>
      )}
    </div>
  );
}
