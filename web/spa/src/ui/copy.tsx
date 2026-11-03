import { useState } from "react";

/** Copies `text` to the clipboard and says so for a moment. A blocked clipboard leaves the button inert. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      aria-label={label}
      title={label}
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          })
          .catch(() => {});
      }}
    >
      {done ? "✓" : "⧉"}
      <span aria-live="polite" className="sr-only">
        {done ? "✓" : ""}
      </span>
    </button>
  );
}
