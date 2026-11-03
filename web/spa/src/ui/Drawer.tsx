import { useEffect, type ReactNode } from "react";

type Props = { open: boolean; onClose: () => void; label: string; children: ReactNode };

// A side panel that is simply a column from 768px up and an overlay below it
// (the CSS decides; see ui.css). Escape and the backdrop close it.
export function Drawer({ open, onClose, label, children }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />}
      <aside className="drawer" data-open={open} aria-label={label}>
        {children}
      </aside>
    </>
  );
}
