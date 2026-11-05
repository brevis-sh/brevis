import { useMsg, type Msg } from "../i18n";

/**
 * What the server may send where a screen shows words: a name or value the data owns (a string, shown as it is), a
 * message the app says in the reader's language, or several of those that read as one passage (joined by a space).
 */
export type Said = string | Msg | readonly (string | Msg)[] | null | undefined;

/** useSaid()(x): the words of a `Said`, in the reader's language ("" for none). */
export function useSaid() {
  const msg = useMsg();
  return (v: Said): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return (v as readonly (string | Msg)[]).map((x) => (typeof x === "string" ? x : msg(x))).join(" ");
    return msg(v as Msg);
  };
}
