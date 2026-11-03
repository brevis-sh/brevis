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

export async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" }, signal });
  // The Gate answers a GET without a session with a 303 to /login, and fetch
  // follows it into a 200 HTML page. That is a 401: send the browser to the
  // login and bring it back to this screen (the `next` the login screen reads).
  if (res.redirected && new URL(res.url).pathname === "/login") {
    const here = location.pathname + location.search;
    location.assign(`/login?next=${encodeURIComponent(here)}`);
    throw new ApiError(401, `${path}: no session`);
  }
  if (!res.ok) throw new ApiError(res.status, `${path}: HTTP ${res.status}`);
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
