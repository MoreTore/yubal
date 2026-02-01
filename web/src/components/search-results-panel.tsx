import { Button } from "@heroui/react";
import { Download, Search } from "lucide-react";
import type { SearchResult } from "../api/search";
import {
  getBrowseId,
  getMusicUrl,
  getThumbnailUrl,
  getTitle,
} from "../lib/music-helpers";
import {
  DownloadStatusIcon,
  type DownloadStatus,
} from "./common/download-indicator";
import { DiscographyDownloadButton } from "./common/discography-download-button";
import { EmptyState } from "./common/empty-state";
import { MusicItem } from "./common/music-item";
import { Panel, PanelContent, PanelHeader } from "./common/panel";

interface SearchResultsPanelProps {
  results: SearchResult[];
  query: string;
  isSearching: boolean;
  onQueueUrl: (url: string) => void;
  onViewAlbum: (browseId: string) => void;
  onViewSong: (videoId: string) => void;
  onViewArtist: (channelId: string) => void;
  onDownloadDiscography?: (channelId: string, url: string) => void;
  downloadStatuses: Record<
    string,
    { status: DownloadStatus; progress: number | null }
  >;
}

function getSubtitle(result: SearchResult): string | null {
  const artists =
    result.artists?.map((artist) => artist.name).filter(Boolean) ?? [];
  if (artists.length > 0) return artists.join(", ");
  if (result.artist) return result.artist;
  if (result.author) return result.author;
  return null;
}

function formatTypeLabel(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/[_-]+/g, " ").toLowerCase();
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function getInfoLine(result: SearchResult): string | null {
  const subtitle = getSubtitle(result);
  const category = result.category?.toLowerCase();
  const isListenAgain = category === "listen again";
  const isSong =
    result.resultType === "song" || category === "songs" || isListenAgain;
  const duration = isSong ? (result.duration ?? null) : null;
  const typeLabel = isListenAgain
    ? null
    : formatTypeLabel(result.resultType ?? result.category);

  const parts = [typeLabel, subtitle, duration].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  return parts.join(" • ");
}

