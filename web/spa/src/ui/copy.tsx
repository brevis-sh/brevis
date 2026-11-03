import { Icon } from "./icon";
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

/** The 18px Copy beside a value (web/components CopyIcon); the caller decides when it shows. */
export function CopyIcon({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() =>
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        })
      }
      className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] text-muted hover:bg-surface-2 hover:text-ink"
    >
      <Icon name={done ? "check" : "copy"} className="h-3 w-3" />
    </button>
  );
}
