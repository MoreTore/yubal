interface ThumbnailSource {
  thumbnails?: Array<{ url: string; width?: number; height?: number }>;
}

export function getThumbnailUrl(item: ThumbnailSource | null | undefined): string | null {
  const thumbnails = item?.thumbnails;
  if (!thumbnails || thumbnails.length === 0) return null;

  const sorted = [...thumbnails].sort((a, b) => {
    const aSize = (a.width ?? 0) * (a.height ?? 0);
    const bSize = (b.width ?? 0) * (b.height ?? 0);
    return bSize - aSize;
  });

  return sorted[0]?.url ?? null;
}

interface TitleSource {
  title?: string;
  name?: string;
  artist?: string;
  author?: string;
  artists?: Array<{ name: string }>;
}

export function getTitle(item: TitleSource, defaultValue = "Untitled"): string {
  const primaryArtist = item.artists?.[0]?.name;
  return item.title || item.name || primaryArtist || item.artist || item.author || defaultValue;
}

interface SubtitleSource {
  artists?: Array<{ name: string }>;
  artist?: string;
  author?: string;
  subscribers?: string;
  description?: string;
}

export function getSubtitle(item: SubtitleSource): string | null {
  if (item.artists) {
    const names = item.artists.map((artist) => artist.name).filter(Boolean);
    if (names.length > 0) return names.join(", ");
  }
  return item.artist || item.author || item.subscribers || item.description || null;
}

interface BrowseIdSource {
  browseId?: string;
  channelId?: string;
  artists?: Array<{ id?: string }>;
}

export function getBrowseId(item: BrowseIdSource): string | null {
  const candidates = [item.browseId, item.channelId, item.artists?.[0]?.id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

interface UrlSource {
  videoId?: string;
  playlistId?: string;
  browseId?: string;
}

export function getMusicUrl(item: UrlSource): string | null {
  if (item.videoId) {
    return `https://music.youtube.com/watch?v=${item.videoId}`;
  }
  if (item.playlistId) {
    return `https://music.youtube.com/playlist?list=${item.playlistId}`;
  }
  if (item.browseId) {
    return `https://music.youtube.com/browse/${item.browseId}`;
  }
  return null;
}

export function formatTypeLabel(value: string | undefined): string | null {
  if (!value) return null;
  const text = value.replace(/[_-]+/g, " ").toLowerCase();
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}
