import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

/**
 * Filters live in the URL, under the old page's parameter names, so a filtered
 * screen is a link somebody can send. `fields` fixes the order they are
 * written in: one filter has exactly one URL.
 */
export function useFilter(fields: readonly string[], path: string) {
  const [params] = useSearchParams();
  const get = (f: string) => params.get(f) ?? "";
  const hrefWith = (change: Record<string, string>, to = path, extra: Record<string, string> = {}) => {
    const q = new URLSearchParams();
    for (const f of fields) {
      const v = f in change ? change[f] : get(f);
      if (v) q.set(f, v);
    }
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    const s = q.toString();
    return s ? `${to}?${s}` : to;
  };
  return { get, hrefWith, any: fields.some((f) => get(f) !== "") };
}

/**
 * The search box: it keeps what is typed, and moves the URL a beat after the
 * last key (replacing the history entry, so typing does not fill the back
 * button). The list under it keeps its old rows until the answer arrives.
 */
export function useSearchBox(value: string, apply: (q: string) => string) {
  const navigate = useNavigate();
  const [text, setText] = useState(value);
  const last = useRef(value);
  // An outside change (a link, back) replaces what is typed.
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value);
    }
  }, [value]);
  useEffect(() => {
    if (text.trim() === last.current) return;
    const id = setTimeout(() => {
      last.current = text.trim();
      navigate(apply(text.trim()), { replace: true });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return [text, setText] as const;
}
