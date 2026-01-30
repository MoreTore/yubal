import { useCallback, useState } from "react";
import { searchYtMusic, type SearchOptions, type SearchResult } from "../api/search";
import { showErrorToast } from "../lib/toast";

export interface UseSearchResult {
  results: SearchResult[];
  query: string;
  isSearching: boolean;
  error: string | null;
  search: (query: string, options?: SearchOptions) => Promise<void>;
  clear: () => void;
}

interface UseSearchOptions {
  initialResults?: SearchResult[];
  initialQuery?: string;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { initialResults = [], initialQuery = "" } = options;
  const [results, setResults] = useState<SearchResult[]>(initialResults);
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clear = useCallback(() => {
    setResults([]);
    setQuery("");
    setError(null);
  }, []);

  const search = useCallback(
    async (nextQuery: string, options: SearchOptions = {}) => {
      const trimmed = nextQuery.trim();
      if (!trimmed) {
        clear();
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const { results: data } = await searchYtMusic(trimmed, options);
        setResults(data);
        setQuery(trimmed);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to fetch search results";
        setError(message);
        showErrorToast("Search failed", message);
      } finally {
        setIsSearching(false);
      }
    },
    [clear],
  );

  return {
    results,
    query,
    isSearching,
    error,
    search,
    clear,
  };
}
