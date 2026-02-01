import { Button } from "@heroui/react";
import { Disc3 } from "lucide-react";
import { DownloadStatusIcon, type DownloadStatus } from "./download-indicator";

interface DiscographyDownloadButtonProps {
  channelId?: string | null;
  artistName?: string | null;
  downloadStatuses: Record<
    string,
    { status: DownloadStatus; progress: number | null }
  >;
  onDownloadDiscography?: (channelId: string, url: string) => void;
  stopPropagation?: boolean;
  ariaLabel?: string;
}

export function DiscographyDownloadButton({
  channelId,
  artistName,
  downloadStatuses,
  onDownloadDiscography,
  stopPropagation = true,
  ariaLabel,
}: DiscographyDownloadButtonProps) {
  if (!channelId || !onDownloadDiscography) return null;

  const discographyUrl = `https://music.youtube.com/browse/${channelId}`;
  const status = downloadStatuses[discographyUrl] ?? {
    status: "idle" as DownloadStatus,
    progress: null,
  };
  const isDisabled =
    status.status === "queued" || status.status === "downloading";
  const label =
    ariaLabel ?? `Download ${artistName ?? "artist"} discography`;

  return (
    <Button
      size="sm"
      variant="flat"
      onPress={() => onDownloadDiscography(channelId, discographyUrl)}
      onClick={
        stopPropagation
          ? (event) => {
              event.stopPropagation();
            }
          : undefined
      }
      isDisabled={isDisabled}
      isIconOnly
      aria-label={label}
      startContent={
        status.status === "idle" ? (
          <Disc3 className="h-4 w-4" />
        ) : (
          <DownloadStatusIcon
            status={status.status}
            progress={status.progress}
          />
        )
      }
    />
  );
}
