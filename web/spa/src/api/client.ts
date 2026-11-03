// ApiError carries the HTTP status, so a screen can tell a 401 (go to login)
// from a 500 (show the retry) without parsing a message.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The parsed JSON error body ({"error", "kind", ...}), when the server sent one. */
    readonly body?: Record<string, string>,
  ) {
    super(message);
  }
}

// A read takes no AbortSignal, and the query functions must not even READ the one
// React Query offers (`({ signal }) =>`): merely touching it tells the library the
// request is cancellable, so when the last observer leaves it cancels and starts
// over on the next mount. StrictMode (dev) mounts every screen twice and so sent
// every request twice; a screen that is left mid-flight listed a red "(canceled)".
// These reads are small and land in the cache, so they simply finish and the next
// observer joins the request in flight. Where a request really is the reader's to
// cancel -- the SQL run -- postJSON still honors a signal.
export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  // The Gate answers a GET without a session with a 303 to /login, and fetch
  // follows it into a 200 HTML page. That is a 401: send the browser to the
  // login and bring it back to this screen (the `next` the login screen reads).
  if (res.redirected && new URL(res.url).pathname === "/login") {
    const here = location.pathname + location.search;
    location.assign(`/login?next=${encodeURIComponent(here)}`);
    throw new ApiError(401, `${path}: no session`);
  }
  if (!res.ok) {
    // The API answers a failure as {"error": "..."}; say that when it did.
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `${path}: HTTP ${res.status}`);
  }
  // A 204 is "nothing there" (no release known): no body to read.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** POST a JSON body; resolves undefined on 204. A failure carries the server's {"error"} as the message. */
export async function postJSON<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T | undefined> {
  const res = await fetch(path, {
    method: "POST",
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  if (res.redirected && new URL(res.url).pathname === "/login") {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(401, `${path}: no session`);
  }
  if (res.status === 204) return undefined;
  if (!res.ok) {
    const parsed = (await res.json().catch(() => undefined)) as Record<string, string> | undefined;
    throw new ApiError(res.status, parsed?.error ?? `${path}: HTTP ${res.status}`, parsed);
  }
  return (await res.json()) as T;
}
