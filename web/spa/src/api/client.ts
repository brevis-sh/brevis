// ApiError carries the HTTP status, so a screen can tell a 401 (go to login)
// from a 500 (show the retry) without parsing a message.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
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

// postJSON sends a JSON body. A failure carries the server's own {"error"}
// sentence when there is one, so a screen can show why instead of a status.
export async function postJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (res.redirected && new URL(res.url).pathname === "/login") {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(401, `${path}: no session`);
  }
  if (!res.ok) {
    const said = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, said?.error ?? `${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
