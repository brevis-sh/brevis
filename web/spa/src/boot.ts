import type { QueryClient } from "@tanstack/react-query";
import { getJSON } from "./api/client";
import type { Config, Session } from "./api/session";
import { bindOperator } from "./ui/seen";

type Messages = { lang: string; messages: Record<string, unknown> };

// WHAT IS STATIC MUST NOT WAIT. The menu, the titles and the labels are words
// from the catalog, and the brand and the session are known before any screen
// asks for data. So the three are read once, in parallel, BEFORE the first
// render and put in the query cache: from then on useT(), useSession() and
// useConfig() answer at once and never suspend. A skeleton is for what a screen
// loads (rows, numbers, charts), never for a heading or a link.
export async function boot(client: QueryClient): Promise<void> {
  const [session, config, messages] = await Promise.all([
    getJSON<Session>("/api/session"),
    getJSON<Config>("/api/config"),
    getJSON<Messages>("/api/messages"),
    // The faces the screens use, fetched alongside: font-display is swap, so a face that lands after
    // the first paint re-wraps every line (a whole screen's text moves). Capped, so a slow font
    // costs a short wait, not a blank page.
    Promise.race([
      Promise.all(['400 1em "IBM Plex Sans"', '500 1em "IBM Plex Sans"', '600 1em "IBM Plex Sans"', '400 1em "IBM Plex Mono"', '500 1em "IBM Plex Mono"'].map((f) => document.fonts.load(f))),
      new Promise((done) => setTimeout(done, 400)),
    ]).catch(() => undefined),
  ]);
  // The client's theme goes in BEFORE the first render: applied from an effect it
  // would paint one frame in the default colours first.
  if (config.brand.css) {
    const el = document.createElement("style");
    el.dataset.brand = "";
    el.textContent = config.brand.css;
    document.head.appendChild(el);
  }
  // index.html says "en"; the visitor's language is what screen readers and hyphenation follow.
  document.documentElement.lang = session.lang;
  bindOperator(session.operator);
  client.setQueryData(["session"], session);
  client.setQueryData(["config"], config);
  client.setQueryData(["messages", session.lang], messages);
}
