import { AlbumPanel } from "@/components/album-panel";
import { ArtistPanel } from "@/components/artist-panel";
import type { DownloadStatus } from "@/components/common/download-indicator";
import { SearchResultsPanel } from "@/components/search-results-panel";
import { SongRelatedPanel } from "@/components/song-related-panel";
import { useJobs } from "@/features/downloads/use-jobs";
import { SearchInput } from "@/features/search/search-input";
import { useSearchState, type ViewMode } from "@/features/search/search-state";
import { useAlbum } from "@/hooks/use-album";
import { useArtist } from "@/hooks/use-artist";
import { useSearchSuggestions } from "@/hooks/use-search-suggestions";
import { useSongRelated } from "@/hooks/use-song-related";
import { isValidUrl } from "@/lib/url";
import { Button } from "@heroui/react";
import {
  useNavigate,
  useSearch as useRouterSearch,
} from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

interface SearchRouteParams {
  q: string;
  view: ViewMode;
  albumId?: string;
  songId?: string;
  artistId?: string;
}

function mapJobStatus(status: string): DownloadStatus {
  switch (status) {
    case "pending":
    case "fetching_info":
      return "queued";
    case "downloading":
    case "importing":
      return "downloading";
    case "completed":
      return "completed";
    case "failed":
    case "cancelled":
      return "failed";
    default:
      return "idle";
  }
}

function getVideoIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

function getBrowseIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/browse\/([^/]+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function SearchPage() {
  const navigate = useNavigate();
  const routeSearch = useRouterSearch({ from: "/search" }) as SearchRouteParams;
  const lastSearchRef = useRef<string | null>(null);

  const {
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
    results,
    query,
    isSearching,
    search,
    clear,
  } = useSearchState();
  const { jobs, startJob } = useJobs();

  const isUrlLike = input.startsWith("http://") || input.startsWith("https://");
  const { suggestions } = useSearchSuggestions(input, { enabled: !isUrlLike });

  const { album, isLoading: isAlbumLoading } = useAlbum(selectedAlbumId);
  const { artist, isLoading: isArtistLoading } = useArtist(selectedArtistId);
  const { sections, isLoading: isRelatedLoading } =
    useSongRelated(selectedSongId);

  useEffect(() => {
    const hasUrlState = Boolean(
      routeSearch.q ||
      (routeSearch.view && routeSearch.view !== "results") ||
      routeSearch.albumId ||
      routeSearch.songId ||
      routeSearch.artistId,
    );

    if (hasUrlState) {
      setInput(routeSearch.q ?? "");
      setView(routeSearch.view ?? "results");
      setSelectedAlbumId(routeSearch.albumId ?? null);
      setSelectedSongId(routeSearch.songId ?? null);
      setSelectedArtistId(routeSearch.artistId ?? null);

      if (!routeSearch.q) {
        if (query) clear();
        lastSearchRef.current = null;
        return;
      }

      if (routeSearch.q !== lastSearchRef.current && routeSearch.q !== query) {
        lastSearchRef.current = routeSearch.q;
        search(routeSearch.q);
      }
      return;
    }

    if (
      query ||
      view !== "results" ||
      selectedAlbumId ||
      selectedSongId ||
      selectedArtistId
    ) {
      navigate({
        to: "/search",
        search: {
          q: query || undefined,
          view,
          albumId: selectedAlbumId ?? undefined,
          songId: selectedSongId ?? undefined,
          artistId: selectedArtistId ?? undefined,
        },
        replace: true,
      });
    }
  }, [
    routeSearch.q,
    routeSearch.view,
    routeSearch.albumId,
    routeSearch.songId,
    query,
    clear,
    search,
    view,
    selectedAlbumId,
    selectedSongId,
    selectedArtistId,
    navigate,
    setInput,
    setView,
    setSelectedAlbumId,
    setSelectedSongId,
    setSelectedArtistId,
  ]);

  const { downloadStatuses, trackStatuses, albumStatuses } = useMemo(() => {
    const byUrl: Record<
      string,
      { status: DownloadStatus; progress: number | null }
    > = {};
    const byVideoId: Record<
      string,
      { status: DownloadStatus; progress: number | null }
    > = {};
    const byBrowseId: Record<
      string,
      { status: DownloadStatus; progress: number | null }
    > = {};

    for (const job of jobs) {
      if (!job.url) continue;
      const status = mapJobStatus(job.status);
      const entry = {
        status,
        progress: status === "downloading" ? (job.progress ?? null) : null,
      };
      byUrl[job.url] = entry;

      const videoId = getVideoIdFromUrl(job.url);
      if (videoId) byVideoId[videoId] = entry;

      const browseId = getBrowseIdFromUrl(job.url);
      if (browseId) byBrowseId[browseId] = entry;
    }

    return {
      downloadStatuses: byUrl,
      trackStatuses: byVideoId,
      albumStatuses: byBrowseId,
    };
  }, [jobs]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (isUrlLike && isValidUrl(trimmed)) {
      await startJob(trimmed);
      setInput("");
      return;
    }

    navigate({
      to: "/search",
      search: {
        q: trimmed,
        view: "results",
        albumId: undefined,
        songId: undefined,
        artistId: undefined,
      },
      replace: true,
    });
    lastSearchRef.current = trimmed;
    await search(trimmed);
    setView("results");
    setSelectedAlbumId(null);
    setSelectedSongId(null);
    setSelectedArtistId(null);
  };

  return (
    <>
      <h1 className="text-foreground mb-5 text-2xl font-bold">Search</h1>

      <section className="mb-6 flex gap-2">
        <div className="flex-1">
          <SearchInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            suggestions={suggestions}
            onSuggestionSelect={(value) => {
              setInput(value);
              navigate({
                to: "/search",
                search: {
                  q: value,
                  view: "results",
                  albumId: undefined,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
              lastSearchRef.current = value;
              search(value);
              setView("results");
              setSelectedArtistId(null);
            }}
          />
        </div>
        <Button
          color="primary"
          radius="lg"
          variant="shadow"
          className="shadow-primary-100/50"
          onPress={handleSubmit}
          startContent={<Search className="h-4 w-4" />}
        >
          Search
        </Button>
      </section>

      <section className="mb-6">
        {view === "results" && (
          <SearchResultsPanel
            results={results}
            query={query}
            isSearching={isSearching}
            onQueueUrl={(url) => startJob(url)}
            onViewAlbum={(browseId) => {
              setSelectedAlbumId(browseId);
              setSelectedSongId(null);
              setSelectedArtistId(null);
              setView("album");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "album",
                  albumId: browseId,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onViewSong={(videoId) => {
              setSelectedSongId(videoId);
              setSelectedAlbumId(null);
              setSelectedArtistId(null);
              setView("related");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "related",
                  songId: videoId,
                  albumId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onViewArtist={(channelId) => {
              setSelectedArtistId(channelId);
              setSelectedAlbumId(null);
              setSelectedSongId(null);
              setView("artist");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "artist",
                  artistId: channelId,
                  albumId: undefined,
                  songId: undefined,
                },
                replace: true,
              });
            }}
            downloadStatuses={downloadStatuses}
            onDownloadDiscography={(channelId, url) => {
              startJob(url, { kind: "discography", channelId });
            }}
          />
        )}

        {view === "album" && (
          <AlbumPanel
            album={album}
            isLoading={isAlbumLoading}
            onBack={() => {
              setView("results");
              setSelectedAlbumId(null);
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "results",
                  albumId: undefined,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onDownloadAlbum={() => {
              if (selectedAlbumId) {
                const url = `https://music.youtube.com/browse/${selectedAlbumId}`;
                startJob(url);
              }
            }}
            onDownloadTrack={(videoId) => {
              const url = `https://music.youtube.com/watch?v=${videoId}`;
              startJob(url);
            }}
            onViewSong={(videoId) => {
              setSelectedSongId(videoId);
              setView("related");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "related",
                  songId: videoId,
                  albumId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            albumStatus={
              selectedAlbumId ? albumStatuses[selectedAlbumId] : undefined
            }
            trackStatuses={trackStatuses}
          />
        )}

        {view === "artist" && (
          <ArtistPanel
            artist={artist}
            isLoading={isArtistLoading}
            onBack={() => {
              setView("results");
              setSelectedArtistId(null);
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "results",
                  albumId: undefined,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onQueueUrl={(url) => startJob(url)}
            onViewAlbum={(browseId) => {
              setSelectedAlbumId(browseId);
              setSelectedSongId(null);
              setSelectedArtistId(null);
              setView("album");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "album",
                  albumId: browseId,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onViewSong={(videoId) => {
              setSelectedSongId(videoId);
              setSelectedAlbumId(null);
              setSelectedArtistId(null);
              setView("related");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "related",
                  songId: videoId,
                  albumId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onViewArtist={(channelId) => {
              setSelectedArtistId(channelId);
              setSelectedAlbumId(null);
              setSelectedSongId(null);
              setView("artist");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "artist",
                  artistId: channelId,
                  albumId: undefined,
                  songId: undefined,
                },
                replace: true,
              });
            }}
            downloadStatuses={downloadStatuses}
            onDownloadDiscography={(channelId, url) => {
              startJob(url, { kind: "discography", channelId });
            }}
          />
        )}

        {view === "related" && (
          <SongRelatedPanel
            sections={sections}
            isLoading={isRelatedLoading}
            onQueueUrl={(url) => startJob(url)}
            downloadStatuses={downloadStatuses}
            onViewSong={(videoId) => {
              setSelectedSongId(videoId);
              setSelectedArtistId(null);
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "related",
                  songId: videoId,
                  albumId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onViewAlbum={(browseId) => {
              setSelectedAlbumId(browseId);
              setSelectedSongId(null);
              setSelectedArtistId(null);
              setView("album");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "album",
                  albumId: browseId,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
            onViewArtist={(channelId) => {
              setSelectedArtistId(channelId);
              setSelectedAlbumId(null);
              setSelectedSongId(null);
              setView("artist");
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "artist",
                  artistId: channelId,
                  albumId: undefined,
                  songId: undefined,
                },
                replace: true,
              });
            }}
            onBack={() => {
              setView("results");
              setSelectedSongId(null);
              navigate({
                to: "/search",
                search: {
                  q: query,
                  view: "results",
                  albumId: undefined,
                  songId: undefined,
                  artistId: undefined,
                },
                replace: true,
              });
            }}
          />
        )}
      </section>
    </>
  );
}
