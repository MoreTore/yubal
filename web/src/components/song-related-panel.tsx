import { Button } from "@heroui/react";
import { ArrowLeft, Music2 } from "lucide-react";
import type { RelatedSection } from "../api/song-related";
import {
    getBrowseId,
    getMusicUrl,
    getSubtitle,
    getThumbnailUrl,
    getTitle,
} from "../lib/music-helpers";
import { type DownloadStatus } from "./common/download-indicator";
import { DiscographyDownloadButton } from "./common/discography-download-button";
import { EmptyState } from "./common/empty-state";
import { MusicItem } from "./common/music-item";
import { Panel, PanelContent, PanelHeader } from "./common/panel";

interface SongRelatedPanelProps {
  sections: RelatedSection[];
  isLoading: boolean;
  onQueueUrl: (url: string) => void;
  downloadStatuses: Record<
    string,
    { status: DownloadStatus; progress: number | null }
  >;
  onViewSong: (videoId: string) => void;
  onViewAlbum: (browseId: string) => void;
  onViewArtist: (channelId: string) => void;
  onDownloadDiscography: (channelId: string, url: string) => void;
  onBack: () => void;
}

function isArtistSection(title: string | undefined): boolean {
  if (!title) return false;
  return title.toLowerCase().includes("artist");
}

export function SongRelatedPanel({
  sections,
  isLoading,
  onQueueUrl,
  downloadStatuses,
  onViewSong,
  onViewAlbum,
  onViewArtist,
  onDownloadDiscography,
  onBack,
}: SongRelatedPanelProps) {
  return (
    <Panel>
      <PanelHeader
        leadingIcon={<Music2 size={18} />}
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
        Related
      </PanelHeader>
      <PanelContent height="h-[520px]" className="space-y-4">
        {isLoading ? (
          <EmptyState icon={Music2} title="Loading related..." />
        ) : sections.length === 0 ? (
          <EmptyState icon={Music2} title="No related content" />
        ) : (
          <div className="space-y-6">
            {sections.map((section, sectionIndex) => (
              <section key={`${section.title ?? "section"}-${sectionIndex}`}>
                {section.title && (
                  <div className="text-foreground-400 mb-2 text-xs tracking-wider uppercase">
                    {section.title}
                  </div>
                )}
                {typeof section.contents === "string" ? (
                  <div className="text-foreground-500 text-sm leading-relaxed">
                    {section.contents}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(section.contents ?? []).map((item, index) => {
                      const title = getTitle(item);
                      const subtitle = getSubtitle(item);
                      const thumbnailUrl = getThumbnailUrl(item);
                      const url = getMusicUrl(item);
                      const browseId = getBrowseId(item);
                      const isArtist =
                        isArtistSection(section.title) ||
                        Boolean(item.subscribers);
                      const artistChannelId = isArtist ? browseId : null;
                      const canView = Boolean(item.videoId || browseId);
                      const status = url
                        ? (downloadStatuses[url] ?? {
                            status: "idle" as DownloadStatus,
                            progress: null,
                          })
                        : { status: "idle" as DownloadStatus, progress: null };
                      const discographyAction = (
                        <DiscographyDownloadButton
                          channelId={artistChannelId}
                          artistName={title}
                          downloadStatuses={downloadStatuses}
                          onDownloadDiscography={onDownloadDiscography}
                        />
                      );
                      const meta = [item.year, item.duration, item.itemCount]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <MusicItem
                          key={`${title}-${index}`}
                          item={{
                            id: `${section.title}-${index}`,
                            title,
                            subtitle,
                            meta: meta || null,
                            thumbnailUrl,
                            url: url ?? undefined,
                            downloadStatus: status,
                            isClickable: canView,
                            videoId: item.videoId ?? undefined,
                          }}
                          size="sm"
                          onClick={() => {
                            if (item.videoId) {
                              onViewSong(item.videoId);
                              return;
                            }
                            if (browseId) {
                              if (isArtist) {
                                onViewArtist(browseId);
                              } else {
                                onViewAlbum(browseId);
                              }
                            }
                          }}
                          onDownload={
                            !isArtist && url ? onQueueUrl : undefined
                          }
                          trailingContent={discographyAction}
                          showPlayButton={Boolean(item.videoId)}
                        />
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </PanelContent>
    </Panel>
  );
}
