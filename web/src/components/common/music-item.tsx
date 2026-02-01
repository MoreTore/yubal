import { Button } from "@heroui/react";
import { Download, ExternalLink } from "lucide-react";
import { DownloadStatusIcon, type DownloadStatus } from "./download-indicator";
import { PlayButton } from "./play-button";

export interface MusicItemData {
  id: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  thumbnailUrl?: string | null;
  url?: string | null;
  downloadStatus?: { status: DownloadStatus; progress: number | null };
  isClickable?: boolean;
  showExternalLink?: boolean;
  leadingContent?: React.ReactNode;
  videoId?: string | null;
  durationSeconds?: number | null;
}

interface MusicItemProps {
  item: MusicItemData;
  onClick?: () => void;
  onDownload?: (url: string) => void;
  size?: "sm" | "md" | "lg";
  showPlayButton?: boolean;
  trailingContent?: React.ReactNode;
}

export function MusicItem({
  item,
  onClick,
  onDownload,
  size = "md",
  showPlayButton = false,
  trailingContent,
}: MusicItemProps) {
  const {
    title,
    subtitle,
    meta,
    thumbnailUrl,
    url,
    downloadStatus = { status: "idle", progress: null },
    isClickable = false,
    showExternalLink = false,
    leadingContent,
    videoId,
    durationSeconds,
  } = item;

  const thumbnailSizes = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  };

  return (
    <div
      onClick={isClickable ? onClick : undefined}
      className={`bg-content2/60 flex items-center gap-3 rounded-xl px-3 py-2 ${
        isClickable ? "hover:bg-content2 cursor-pointer" : ""
      }`}
    >
      {leadingContent}
      {thumbnailUrl && (
        <img
          src={thumbnailUrl}
          alt={title}
          className={`${thumbnailSizes[size]} rounded-lg object-cover`}
          loading="lazy"
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="text-foreground-600 truncate text-sm font-medium">
          {title}
        </div>
        {subtitle && (
          <div className="text-foreground-400 truncate text-xs">{subtitle}</div>
        )}
        {meta && <div className="text-foreground-400 text-xs">{meta}</div>}
      </div>
      <div className="flex items-center gap-2">
        {showPlayButton && videoId && (
          <PlayButton
            videoId={videoId}
            title={title}
            subtitle={subtitle ?? meta ?? null}
            thumbnailUrl={thumbnailUrl ?? undefined}
            durationSeconds={durationSeconds ?? null}
          />
        )}
        {trailingContent}
        {url && onDownload && (
          <Button
            size="sm"
            variant="flat"
            onPress={() => onDownload(url)}
            onClick={(event) => event.stopPropagation()}
            isDisabled={
              downloadStatus.status === "queued" ||
              downloadStatus.status === "downloading"
            }
            isIconOnly
            aria-label={`Download ${title}`}
            startContent={
              downloadStatus.status === "idle" ? (
                <Download className="h-4 w-4" />
              ) : (
                <DownloadStatusIcon
                  status={downloadStatus.status}
                  progress={downloadStatus.progress}
                />
              )
            }
          />
        )}
        {url && showExternalLink && (
          <Button
            size="sm"
            variant="light"
            as="a"
            href={url}
            target="_blank"
            rel="noreferrer"
            isIconOnly
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
