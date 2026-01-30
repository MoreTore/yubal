import { useSearch } from "@/hooks/use-search";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type ViewMode = "results" | "album" | "related" | "artist";

interface SearchStateValue {
  input: string;
  setInput: (value: string) => void;
  view: ViewMode;
  setView: (value: ViewMode) => void;
  selectedAlbumId: string | null;
  setSelectedAlbumId: (value: string | null) => void;
  selectedSongId: string | null;
  setSelectedSongId: (value: string | null) => void;
  selectedArtistId: string | null;
  setSelectedArtistId: (value: string | null) => void;
  results: ReturnType<typeof useSearch>["results"];
  query: ReturnType<typeof useSearch>["query"];
  isSearching: ReturnType<typeof useSearch>["isSearching"];
  error: ReturnType<typeof useSearch>["error"];
  search: ReturnType<typeof useSearch>["search"];
  clear: ReturnType<typeof useSearch>["clear"];
}

const SearchStateContext = createContext<SearchStateValue | null>(null);

export function SearchStateProvider({ children }: { children: ReactNode }) {
  const [input, setInput] = useState("");
  const [view, setView] = useState<ViewMode>("results");
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null);
  const searchState = useSearch();

  const value = useMemo(
    () => ({
      input,
      setInput,
      view,
      setView,
      selectedAlbumId,
      setSelectedAlbumId,
      selectedSongId,
      setSelectedSongId,
      selectedArtistId,
      setSelectedArtistId,
      ...searchState,
    }),
    [
      input,
      view,
      selectedAlbumId,
      selectedSongId,
      selectedArtistId,
      searchState,
    ],
  );

  return (
    <SearchStateContext.Provider value={value}>
      {children}
    </SearchStateContext.Provider>
  );
}

export function useSearchState(): SearchStateValue {
  const context = useContext(SearchStateContext);
  if (!context) {
    throw new Error("useSearchState must be used within SearchStateProvider");
  }
  return context;
}
