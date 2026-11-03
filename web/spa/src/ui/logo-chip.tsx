import type { Logo } from "../api/workflows";
import "./wf-ui.css";

// LogoChip stands for a language, tool or connector. The server holds the
// brand marks; until they are served as images, the chip is the name's first
// letters with the full name for assistive tech and the tooltip.
export function LogoChip({ logo }: { logo: Logo }) {
  const mono = logo.name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2);
  return (
    <span className="logo-chip" title={logo.name} role="img" aria-label={logo.name}>
      {mono}
    </span>
  );
}

export function LogoList({ logos }: { logos: Logo[] }) {
  return (
    <span className="logo-list">
      {logos.map((l) => (
        <LogoChip key={l.key} logo={l} />
      ))}
    </span>
  );
}
