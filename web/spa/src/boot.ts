import type { QueryClient } from "@tanstack/react-query";
import { getJSON } from "./api/client";
import type { Config, Session } from "./api/session";

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
  ]);
  client.setQueryData(["session"], session);
  client.setQueryData(["config"], config);
  client.setQueryData(["messages", session.lang], messages);
}
