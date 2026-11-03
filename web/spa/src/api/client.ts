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
  if (!res.ok) throw new ApiError(res.status, `${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}
