import { useEffect, useRef, type ReactNode } from "react";
import { useT } from "../i18n";
import { CopyButton } from "./copy";
import { Icon } from "./icon";

/** A stream or an endpoint in three steps, for somebody who has not set one up. */
export function HowSteps({ steps }: { steps: { kicker: string; title: string; text: ReactNode }[] }) {
  return (
    <ol className="mt-4 grid grid-cols-1 overflow-hidden rounded-card border border-line bg-surface min-[860px]:grid-cols-3">
      {steps.map((s) => (
        <li key={s.kicker} className="border-line-soft px-4 py-3.5 not-first:border-t min-[860px]:not-first:border-t-0 min-[860px]:not-first:border-l">
          <p className="text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{s.kicker}</p>
          <p className="mt-1 text-[13px] font-semibold text-ink">{s.title}</p>
          <p className="mt-1 text-[12.5px] text-muted">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/** A titled block of text to copy: a file, a command. */
function CopyBlock({ title, text }: { title: string; text: string }) {
  const { t } = useT();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-muted">{title}</span>
        <CopyButton text={text} label={t("loads.drawer.copy")} />
      </div>
      <pre className="overflow-x-auto rounded-card border border-line-soft bg-canvas px-3 py-2 font-mono text-[12px] text-ink-2">
        <code>{text}</code>
      </pre>
    </div>
  );
}

/**
 * A side drawer that says how a thing is made and makes nothing: the thing is
 * declared in a file and published from there, so a form here would be a
 * second source of truth. A native <dialog>, closed by Escape or the backdrop.
 */
export function HowDrawer({
  open, onClose, title, lead, blocks, note,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  lead: string;
  blocks: { title: string; text: string }[];
  note: string;
}) {
  const { t } = useT();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="how-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="run-drawer fixed inset-y-0 right-0 left-auto m-0 h-full max-h-none w-[min(560px,100vw)] border-l border-line bg-surface p-0 text-ink backdrop:bg-ink/40"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p id="how-title" className="text-[15px] font-semibold text-ink">{title}</p>
            <p className="mt-1 text-[12.5px] text-muted">{lead}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("dialog.close")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-card text-muted transition-colors hover:bg-surface-2 hover:text-ink">
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 text-[12.5px]">
          {blocks.map((b) => (
            <CopyBlock key={b.title} {...b} />
          ))}
          <p className="text-muted">{note}</p>
        </div>
      </div>
    </dialog>
  );
}
