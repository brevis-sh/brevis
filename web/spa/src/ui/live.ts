// Live refresh by polling. react-query pauses a refetchInterval while the tab
// is hidden (refetchIntervalInBackground defaults to false) and refetches when
// it comes back. The old Ingest pages never polled, so this is a new, gentle
// cadence; SSE replaces it later.
export const LIVE = { refetchInterval: 15_000 } as const;
