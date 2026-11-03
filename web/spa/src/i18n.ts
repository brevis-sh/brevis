import { useSuspenseQuery } from "@tanstack/react-query";
import { getJSON } from "./api/client";
import { useSession } from "./api/session";

type Message = string | { one: string; other: string };
type Bundle = { lang: string; messages: Record<string, Message> };
export type Vars = Record<string, string | number>;

// Same rule as the server's fill (web/i18n): a named placeholder is replaced
// when given, and left as written when not, so a missing variable is visible.
function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

// The catalog is the server's own (/api/messages, English filling what a
// language lacks), keyed by language so a change of language loads the new one.
// Revalidated on load (the server answers 304 when nothing changed).
export function useT() {
  const { lang } = useSession();
  const { messages } = useSuspenseQuery({
    queryKey: ["messages", lang],
    queryFn: ({ signal }) => getJSON<Bundle>("/api/messages", signal),
    staleTime: Infinity,
  }).data;

  const pick = (key: string, count?: number): string => {
    const m = messages[key];
    if (m === undefined) return `[${key}]`; // the server's mark for a missing key
    if (typeof m === "string") return m;
    return count === 1 ? m.one : m.other;
  };

  return {
    lang,
    /** t("nav.projects"), t("run.wait.since", { at }) */
    t: (key: string, vars?: Vars) => fill(pick(key), vars),
    /** n("nav.catalog.attention", 3): the plural form, with {count} filled. */
    n: (key: string, count: number, vars?: Vars) => fill(pick(key, count), { count, ...vars }),
  };
}

/** Numbers, dates and "x ago" in the reader's language (Intl, not the server's format.go). */
export function useFormat() {
  const { lang } = useSession();
  return {
    number: (v: number) => new Intl.NumberFormat(lang).format(v),
    date: (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(iso)),
    dateTime: (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)),
    since: (iso: string, now = Date.now()) => {
      const s = Math.round((new Date(iso).getTime() - now) / 1000);
      const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
      const abs = Math.abs(s);
      if (abs < 60) return rtf.format(s, "second");
      if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
      if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
      return rtf.format(Math.round(s / 86400), "day");
    },
  };
}
