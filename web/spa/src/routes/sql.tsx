import { Suspense, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ApiError, getJSON, postJSON } from "../api/client";
import { useSession } from "../api/session";
import { useFormat, useT } from "../i18n";
import { CodeEditor } from "../ui/CodeEditor";
import { DataGrid } from "../ui/DataGrid";
import { Drawer } from "../ui/Drawer";
import { Tree, type TreeItem } from "../ui/Tree";
import { Skeleton } from "../ui/skeleton";
import "./sql.css";

type Connection = { name: string; target: string; queryable: boolean };
type TreeData = { schemas: { name: string; tables: string[] }[]; cut: boolean; writable: boolean };
type State = {
  connections: Connection[];
  unreadable: string[];
  target: string;
  statement: string;
  preloaded: boolean;
  tree: TreeData;
};
type Result = {
  columns: string[];
  rows: unknown[][];
  truncated: boolean;
  bytes: number;
  ms: number;
  wrote: boolean;
  changed: number | null;
};
type Price = { state: "priced" | "unpriced" | "refused"; bytes: number; why: string };
type Entry = { text: string; outcome: "ok" | "failed"; cost: string };

// The same keys the server-rendered workbench writes, so History carries over.
const RECENT = "brevis.workbench.recent";
const DRAFT = "brevis.spa.sql.draft";
const KEEP = 20;

function recall(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode or a full quota: the screen works, it just forgets.
  }
}
function recent(): Entry[] {
  try {
    const list: unknown = JSON.parse(recall(RECENT) ?? "[]");
    return Array.isArray(list) ? (list as Entry[]).filter((e) => typeof e?.text === "string").slice(0, KEEP) : [];
  } catch {
    return [];
  }
}

