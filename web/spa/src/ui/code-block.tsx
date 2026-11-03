import { useState } from "react";
import { useT } from "../i18n";
import "./code-block.css";

/** A command to copy: it wraps rather than scrolls, so its end is never hidden. */
export function CodeBlock({ text, label }: { text: string; label?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no clipboard (insecure origin): the text is selectable */
    }
  };
  return (
    <div className="code">
      <pre aria-label={label}>{text}</pre>
      <button type="button" className="btn btn-quiet" onClick={copy} aria-live="polite">
        {copied ? "✓" : t("catalog.drawer.copy").split(" ")[0]}
      </button>
    </div>
  );
}
