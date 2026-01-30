import { Button } from "@heroui/react";
import { ArrowLeft, User2 } from "lucide-react";
import type { ArtistItem, ArtistResponse } from "../api/artist";
import { getMusicUrl, getThumbnailUrl, getTitle } from "../lib/music-helpers";
import type { DownloadStatus } from "./common/download-indicator";
import { EmptyState } from "./common/empty-state";
import { MusicItem } from "./common/music-item";
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
                      const title = getTitle(item);
                      const thumbnailUrl = getThumbnailUrl(item);
                      const meta = getItemMeta(item, key);
                      const url = getMusicUrl(item);
                      const status = url
                        ? downloadStatuses[url] ?? { status: "idle" as DownloadStatus, progress: null }
                        : { status: "idle" as DownloadStatus, progress: null };

                      const isClickable =
                        (key === "songs" || key === "videos")
                          ? Boolean(item.videoId)
                          : key === "albums" || key === "singles"
                            ? Boolean(item.browseId)
                            : key === "related"
                              ? Boolean(item.browseId)
                              : false;

                      return (
                        <MusicItem
                          key={`${key}-${title}-${index}`}
                          item={{
                            id: `${key}-${index}`,
                            title,
                            meta,
                            thumbnailUrl,
                            url: url ?? undefined,
                            downloadStatus: status,
                            isClickable,
                          }}
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
                          onDownload={url ? onQueueUrl : undefined}
                        />
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
