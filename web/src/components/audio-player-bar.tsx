import { useAudioPlayer } from "@/features/player/audio-player-provider";
import { Button } from "@heroui/react";
import { Pause, Play, Square } from "lucide-react";

function formatTime(value: number | null): string {
  if (!value || Number.isNaN(value)) return "0:00";
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function AudioPlayerBar() {
  const {
    currentTrack,
    status,
    progressSeconds,
    durationSeconds,
    pause,
    resume,
    stop,
    isLoading,
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const isPlaying = status === "playing";
  const progressPercent =
    durationSeconds && durationSeconds > 0
      ? Math.min(100, (progressSeconds / durationSeconds) * 100)
      : 0;

  return (
    <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-40 px-4">
      <div className="pointer-events-auto mx-auto flex max-w-4xl flex-wrap items-center gap-4 rounded-2xl border border-content3/40 bg-background/95 p-4 shadow-2xl backdrop-blur">
        {currentTrack.thumbnailUrl ? (
          <img
            src={currentTrack.thumbnailUrl}
            alt={currentTrack.title}
            className="h-14 w-14 rounded-xl object-cover"
            loading="lazy"
          />
        ) : (
          <div className="bg-content2/60 text-foreground flex h-14 w-14 items-center justify-center rounded-xl text-lg font-semibold">
            ♫
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-foreground truncate font-semibold">
            {currentTrack.title}
          </div>
          {currentTrack.artist && (
            <div className="text-foreground-400 truncate text-sm">
              {currentTrack.artist}
            </div>
          )}
          <div className="mt-2 h-1.5 w-full rounded-full bg-content2/70">
            <div
              className="bg-primary h-full rounded-full transition-[width]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-foreground-500 mt-1 text-[11px] font-mono">
            {formatTime(progressSeconds)} / {formatTime(durationSeconds)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="light"
            size="sm"
            isIconOnly
            aria-label="Stop playback"
            onPress={stop}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            color="primary"
            size="sm"
            isIconOnly
            aria-label={isPlaying ? "Pause playback" : "Resume playback"}
            onPress={() => {
              if (isPlaying) {
                pause();
              } else {
                void resume();
              }
            }}
            isDisabled={isLoading}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