export function SearchResultsPanel({
  results,
  query,
  isSearching,
  onQueueUrl,
  onViewAlbum,
  onViewSong,
  onViewArtist,
  onDownloadDiscography,
  downloadStatuses,
}: SearchResultsPanelProps) {
  const renderDiscographyButton = (item: SearchResult) => {
    if (!onDownloadDiscography) return null;
    const isArtist =
      item.resultType === "artist" ||
      item.category?.toLowerCase() === "artists";
    if (!isArtist) return null;

    const channelId = getBrowseId(item);
    if (!channelId) return null;

    return (
      <DiscographyDownloadButton
        channelId={channelId}
        artistName={getTitle(item)}
        downloadStatuses={downloadStatuses}
        onDownloadDiscography={onDownloadDiscography}
      />
    );
  };

  const topArtistIndex = results.findIndex(
    (item) =>
      item.category?.toLowerCase() === "top result" &&
      item.resultType === "artist",
  );
  const topArtist = topArtistIndex >= 0 ? results[topArtistIndex] : null;
  const topArtistDiscographyAction = topArtist
    ? renderDiscographyButton(topArtist)
    : null;
  const usedIndexes = new Set<number>();

  const topItems: SearchResult[] = [];

  if (topArtist) {
    const artistName =
      topArtist.artists?.[0]?.name ||
      topArtist.name ||
      topArtist.artist ||
      null;

    usedIndexes.add(topArtistIndex);

    for (let i = topArtistIndex + 1; i < results.length; i += 1) {
      const item = results[i];
      if (!item) continue;
      if (topItems.length >= 3) break;

      const itemArtists =
        item.artists?.map((artist) => artist.name).filter(Boolean) ?? [];
      const isFromArtist = artistName
        ? itemArtists.includes(artistName) ||
          item.artist === artistName ||
          item.author === artistName
        : false;

      if (!isFromArtist) continue;

      topItems.push(item);
      usedIndexes.add(i);
    }
  }

  const filteredResults = results.filter((_, index) => !usedIndexes.has(index));
  const grouped = filteredResults.reduce<Record<string, SearchResult[]>>(
    (acc, item) => {
      const key = item.category || item.resultType || "Results";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {},
  );

  const hasResults = results.length > 0;
  const topArtistThumbnail = topArtist ? getThumbnailUrl(topArtist) : null;
  const topArtistBrowseId = topArtist ? getBrowseId(topArtist) : null;
  const topArtistUrl = topArtist ? getMusicUrl(topArtist) : null;
  const topArtistStatus: { status: DownloadStatus; progress: number | null } =
    topArtistUrl
      ? (downloadStatuses[topArtistUrl] ?? { status: "idle", progress: null })
      : { status: "idle", progress: null };

  return (
    <Panel>
      <PanelHeader
        leadingIcon={<Search size={18} />}
        badge={
          query && (
            <span className="text-foreground-400 font-mono text-xs">
              ({results.length})
            </span>
          )
        }
      >
        Search results
      </PanelHeader>
      <PanelContent height="h-[520px]">
        {isSearching ? (
          <EmptyState icon={Search} title="Searching..." />
        ) : !hasResults ? (
          <EmptyState
            icon={Search}
            title="No results"
            description={
              query
                ? `No results found for "${query}".`
                : "Search for artists, songs, albums, or playlists."
            }
          />
        ) : (
          <div className="space-y-6">
            {topArtist && (
              <section className="space-y-3">
                <div className="text-foreground-400 text-xs tracking-wider uppercase">
                  Top result
                </div>
                <div
                  className={`bg-content2/70 border-content3/40 relative overflow-hidden rounded-2xl border p-4 ${
                    topArtistBrowseId ? "hover:bg-content2 cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (topArtistBrowseId) onViewArtist(topArtistBrowseId);
                  }}
                >
                  {topArtistThumbnail && (
                    <div
                      className="absolute inset-0 scale-110 bg-cover bg-center opacity-20 blur-2xl"
                      style={{ backgroundImage: `url(${topArtistThumbnail})` }}
                    />
                  )}
                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center gap-4">
                      {topArtistThumbnail && (
                        <img
                          src={topArtistThumbnail}
                          alt={getTitle(topArtist)}
                          className="h-16 w-16 rounded-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-foreground-600 truncate text-lg font-semibold">
                          {getTitle(topArtist)}
                        </div>
                        <div className="text-foreground-400 text-xs tracking-wider uppercase">
                          Artist
                        </div>
                      </div>
                      {(topArtistDiscographyAction || topArtistUrl) && (
                        <div className="flex items-center gap-2">
                          {topArtistDiscographyAction}
                          {topArtistUrl && (
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => onQueueUrl(topArtistUrl)}
                              onClick={(event) => event.stopPropagation()}
                              isDisabled={
                                topArtistStatus.status === "queued" ||
                                topArtistStatus.status === "downloading"
                              }
                              isIconOnly
                              aria-label="Download top result"
                              startContent={
                                topArtistStatus.status === "idle" ? (
                                  <Download className="h-4 w-4" />
                                ) : (
                                  <DownloadStatusIcon
                                    status={topArtistStatus.status}
                                    progress={topArtistStatus.progress}
                                  />
                                )
                              }
                            />
                          )}
                        </div>
                      )}
                    </div>
                    {topItems.length > 0 && (
                      <div className="space-y-2">
                        {topItems.map((item, index) => {
                          const title = getTitle(item);
                          const subtitle = getSubtitle(item);
                          const infoLine = getInfoLine(item);
                          const url = getMusicUrl(item);
                          const browseId = getBrowseId(item);
                          const isAlbum =
                            item.resultType === "album" ||
                            item.category === "Albums";
                          const isSong =
                            item.resultType === "song" ||
                            item.category?.toLowerCase() === "songs" ||
                            item.category?.toLowerCase() === "listen again";
                          const isArtist =
                            item.resultType === "artist" ||
                            item.category?.toLowerCase() === "artists";
                          const thumbnailUrl = getThumbnailUrl(item);
                          const status = url
                            ? (downloadStatuses[url] ?? {
                                status: "idle" as DownloadStatus,
                                progress: null,
                              })
                            : {
                                status: "idle" as DownloadStatus,
                                progress: null,
                              };

                          return (
                            <MusicItem
                              key={`top-item-${index}-${title}`}
                              item={{
                                id: `top-item-${index}`,
                                title,
                                subtitle,
                                meta: infoLine,
                                thumbnailUrl,
                                url: url ?? undefined,
                                downloadStatus: status,
                                isClickable: Boolean(
                                  (isAlbum && browseId) ||
                                  (isSong && item.videoId) ||
                                  (isArtist && browseId),
                                ),
                                videoId: item.videoId ?? undefined,
                              }}
                              size="sm"
                              onClick={() => {
                                if (isAlbum && browseId) onViewAlbum(browseId);
                                if (isSong && item.videoId)
                                  onViewSong(item.videoId);
                                if (isArtist && browseId)
                                  onViewArtist(browseId);
                              }}
                              onDownload={url ? onQueueUrl : undefined}
                              trailingContent={renderDiscographyButton(item)}
                              showPlayButton={Boolean(isSong && item.videoId)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}
            {Object.entries(grouped).map(([category, items]) => (
              <section key={category} className="space-y-2">
                <div className="text-foreground-400 text-xs tracking-wider uppercase">
                  {category}
                </div>
                <div className="space-y-2">
                  {items.map((item, index) => {
                    const title = getTitle(item);
                    const subtitle = getSubtitle(item);
                    const infoLine = getInfoLine(item);
                    const url = getMusicUrl(item);
                    const browseId = getBrowseId(item);
                    const isAlbum =
                      item.resultType === "album" || item.category === "Albums";
                    const isSong =
                      item.resultType === "song" ||
                      item.category?.toLowerCase() === "songs" ||
                      item.category?.toLowerCase() === "listen again";
                    const isArtist =
                      item.resultType === "artist" ||
                      item.category?.toLowerCase() === "artists";
                    const thumbnailUrl = getThumbnailUrl(item);
                    const status = url
                      ? (downloadStatuses[url] ?? {
                          status: "idle" as DownloadStatus,
                          progress: null,
                        })
                      : { status: "idle" as DownloadStatus, progress: null };

                    return (
                      <MusicItem
                        key={`${category}-${index}-${title}`}
                        item={{
                          id: `${category}-${index}`,
                          title,
                          subtitle,
                          meta: infoLine,
                          thumbnailUrl,
                          url: url ?? undefined,
                          downloadStatus: status,
                          isClickable: Boolean(
                            (isAlbum && browseId) ||
                            (isSong && item.videoId) ||
                            (isArtist && browseId),
                          ),
                          showExternalLink: true,
                          videoId: item.videoId ?? undefined,
                        }}
                        onClick={() => {
                          if (isAlbum && browseId) onViewAlbum(browseId);
                          if (isSong && item.videoId) onViewSong(item.videoId);
                          if (isArtist && browseId) onViewArtist(browseId);
                        }}
                        onDownload={url ? onQueueUrl : undefined}
                        trailingContent={renderDiscographyButton(item)}
                        showPlayButton={Boolean(isSong && item.videoId)}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
