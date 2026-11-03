import "./wf-ui.css";

// ToggleSwitch is an on/off control that acts at once (a switch, not a form
// field): the label says what pressing does.
export function ToggleSwitch({ on, label, busy, onToggle }: { on: boolean; label: string; busy?: boolean; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} disabled={busy} className="switch" onClick={onToggle} />
  );
}
