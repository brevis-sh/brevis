import "./panel.css";
/**
 * What a destination is made of, as a small chip with its scheme. The server's
 * pages draw the product's logo here; the logos are not in the app yet.
 */
export function KindMark({ kind }: { kind: string }) {
  return (
    <span className="kind-mark" aria-hidden="true" title={kind}>
      {(kind || "file").slice(0, 3)}
    </span>
  );
}
