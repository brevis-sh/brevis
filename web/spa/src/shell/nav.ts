// THE SHELL'S MAP: what the sidebar lists and where the topbar's breadcrumb says
// a page sits. Same list as web/layouts/nav.go (one list for two readers).
//
// ROUTE-HANDLE CONVENTION. A screen declares where it sits with ONE LINE in
// `routeMeta` below: `{ path: "/ingest/loads", section: "loads" }`.
//   - path:    the route's pattern as in main.tsx, without the /app basename.
//   - section: a nav key (the `nav.<key>` message). It lights that sidebar item
//              and gives the breadcrumb its Group / Section.
//   - detail:  true when the page is deeper than its section (one workflow, one
//              run). The breadcrumb then ends on the page's own name, which comes
//              from data, so the screen says it with `useCrumb(name)` (or
//              `useCrumb(id, { mono: true })` for an identifier). Until it does,
//              the breadcrumb ends on the section.
// The table lives here, not on each <Route>, so a new screen does not touch
// main.tsx's route list for this and screens do not collide on it.

import { matchPath } from "react-router";
import { useEffect, useSyncExternalStore } from "react";

export type Section = { key: string; href: string; icon: string; goKey?: string };
export type Group = { key: string; sections: Section[] };

/** The sidebar, by what somebody came to do. SQL only where a service is configured. */
export function groups(sql: boolean): Group[] {
  const data: Section[] = [
    { key: "catalog", href: "/data", icon: "database", goKey: "d" },
    { key: "endpoints", href: "/data/endpoints", icon: "plug" },
  ];
  if (sql) data.push({ key: "sql", href: "/sql", icon: "terminal", goKey: "s" });
  return [
    {
      key: "monitor",
      sections: [
        { key: "overview", href: "/", icon: "layout-grid", goKey: "o" },
        { key: "runs", href: "/runs", icon: "history", goKey: "e" },
      ],
    },
    { key: "orchestrate", sections: [{ key: "workflows", href: "/workflows", icon: "workflow", goKey: "w" }] },
    {
      key: "ingest",
      sections: [
        { key: "streams", href: "/ingest/streams", icon: "cloud", goKey: "t" },
        { key: "loads", href: "/ingest/loads", icon: "download" },
      ],
    },
    { key: "data", sections: data },
  ];
}

/** The project switcher's place: not a section, so it sits under no group. */
export const projectsSection: Section = { key: "projects", href: "/projects", icon: "folder" };

export type RouteMeta = { path: string; section: string; detail?: boolean };

export const routeMeta: RouteMeta[] = [
  { path: "/", section: "overview" },
  { path: "/runs", section: "runs" },
  { path: "/runs/:id", section: "runs", detail: true },
  { path: "/projects", section: "projects" },
  { path: "/sql", section: "sql" },
  { path: "/workflows", section: "workflows" },
  { path: "/workflows/:slug", section: "workflows", detail: true },
  { path: "/ingest/streams", section: "streams" },
  { path: "/ingest/streams/:gateway/*", section: "streams", detail: true },
  { path: "/ingest/loads", section: "loads" },
  { path: "/ingest/loads/:workflow/:step", section: "loads", detail: true },
  { path: "/data", section: "catalog" },
  { path: "/data/target", section: "catalog", detail: true },
  { path: "/data/endpoints", section: "endpoints" },
  { path: "/data/endpoints/:api/:name", section: "endpoints", detail: true },
];

export function metaFor(pathname: string): RouteMeta | undefined {
  return routeMeta.find((m) => matchPath({ path: m.path, end: true }, pathname));
}

// The page's own name for the breadcrumb's last item, set by the open screen.
type Crumb = { text: string; mono: boolean } | null;
let crumb: Crumb = null;
const listeners = new Set<() => void>();
const setCrumb = (c: Crumb) => {
  crumb = c;
  listeners.forEach((l) => l());
};
export const useCurrentCrumb = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => void listeners.delete(l)),
    () => crumb,
  );

/** Name the open page in the breadcrumb: useCrumb(workflow.name). Pass "" while the name is loading. */
export function useCrumb(text: string, opts: { mono?: boolean } = {}) {
  const mono = !!opts.mono;
  useEffect(() => {
    if (!text) return;
    const mine = { text, mono };
    setCrumb(mine);
    return () => {
      if (crumb === mine) setCrumb(null);
    };
  }, [text, mono]);
}
