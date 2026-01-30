export interface SongThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface SongStream {
  url: string;
  mimeType?: string | null;
  bitrate?: number | null;
  audioSampleRate?: number | null;
  contentLength?: number | null;
  expiresAt?: string | null;
  proxyUrl?: string | null;
}

export interface SongPlayback {
  videoId: string;
  title?: string | null;
  artist?: string | null;
  channelId?: string | null;
  durationSeconds?: number | null;
  thumbnails?: SongThumbnail[];
  sourceUrl?: string | null;
  stream: SongStream;
}

export async function fetchSongPlayback(videoId: string): Promise<SongPlayback> {
  const response = await fetch(`/api/songs/${videoId}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load song playback");
  }

  return response.json() as Promise<SongPlayback>;
}
