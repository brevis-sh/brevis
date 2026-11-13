/** One run of log text and the SGR styles in force over it. */
export type AnsiSpan = { text: string; fg?: number; bold?: boolean; dim?: boolean; italic?: boolean; underline?: boolean };

// ESC [ params final-byte: SGR ends in "m"; any other CSI (cursor moves, erase) is dropped.
const CSI = /\x1b\[([0-9;]*)([@-~])/g;
// Any leftover ESC (a lone one, or a non-CSI sequence's intro) is invisible noise.
const STRAY = /\x1b/g;

/** The line as a reader sees it: no escape sequences. Search and copy work on this. */
export const stripAnsi = (s: string) => s.replace(CSI, "").replace(STRAY, "");

/**
 * Splits a line into styled spans. Colors are the 16 standard ones (0-7, with bright as 8-15);
 * 256-color and truecolor are consumed and ignored: the console's palette is its own, so a
 * tool's exact RGB would not hold contrast on both themes.
 * shortcut: styles reset at each line, upgrade if a tool is seen carrying a style across lines.
 */
export function parseAnsi(line: string): AnsiSpan[] {
  const out: AnsiSpan[] = [];
  let st: Omit<AnsiSpan, "text"> = {};
  const push = (text: string) => text && out.push({ text: text.replace(STRAY, ""), ...st });
  let at = 0;
  for (const m of line.matchAll(CSI)) {
    push(line.slice(at, m.index ?? at));
    at = (m.index ?? at) + m[0].length;
    if (m[2] !== "m") continue;
    const p = !m[1] ? [0] : m[1].split(";").map((x) => Number(x) || 0);
    for (let i = 0; i < p.length; i++) {
      const c = p[i]!;
      if (c === 0) st = {};
      else if (c === 1) st = { ...st, bold: true };
      else if (c === 2) st = { ...st, dim: true };
      else if (c === 3) st = { ...st, italic: true };
      else if (c === 4) st = { ...st, underline: true };
      else if (c === 22) st = { ...st, bold: false, dim: false };
      else if (c === 23) st = { ...st, italic: false };
      else if (c === 24) st = { ...st, underline: false };
      else if (c >= 30 && c <= 37) st = { ...st, fg: c - 30 };
      else if (c >= 90 && c <= 97) st = { ...st, fg: c - 90 + 8 };
      else if (c === 39) st = { ...st, fg: undefined };
      else if (c === 38 || c === 48) i += p[i + 1] === 5 ? 2 : p[i + 1] === 2 ? 4 : 0;
    }
  }
  push(line.slice(at));
  return out;
}

/** CSS classes for a span; the colors live in styles.css, on the theme's own tokens. */
export const ansiClass = (s: AnsiSpan) =>
  [s.fg !== undefined && `ansi-${s.fg}`, s.bold && "font-semibold", s.dim && "opacity-70", s.italic && "italic", s.underline && "underline"]
    .filter(Boolean)
    .join(" ") || undefined;