function csvField(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Same file as the server-rendered page's: a byte-order mark leads so a
// spreadsheet reads it as UTF-8.
function downloadCSV(res: Result) {
  const lines = [res.columns.map(csvField).join(","), ...res.rows.map((r) => r.map(csvField).join(","))];
  const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `query-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useBytes() {
  const { lang } = useSession();
  const f = useFormat();
  return (n: number) => {
    for (const [size, unit] of [[2 ** 40, "TB"], [2 ** 30, "GB"], [2 ** 20, "MB"], [2 ** 10, "kB"]] as const) {
      if (n >= size) return `${new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n / size)} ${unit}`;
    }
    return `${f.number(n)} B`;
  };
}

// The same grid for the screen and for its skeleton.
export function SqlSkeleton() {
  return (
    <div className="wb" aria-busy="true">
      <div className="wb-rail" aria-hidden="true">
        <Skeleton h="1.6rem" />
        <Skeleton h="1.2rem" />
        <Skeleton h="1.2rem" w="80%" />
        <Skeleton h="1.2rem" w="70%" />
      </div>
      <div className="wb-main" aria-hidden="true">
        <Skeleton h="12rem" />
        <Skeleton h="100%" />
      </div>
    </div>
  );
}

function Rail({ state, tree, target, setTarget, onSelect, onClose }: {
  state: State;
  tree: TreeData | undefined;
  target: string;
  setTarget: (t: string) => void;
  onSelect: (sql: string) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [filter, setFilter] = useState("");
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  // Which relation is open: columns are fetched only when somebody opens one.
  const [open, setOpen] = useState("");
  const [schema, name] = open.split(/\.(.*)/s);
  const cols = useQuery({
    queryKey: ["sql", "columns", target, open],
    enabled: open !== "",
    queryFn: ({ signal }) =>
      getJSON<{ columns: { name: string; type: string }[] }>(
        `/api/sql/describe?target=${encodeURIComponent(target)}&schema=${encodeURIComponent(schema ?? "")}&name=${encodeURIComponent(name ?? "")}`,
        signal,
      ),
    staleTime: 60_000,
  });

  const items = useMemo(() => {
    const out: TreeItem[] = [];
    const q = filter.trim().toLowerCase();
    for (const s of tree?.schemas ?? []) {
      const tables = q ? s.tables.filter((x) => `${s.name}.${x}`.toLowerCase().includes(q)) : s.tables;
      if (q && tables.length === 0) continue;
      const sid = `s:${s.name}`;
      const sopen = q !== "" || !shut[sid];
      out.push({ id: sid, level: 1, expandable: true, expanded: sopen, label: <><span aria-hidden="true">{sopen ? "▾" : "▸"}</span><span className="tr-name">{s.name}</span></> });
      if (!sopen) continue;
      for (const tb of tables) {
        const rid = `${s.name}.${tb}`;
        const ropen = opened[rid] === true;
        out.push({ id: `t:${rid}`, parent: sid, level: 2, expandable: true, expanded: ropen, label: <><span aria-hidden="true">{ropen ? "▾" : "▸"}</span><span className="tr-name mono">{tb}</span></> });
        if (!ropen) continue;
        const list = open === rid ? cols.data?.columns : undefined;
        if (!list) {
          out.push({ id: `c:${rid}:`, parent: `t:${rid}`, level: 3, label: <span className="muted">…</span> });
        } else if (list.length === 0) {
          out.push({ id: `c:${rid}:`, parent: `t:${rid}`, level: 3, label: <span className="muted">{t("sql.tree.no_columns")}</span> });
        }
        for (const c of list ?? []) {
          out.push({ id: `c:${rid}:${c.name}`, parent: `t:${rid}`, level: 3, label: <><span className="tr-name mono">{c.name}</span><span className="muted mono tr-type">{c.type}</span></> });
        }
      }
    }
    return out;
  }, [tree, filter, shut, opened, open, cols.data, t]);

  const toggle = (id: string) => {
    if (id.startsWith("s:")) setShut((m) => ({ ...m, [id]: m[id] !== true }));
    else if (id.startsWith("t:")) {
      const rid = id.slice(2);
      setOpened((m) => ({ ...m, [rid]: !m[rid] }));
      if (!opened[rid]) setOpen(rid);
    }
  };
  const activate = (id: string) => {
    if (id.startsWith("t:")) {
      // A table is its first look, written in the box and run by nobody.
      onSelect(`SELECT *\nFROM ${id.slice(2)}\nLIMIT 100;`);
      onClose();
    } else if (id.startsWith("s:")) toggle(id);
  };

  return (
    <>
      <h2 className="wb-h">{t("sql.tree.title")}</h2>
      <label className="wb-field">
        <span className="sr-only">{t("sql.tree.connection")}</span>
        <select value={target} onChange={(e) => setTarget(e.target.value)} className="mono">
          {state.connections.map((c) => (
            <option key={c.target} value={c.target} disabled={!c.queryable}>{c.name}</option>
          ))}
        </select>
      </label>
      {state.unreadable.length > 0 && (
        <p className="muted wb-small">{t("sql.tree.unreadable", { kinds: state.unreadable.join(", ") })}</p>
      )}
      <input type="search" className="wb-field" value={filter} onChange={(e) => setFilter(e.target.value)}
        placeholder={t("sql.tree.filter")} aria-label={t("sql.tree.filter")} />
      {!tree ? <Skeleton h="1.2rem" /> : <Tree items={items} label={t("sql.tree.title")} onToggle={toggle} onActivate={activate} />}
      {tree?.cut && <p className="muted wb-small">{t("sql.tree.cut")}</p>}
    </>
  );
}

function CostLine({ target, statement, skip }: { target: string; statement: string; skip: string }) {
  const { t } = useT();
  const bytes = useBytes();
  const priced = useRef(skip);
  const [price, setPrice] = useState<Price | null>(null);

  // Priced after a pause, never twice for the same text, and not on load: what
  // is in the box on arrival is not worth an API call.
  useEffect(() => {
    const text = statement.trim();
    if (text === "" || target === "") {
      priced.current = "";
      setPrice(null);
      return;
    }
    if (text === priced.current) return;
    const ctrl = new AbortController();
    const wait = setTimeout(() => {
      priced.current = text;
      // A service that cannot be reached says nothing about the SQL: the line
      // goes quiet rather than red.
      postJSON<Price>("/api/sql/cost", { target, q: text }, ctrl.signal).then((p) => setPrice(p ?? null), () => setPrice(null));
    }, 600);
    return () => {
      clearTimeout(wait);
      ctrl.abort();
    };
  }, [statement, target]);

  return (
    <p className="wb-cost muted" aria-live="polite">
      {price?.state === "priced" && <span>{t("sql.cost.priced")} <strong>{bytes(price.bytes)}</strong></span>}
      {price?.state === "unpriced" && <span>{t("sql.cost.unpriced")}</span>}
      {price?.state === "refused" && <span className="wb-bad"><strong>{t("sql.cost.refused")}</strong> {price.why}</span>}
    </p>
  );
}

function Workbench({ state }: { state: State }) {
  const { t, n } = useT();
  const f = useFormat();
  const bytes = useBytes();
  const [target, setTarget] = useState(state.target);
  const [statement, setStatement] = useState(() => (state.preloaded ? state.statement : (recall(DRAFT) ?? "")));
  const first = useRef(statement);
  const [tab, setTab] = useState<"results" | "json" | "history">("results");
  const [history, setHistory] = useState<Entry[]>(recent);
  const [rail, setRail] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const ctrl = useRef<AbortController | null>(null);

  const tree = useQuery({
    queryKey: ["sql", "tree", target],
    queryFn: ({ signal }) => getJSON<TreeData>(`/api/sql/tree?target=${encodeURIComponent(target)}`, signal),
    initialData: target === state.target ? state.tree : undefined,
    staleTime: 60_000,
  });
  const writable = tree.data?.writable ?? false;
  const costOf = useCallback((r: Result) => `${t("sql.result.read", { bytes: bytes(r.bytes) })} · ${f.number(r.ms)} ms`, [t, bytes, f]);

  const record = (text: string, outcome: Entry["outcome"], cost: string) =>
    setHistory((h) => {
      const next = [{ text, outcome, cost }, ...h].slice(0, KEEP);
      remember(RECENT, JSON.stringify(next));
      return next;
    });

  const run = useMutation<Result, ApiError, string>({
    mutationFn: async (text) => {
      ctrl.current = new AbortController();
      return (await postJSON<Result>("/api/sql/run", { target, q: text }, ctrl.current.signal))!;
    },
    onSuccess: (res, text) => record(text, "ok", costOf(res)),
    onError: (err, text) => err.name !== "AbortError" && record(text, "failed", ""),
  });

  useEffect(() => {
    if (!run.isPending) return;
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(id);
  }, [run.isPending]);

  const edit = (v: string) => {
    setStatement(v);
    remember(DRAFT, v);
  };
  const go = () => {
    const text = statement.trim();
    if (text !== "" && target !== "" && !run.isPending) {
      setTab("results");
      run.mutate(text);
    }
  };

  const res = run.data;
  const json = useMemo(() => (tab === "json" && res ? JSON.stringify({ columns: res.columns, rows: res.rows }, null, 2) : ""), [tab, res]);

  let answer: ReactNode = null;
  if (run.isPending) {
    answer = (
      <p role="status" className="wb-running">
        <span className="wb-dot" />
        {t("sql.running")} · <span className="tabular">{(elapsed / 1000).toFixed(1)} s</span>
        <button type="button" className="wb-btn" onClick={() => ctrl.current?.abort()}>{t("sql.cancel")}</button>
      </p>
    );
  } else if (run.error && run.error.name !== "AbortError") {
    const e = run.error;
    const kind = e.body?.kind;
    if (kind === "refused") {
      answer = (
        <div className="wb-note wb-bad" role="alert">
          <strong>{t("sql.err.refused")}</strong>
          <p>{e.message}</p>
          <a href="/workflows">{t("sql.readonly.link")}</a>
        </div>
      );
    } else if (kind === "no_connection") {
      answer = <p className="wb-note muted" role="alert">{t("sql.err.no_connection", { connection: e.body?.connection ?? "" })}</p>;
    } else if (kind === "unknown") {
      answer = <p className="wb-note muted" role="alert">{t("sql.err.unknown")}</p>;
    } else {
      answer = (
        <div className="wb-note" role="alert">
          <strong>{t("sql.err.failed")}</strong>
          <p className="muted">{e.message}</p>
        </div>
      );
    }
  } else if (!res) {
    answer = (
      <div className="wb-none">
        <p><strong>{t("sql.result.none")}</strong></p>
        <p className="muted">{t("sql.result.none.how")} <kbd>⌘↵</kbd></p>
      </div>
    );
  }

  const changed = res?.wrote ? (res.changed === null ? t("sql.result.uncounted") : n("sql.result.changed", res.changed)) : "";
  const note = res
    ? res.wrote
      ? `${changed} · ${costOf(res)}`
      : `${n("sql.result.rows", res.rows.length)} · ${costOf(res)}${res.truncated ? ` ${t("sql.result.more")}` : ""}`
    : "";

  return (
    <div className="wb">
      <Drawer open={rail} onClose={() => setRail(false)} label={t("sql.tree.title")}>
        <div className="wb-rail">
          <Rail state={state} tree={tree.data} target={target} setTarget={setTarget} onSelect={edit} onClose={() => setRail(false)} />
        </div>
      </Drawer>
      <div className="wb-main">
        {writable && (
          <p className="wb-writable">
            {t("sql.writable.before")} <strong>{t("sql.writable.strong")}</strong> {t("sql.writable.after")}
          </p>
        )}
        <section aria-label={t("sql.editor.label")} className="wb-editor">
          <div className="wb-bar">
            <button type="button" className="wb-btn wb-rail-toggle" aria-expanded={rail} onClick={() => setRail(true)}>
              {t("sql.tree.show")}
            </button>
            <button type="button" className="wb-btn wb-run" onClick={go} disabled={run.isPending || statement.trim() === ""}>
              ▶ {t("sql.run")}
            </button>
            <kbd>⌘↵</kbd>
            {writable && <span className="wb-badge">{t("sql.writes.allowed")}</span>}
            <span className="wb-grow" />
            <button type="button" className="wb-btn" onClick={() => void navigator.clipboard?.writeText(statement)}>
              {t("sql.copy")}
            </button>
          </div>
          <CodeEditor id="q" value={statement} onChange={edit} onRun={go} label={t("sql.editor.label")}
            placeholder="SELECT * FROM dataset.table WHERE day = CURRENT_DATE()" />
          {!writable && (
            <p className="muted wb-small">
              {t("sql.readonly")} <a href="/workflows">{t("sql.readonly.link")}</a>
            </p>
          )}
          <CostLine target={target} statement={statement} skip={first.current.trim()} />
        </section>
        <section className="wb-results" aria-label={t("sql.result.tabs")}>
          <div role="tablist" aria-label={t("sql.result.tabs")} className="wb-tabs">
            {(["results", "json", "history"] as const).map((k) => (
              <button key={k} type="button" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="wb-panel"
                className="wb-tab" onClick={() => setTab(k)}>
                {k === "results" ? t("sql.result.tab.results") : k === "json" ? "JSON" : t("sql.result.tab.history")}
                {k === "history" && <span className="muted tabular"> {history.length}</span>}
              </button>
            ))}
            <span className="wb-grow" />
            <span className="muted wb-small" role="status" aria-live="polite">{run.isPending ? "" : note}</span>
            {res && !res.wrote && (
              <button type="button" className="wb-btn" onClick={() => downloadCSV(res)}>CSV</button>
            )}
          </div>
          <div id="wb-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="wb-panel">
            {tab === "history" ? (
              history.length === 0 ? (
                <p className="muted wb-small">{t("sql.history.empty")}</p>
              ) : (
                <ol className="wb-history">
                  {history.map((e, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => { edit(e.text); setTab("results"); }}>
                        <span className={e.outcome === "ok" ? "wb-ok" : "wb-bad"}>{e.outcome === "ok" ? t("sql.history.ok") : t("sql.history.failed")}</span>
                        <span className="muted"> {e.cost}</span>
                        <span className="mono wb-snippet">{e.text}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )
            ) : answer ? (
              answer
            ) : res && tab === "json" ? (
              <pre className="wb-json mono">{json}</pre>
            ) : res && res.wrote ? (
              <p className="wb-note">{changed}</p>
            ) : res ? (
              <DataGrid columns={res.columns} rows={res.rows} label={t("sql.result.tab.results")} rowLabel="Row" emptyText="No rows." />
            ) : null}
            {tab === "history" && <p className="muted wb-small">{t("sql.history.where")}</p>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Screen() {
  const { t } = useT();
  const { search } = useLocation();
  const { data } = useSuspenseQuery({
    queryKey: ["sql", "state", search],
    queryFn: async ({ signal }) => {
      try {
        return await getJSON<State>(`/api/sql/state${search}`, signal);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    staleTime: 0,
    gcTime: 0,
  });
  if (!data) return <p className="muted">SQL is not configured on this console.</p>;
  if (data.connections.length === 0) return <p className="wb-note muted">{t("sql.empty.catalog")}</p>;
  return <Workbench key={search} state={data} />;
}

function Title() {
  const { t } = useT();
  return <h1 className="page-title">{t("nav.sql")}</h1>;
}

export default function SqlRoute() {
  return (
    <>
      <Suspense fallback={<Skeleton w="8rem" h="1.5rem" />}>
        <Title />
      </Suspense>
      <Suspense fallback={<SqlSkeleton />}>
        <Screen />
      </Suspense>
    </>
  );
}
