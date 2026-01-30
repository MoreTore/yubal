import { Button } from "@heroui/react";
import { ArrowLeft, Download, User2 } from "lucide-react";
import type { ArtistItem, ArtistResponse } from "../api/artist";
import { DownloadStatusIcon, type DownloadStatus } from "./common/download-indicator";
import { EmptyState } from "./common/empty-state";
import { Panel, PanelContent, PanelHeader } from "./common/panel";

interface ArtistPanelProps {
  artist: ArtistResponse | null;
  isLoading: boolean;
  onBack: () => void;
  onQueueUrl: (url: string) => void;
  onViewAlbum: (browseId: string) => void;
  onViewSong: (videoId: string) => void;
  onViewArtist: (channelId: string) => void;
  downloadStatuses: Record<string, { status: DownloadStatus; progress: number | null }>;
}

type ArtistSectionKey = "songs" | "albums" | "singles" | "videos" | "related";

const SECTION_LABELS: Record<ArtistSectionKey, string> = {
  songs: "Top songs",
  albums: "Albums",
  singles: "Singles",
  videos: "Videos",
  related: "Related artists",
};

function getThumbnailUrl(item: { thumbnails?: Array<{ url: string; width?: number; height?: number }> }): string | null {
  const thumbnails = item.thumbnails;
  if (!thumbnails || thumbnails.length === 0) return null;

  const sorted = [...thumbnails].sort((a, b) => {
    const aSize = (a.width ?? 0) * (a.height ?? 0);
    const bSize = (b.width ?? 0) * (b.height ?? 0);
    return bSize - aSize;
  });

  return sorted[0]?.url ?? null;
}

function getItemTitle(item: ArtistItem): string {
  return item.title || item.name || "Untitled";
}

function getItemMeta(item: ArtistItem, section: ArtistSectionKey): string | null {
  if (section === "songs") {
    return null;
  }
  if (section === "videos") {
    return [item.views].filter(Boolean).join(" • ") || null;
  }
  if (section === "albums" || section === "singles") {
    return item.year ?? null;
  }
  if (section === "related") {
    return item.subscribers ?? null;
  }
  return null;
}

function getItemUrl(item: ArtistItem, section: ArtistSectionKey): string | null {
  if (section === "songs" || section === "videos") {
    if (item.videoId) return `https://music.youtube.com/watch?v=${item.videoId}`;
    if (item.playlistId) return `https://music.youtube.com/playlist?list=${item.playlistId}`;
  }
  if (section === "albums" || section === "singles") {
    if (item.browseId) return `https://music.youtube.com/browse/${item.browseId}`;
  }
  return null;
}

export function ArtistPanel({
  artist,
  isLoading,
  onBack,
  onQueueUrl,
  onViewAlbum,
  onViewSong,
  onViewArtist,
  downloadStatuses,
}: ArtistPanelProps) {
  const heroThumbnail = artist ? getThumbnailUrl(artist) : null;
  const sections: Array<[ArtistSectionKey, ArtistItem[]]> = [
    ["songs", artist?.songs?.results ?? []],
    ["albums", artist?.albums?.results ?? []],
    ["singles", artist?.singles?.results ?? []],
    ["videos", artist?.videos?.results ?? []],
    ["related", artist?.related?.results ?? []],
  ];

  return (
    <Panel>
      <PanelHeader
        leadingIcon={<User2 size={18} />}
        trailingIcon={
          <Button
            variant="light"
            size="sm"
            startContent={<ArrowLeft className="h-4 w-4" />}
            onPress={onBack}
          >
            Back to results
          </Button>
        }
      >
        Artist
      </PanelHeader>
      <PanelContent height="h-[520px]" className="space-y-4">
        {isLoading ? (
          <EmptyState icon={User2} title="Loading artist..." />
        ) : !artist ? (
          <EmptyState icon={User2} title="No artist selected" />
        ) : (
          <div className="space-y-6">
            <section className="bg-content2/70 border-content3/40 relative overflow-hidden rounded-2xl border p-4">
              {heroThumbnail && (
                <div
                  className="absolute inset-0 bg-cover bg-center blur-2xl scale-110 opacity-20"
                  style={{ backgroundImage: `url(${heroThumbnail})` }}
                />
              )}
              <div className="relative z-10 flex flex-wrap items-center gap-4">
                {heroThumbnail && (
                  <img
                    src={heroThumbnail}
                    alt={artist.name ?? "Artist"}
                    className="h-16 w-16 rounded-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-foreground-600 truncate text-lg font-semibold">
                    {artist.name ?? "Unknown artist"}
                  </div>
                  <div className="text-foreground-400 text-xs uppercase tracking-wider">
                    {artist.subscribers}
                    {artist.views ? ` • ${artist.views}` : ""}
                  </div>
                </div>
              </div>
              {artist.description && (
                <p className="text-foreground-400 mt-3 text-sm leading-relaxed">
                  {artist.description}
                </p>
              )}
            </section>

            {sections.map(([key, items]) =>
              items.length === 0 ? null : (
                <section key={key} className="space-y-2">
                  <div className="text-foreground-400 text-xs uppercase tracking-wider">
                    {SECTION_LABELS[key]}
                  </div>
                  <div className="space-y-2">
                    {items.map((item, index) => {
                      const title = getItemTitle(item);
                      const thumbnailUrl = getThumbnailUrl(item);
                      const meta = getItemMeta(item, key);
                      const url = getItemUrl(item, key);
                      const status: { status: DownloadStatus; progress: number | null } = url
                        ? downloadStatuses[url] ?? { status: "idle", progress: null }
                        : { status: "idle", progress: null };

                      const isClickable =
                        (key === "songs" || key === "videos")
                          ? Boolean(item.videoId)
                          : key === "albums" || key === "singles"
                            ? Boolean(item.browseId)
                            : key === "related"
                              ? Boolean(item.browseId)
                              : false;

                      return (
                        <div
                          key={`${key}-${title}-${index}`}
                          onClick={() => {
                            if (key === "songs" || key === "videos") {
                              if (item.videoId) onViewSong(item.videoId);
                              return;
                            }
                            if (key === "albums" || key === "singles") {
                              if (item.browseId) onViewAlbum(item.browseId);
                              return;
                            }
                            if (key === "related" && item.browseId) {
                              onViewArtist(item.browseId);
                            }
                          }}
                          className={`bg-content2/60 flex items-center gap-3 rounded-xl px-3 py-2 ${
                            isClickable ? "cursor-pointer hover:bg-content2" : ""
                          }`}
                        >
                          {thumbnailUrl && (
                            <img
                              src={thumbnailUrl}
                              alt={title}
                              className="h-12 w-12 rounded-lg object-cover"
                              loading="lazy"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-foreground-600 truncate text-sm font-medium">
                              {title}
                            </div>
                            {meta && (
                              <div className="text-foreground-400 truncate text-xs">
                                {meta}
                              </div>
                            )}
                          </div>
                          {url && (
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => onQueueUrl(url)}
                              onClick={(event) => event.stopPropagation()}
                              isDisabled={
                                status.status === "queued" ||
                                status.status === "downloading"
                              }
                              isIconOnly
                              aria-label={`Download ${title}`}
                              startContent={
                                status.status === "idle" ? (
                                  <Download className="h-4 w-4" />
                                ) : (
                                  <DownloadStatusIcon
                                    status={status.status}
                                    progress={status.progress}
                                  />
                                )
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ),
            )}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
