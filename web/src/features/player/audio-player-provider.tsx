/* eslint-disable react-refresh/only-export-components */
import { fetchSongPlayback, type SongPlayback } from "@/api/song";
import { showErrorToast } from "@/lib/toast";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const EXPIRATION_BUFFER_MS = 30_000;

type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface PlayMetadata {
  title: string;
  artist?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
}

interface PlayerTrack {
  videoId: string;
  title: string;
  artist?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  sourceUrl?: string | null;
}

interface AudioPlayerContextValue {
  currentTrack: PlayerTrack | null;
  status: PlayerStatus;
  progressSeconds: number;
  durationSeconds: number | null;
  isLoading: boolean;
  loadingVideoId: string | null;
  play: (videoId: string, metadata: PlayMetadata) => Promise<void>;
  prefetch: (videoId: string) => void;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
}

interface PlayerState {
  currentTrack: PlayerTrack | null;
  status: PlayerStatus;
  progressSeconds: number;
  durationSeconds: number | null;
  loadingVideoId: string | null;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(
  undefined,
);

function isExpired(playback: SongPlayback | undefined): boolean {
  if (!playback?.stream?.expiresAt) return false;
  const expiresAt = Date.parse(playback.stream.expiresAt);
  if (Number.isNaN(expiresAt)) return false;
  return expiresAt - Date.now() <= EXPIRATION_BUFFER_MS;
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, SongPlayback>>(new Map());
  const requestIdRef = useRef(0);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    status: "idle",
    progressSeconds: 0,
    durationSeconds: null,
    loadingVideoId: null,
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.preload = "auto";
    audio.crossOrigin = "anonymous";

    const handleTimeUpdate = () => {
      setState((prev) =>
        prev.currentTrack
          ? { ...prev, progressSeconds: audio.currentTime }
          : prev,
      );
    };
    const handleLoadedMetadata = () => {
      setState((prev) =>
        prev.currentTrack
          ? {
              ...prev,
              durationSeconds: Number.isFinite(audio.duration)
                ? audio.duration
                : prev.durationSeconds,
            }
          : prev,
      );
    };
    const handlePlay = () => {
      setState((prev) =>
        prev.currentTrack ? { ...prev, status: "playing" } : prev,
      );
    };
    const handlePause = () => {
      setState((prev) =>
        prev.currentTrack && prev.status !== "loading"
          ? { ...prev, status: "paused" }
          : prev,
      );
    };
    const handleEnded = () => {
      setState((prev) =>
        prev.currentTrack
          ? {
              ...prev,
              status: "idle",
              progressSeconds: 0,
            }
          : prev,
      );
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const play = useCallback(
    async (videoId: string, metadata: PlayMetadata) => {
      const audio = audioRef.current;
      if (!audio) return;

      const requestId = ++requestIdRef.current;
      setState((prev) => ({
        ...prev,
        status: "loading",
        loadingVideoId: videoId,
      }));

      try {
        let playback = cacheRef.current.get(videoId);
        if (!playback || isExpired(playback)) {
          playback = await fetchSongPlayback(videoId);
          cacheRef.current.set(videoId, playback);
        }

        if (requestId !== requestIdRef.current) return;

        const thumbnailUrl =
          playback.thumbnails?.[0]?.url ?? metadata.thumbnailUrl ?? null;
        const title = playback.title ?? metadata.title;
        const artist = playback.artist ?? metadata.artist ?? null;
        const durationSeconds =
          playback.durationSeconds ?? metadata.durationSeconds ?? null;
        const streamSource =
          playback.stream.proxyUrl ?? playback.stream.url ?? null;

        if (!streamSource) {
          throw new Error("No stream URL available");
        }

        if (audio.src !== streamSource) {
          audio.src = streamSource;
        }
        audio.currentTime = 0;
        await audio.play();

        setState({
          currentTrack: {
            videoId: playback.videoId,
            title,
            artist,
            thumbnailUrl,
            durationSeconds,
            sourceUrl: playback.sourceUrl ?? null,
          },
          status: "playing",
          progressSeconds: 0,
          durationSeconds,
          loadingVideoId: null,
        });
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setState((prev) => ({
            ...prev,
            status: "error",
            loadingVideoId: null,
          }));
        }
        const message =
          error instanceof Error ? error.message : "Unable to start playback";
        showErrorToast("Playback failed", message);
      }
    },
    [],
  );

  const prefetch = useCallback((videoId: string) => {
    if (!videoId) return;
    const existing = cacheRef.current.get(videoId);
    if (existing && !isExpired(existing)) return;
    void fetchSongPlayback(videoId)
      .then((playback) => {
        cacheRef.current.set(videoId, playback);
      })
      .catch(() => {
        // Prefetch is best-effort; ignore failures.
      });
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
  }, []);

  const resume = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !state.currentTrack) return;
    try {
      await audio.play();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to resume playback";
      showErrorToast("Playback failed", message);
      throw error;
    }
  }, [state.currentTrack]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    setState({
      currentTrack: null,
      status: "idle",
      progressSeconds: 0,
      durationSeconds: null,
      loadingVideoId: null,
    });
  }, []);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({
      currentTrack: state.currentTrack,
      status: state.status,
      progressSeconds: state.progressSeconds,
      durationSeconds: state.durationSeconds,
      isLoading: state.status === "loading",
      loadingVideoId: state.loadingVideoId,
      play,
      prefetch,
      pause,
      resume,
      stop,
    }),
    [state, play, prefetch, pause, resume, stop],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} className="hidden" />
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  }
  return context;
}

