import { api } from "./client";
import type { components } from "./schema";

export type SyncedPlaylist = components["schemas"]["SyncedPlaylistResponse"];
export type SyncConfig = components["schemas"]["SyncConfigResponse"];
export type SyncStatus = components["schemas"]["SyncStatusResponse"];

export type AddPlaylistResult =
  | { success: true; id: string }
  | { success: false; error: string };

export type SyncResult =
  | { success: true; jobId: string }
  | { success: false; error: string };

export type SyncAllResult =
  | { success: true; jobIds: string[] }
  | { success: false; error: string };

// --- Playlists ---

export async function listPlaylists(): Promise<SyncedPlaylist[]> {
  const { data, error } = await api.GET("/sync/playlists");
  if (error) return [];
  return data.playlists;
}

export async function addPlaylist(
  url: string,
  name: string,
): Promise<AddPlaylistResult> {
  const { data, error, response } = await api.POST("/sync/playlists", {
    body: { url, name },
  });

  if (error) {
    if (response.status === 409) {
      const conflict = error as { message: string };
      return { success: false, error: conflict.message };
    }
    if (response.status === 422) {
      const validation = error as { detail?: { msg: string }[] };
      return {
        success: false,
        error: validation.detail?.[0]?.msg ?? "Invalid input",
      };
    }
    return { success: false, error: "Failed to add playlist" };
  }

  return { success: true, id: data.id };
}

export async function getPlaylist(id: string): Promise<SyncedPlaylist | null> {
  const { data, error } = await api.GET("/sync/playlists/{playlist_id}", {
    params: { path: { playlist_id: id } },
  });
  if (error) return null;
  return data;
}

export async function updatePlaylist(
  id: string,
  updates: { name?: string; enabled?: boolean },
): Promise<SyncedPlaylist | null> {
  const { data, error } = await api.PATCH("/sync/playlists/{playlist_id}", {
    params: { path: { playlist_id: id } },
    body: updates,
  });
  if (error) return null;
  return data;
}

export async function deletePlaylist(id: string): Promise<boolean> {
  const { error } = await api.DELETE("/sync/playlists/{playlist_id}", {
    params: { path: { playlist_id: id } },
  });
  return !error;
}

// --- Sync Jobs ---

export async function syncPlaylist(id: string): Promise<SyncResult> {
  const { data, error, response } = await api.POST(
    "/sync/playlists/{playlist_id}/sync",
    {
      params: { path: { playlist_id: id } },
    },
  );

  if (error) {
    if (response.status === 404) {
      return { success: false, error: "Playlist not found" };
    }
    if (response.status === 409) {
      return { success: false, error: "Job queue is full" };
    }
    return { success: false, error: "Failed to create sync job" };
  }

  return { success: true, jobId: data.job_id };
}

export async function syncAll(): Promise<SyncAllResult> {
  const { data, error } = await api.POST("/sync/run");

  if (error) {
    return { success: false, error: "Failed to create sync jobs" };
  }

  return { success: true, jobIds: data.job_ids };
}

// --- Config ---

export async function getConfig(): Promise<SyncConfig | null> {
  const { data, error } = await api.GET("/sync/config");
  if (error) return null;
  return data;
}

export async function updateConfig(updates: {
  enabled?: boolean;
  interval_minutes?: number;
}): Promise<SyncConfig | null> {
  const { data, error } = await api.PATCH("/sync/config", {
    body: updates,
  });
  if (error) return null;
  return data;
}

// --- Status ---

export async function getStatus(): Promise<SyncStatus | null> {
  const { data, error } = await api.GET("/sync/status");
  if (error) return null;
  return data;
}
