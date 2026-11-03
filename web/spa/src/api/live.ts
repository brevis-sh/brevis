import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJSON } from "./client";

// useData reads a JSON endpoint for a screen that follows its data. It keeps
// the rows on screen while a filter changes (no skeleton flash: `isPending` is
// only true before the first answer) and polls every `every` ms. React Query
// pauses the interval while the tab is hidden; SSE replaces this later.
export function useData<T>(key: readonly unknown[], path: string, every = 30_000, enabled = true) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getJSON<T>(path, signal),
    placeholderData: keepPreviousData,
    refetchInterval: every,
    enabled,
  });
}
