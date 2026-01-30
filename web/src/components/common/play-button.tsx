import { useAudioPlayer } from "@/features/player/audio-player-provider";
import { Button } from "@heroui/react";
import { Loader2, Pause, Play } from "lucide-react";

interface PlayButtonProps {
  videoId: string;
  title: string;
  subtitle?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
}

export function PlayButton({
  videoId,
  title,
  subtitle,
  thumbnailUrl,
  durationSeconds,
}: PlayButtonProps) {
  const {
    currentTrack,
    status,
    isLoading,
    loadingVideoId,
    play,
    pause,
    resume,
  } = useAudioPlayer();

  const isCurrent = currentTrack?.videoId === videoId;
  const isPlaying = isCurrent && status === "playing";
  const isPending = isLoading && loadingVideoId === videoId;

  const handlePress = async () => {
    if (!videoId) return;
    if (isCurrent) {
      if (isPlaying) {
        pause();
      } else {
        try {
          await resume();
        } catch {
          // Errors already surfaced via toast.
        }
      }
      return;
    }

    try {
      await play(videoId, {
        title,
        artist: subtitle ?? null,
        thumbnailUrl: thumbnailUrl ?? null,
        durationSeconds: durationSeconds ?? null,
      });
    } catch {
      // Provider shows toast.
    }
  };

  return (
    <Button
      size="sm"
      variant="light"
      isIconOnly
      aria-label={isPlaying ? "Pause" : "Play"}
      onPress={() => {
        void handlePress();
      }}
      onClick={(event) => event.stopPropagation()}
      isDisabled={isLoading && !isPending && !isCurrent}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isPlaying ? (
        <Pause className="h-4 w-4" />
      ) : (
        <Play className="h-4 w-4" />
      )}
    </Button>
  );
}

