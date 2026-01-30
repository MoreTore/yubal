export interface ArtistThumbnail {
  url: string;
  width?: number;
  height?: number;
}

export interface ArtistItem {
  title?: string;
  name?: string;
  browseId?: string;
  videoId?: string;
  playlistId?: string;
  thumbnails?: ArtistThumbnail[];
  year?: string;
  views?: string;
  subscribers?: string;
  artist?: string;
  album?: string;
  [key: string]: unknown;
}

export interface ArtistSection {
  browseId?: string;
  params?: string;
  results?: ArtistItem[];
}

export interface ArtistResponse {
  description?: string;
  views?: string;
  name?: string;
  channelId?: string;
  shuffleId?: string;
  radioId?: string;
  subscribers?: string;
  subscribed?: boolean;
  thumbnails?: ArtistThumbnail[];
  songs?: ArtistSection;
  albums?: ArtistSection;
  singles?: ArtistSection;
  videos?: ArtistSection;
  related?: ArtistSection;
  [key: string]: unknown;
}

export async function fetchArtist(channelId: string): Promise<ArtistResponse> {
  const response = await fetch(`/api/artists/${channelId}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch artist");
  }

  return response.json() as Promise<ArtistResponse>;
}

export async function fetchArtistAlbums(
  channelId: string,
  params: string,
  options: {
    limit?: number;
    order?: "Recency" | "Popularity" | "Alphabetical order";
  } = {},
): Promise<ArtistItem[]> {
  const url = new URL(`/api/artists/${channelId}/albums`, window.location.origin);
  url.searchParams.set("params", params);
  if (options.limit) url.searchParams.set("limit", String(options.limit));
  if (options.order) url.searchParams.set("order", options.order);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to fetch artist albums");
  }

  return response.json() as Promise<ArtistItem[]>;
}
