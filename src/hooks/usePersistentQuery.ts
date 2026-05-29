import { useQuery } from "convex/react";
import { useEffect } from "react";

// Simple global memory cache for Convex query results to prevent loading flashes and preserve scroll positions
let queryCache = new Map<string, unknown>();

/**
 * A wrapper hook around Convex's useQuery that caches the last successful result in memory.
 * If the query is in a loading/undefined state, it returns the cached result if available.
 * This prevents UI flashes (skeletons) during page transitions and allows the browser to restore scroll position.
 */
export function usePersistentQuery<T>(
  query: Parameters<typeof useQuery>[0],
  args?: Parameters<typeof useQuery>[1],
): T | undefined {
  const result = useQuery(query, args);
  // Create a unique key based on the query function and its arguments
  const cacheKey = JSON.stringify({ query: query.toString(), args });

  useEffect(() => {
    if (result !== undefined) {
      queryCache.set(cacheKey, result);
    }
  }, [result, cacheKey]);

  if (result === undefined) {
    return queryCache.get(cacheKey) as T | undefined;
  }

  return result as T;
}

/**
 * Clears the query cache (e.g. upon user logout)
 */
export function clearQueryCache() {
  queryCache = new Map<string, unknown>();
}
