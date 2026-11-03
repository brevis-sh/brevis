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

// postJSON is for effects (pause, resume). The server answers a failure as
// {"error": "..."}; that message becomes the ApiError's.
export async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.redirected && new URL(res.url).pathname === "/login") {
    location.assign(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    throw new ApiError(401, `${path}: no session`);
  }
  if (!res.ok) {
    const msg = await res.json().then((j: { error?: string }) => j.error, () => undefined);
    throw new ApiError(res.status, msg ?? `${path}: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
