import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getJSON } from "./client";

type Options = {
  /** Polling period in ms; React Query pauses it while the tab is hidden. SSE replaces this later. */
  every?: number;
  enabled?: boolean;
  /**
   * Keep the old answer on screen while a new key loads. Right for a list
   * whose filter changed (no skeleton flash); wrong for another record's page,
   * which must not show the previous record under the new address.
   */
  keep?: boolean;
};

// useData reads a JSON endpoint for a screen that follows its data. `isPending`
// is true only before the first answer for a key (or always, without `keep`).
export function useData<T>(key: readonly unknown[], path: string, { every = 30_000, enabled = true, keep = true }: Options = {}) {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getJSON<T>(path, signal),
    placeholderData: keep ? keepPreviousData : undefined,
    refetchInterval: every,
    enabled,
  });
}
