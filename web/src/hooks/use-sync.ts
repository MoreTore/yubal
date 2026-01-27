import { useCallback, useEffect, useState } from "react";
import {
  addPlaylist as addPlaylistApi,
  deletePlaylist as deletePlaylistApi,
  getStatus,
  listPlaylists,
  syncAll as syncAllApi,
  syncPlaylist as syncPlaylistApi,
  updatePlaylist as updatePlaylistApi,
  type SchedulerStatus,
  type SyncedPlaylist,
} from "../api/sync";
import { showErrorToast } from "../lib/toast";

export type { SchedulerStatus, SyncedPlaylist } from "../api/sync";

export interface UseSyncResult {
  playlists: SyncedPlaylist[];
  schedulerStatus: SchedulerStatus | null;
  isLoading: boolean;
  addPlaylist: (url: string, name: string) => Promise<boolean>;
  updatePlaylist: (
    id: string,
    updates: { name?: string; enabled?: boolean },
  ) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  syncPlaylist: (id: string) => Promise<void>;
  syncAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useSync(): UseSyncResult {
  const [playlists, setPlaylists] = useState<SyncedPlaylist[]>([]);
  const [schedulerStatus, setSchedulerStatus] =
    useState<SchedulerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [playlistsData, statusData] = await Promise.all([
      listPlaylists(),
      getStatus(),
    ]);
    setPlaylists(playlistsData);
    setSchedulerStatus(statusData);
  }, []);

  const refresh = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  const addPlaylist = useCallback(
    async (url: string, name: string): Promise<boolean> => {
      const result = await addPlaylistApi(url, name);
      if (!result.success) {
        showErrorToast("Failed to add playlist", result.error);
        return false;
      }
      await fetchData();
      return true;
    },
    [fetchData],
  );

  const updatePlaylist = useCallback(
    async (id: string, updates: { name?: string; enabled?: boolean }) => {
      await updatePlaylistApi(id, updates);
      await fetchData();
    },
    [fetchData],
  );

  const deletePlaylist = useCallback(
    async (id: string) => {
      await deletePlaylistApi(id);
      await fetchData();
    },
    [fetchData],
  );

  const syncPlaylist = useCallback(
    async (id: string) => {
      const result = await syncPlaylistApi(id);
      if (!result.success) {
        showErrorToast("Sync failed", result.error);
        return;
      }
      await fetchData();
    },
    [fetchData],
  );

  const syncAll = useCallback(async () => {
    const result = await syncAllApi();
    if (!result.success) {
      showErrorToast("Sync failed", result.error);
      return;
    }
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        await fetchData();
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, [fetchData]);

  return {
    playlists,
    schedulerStatus,
    isLoading,
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
    syncAll,
    refresh,
  };
}
