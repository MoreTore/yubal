import { useEffect, useState } from "react";
import { fetchArtist, type ArtistResponse } from "../api/artist";
import { showErrorToast } from "../lib/toast";

export function useArtist(channelId: string | null) {
  const [artist, setArtist] = useState<ArtistResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!channelId) {
      setArtist(null);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    fetchArtist(channelId)
      .then((data) => {
        if (active) setArtist(data);
      })
      .catch((error) => {
        const message =
          error instanceof Error ? error.message : "Unable to load artist";
        showErrorToast("Artist load failed", message);
        if (active) setArtist(null);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [channelId]);

  return { artist, isLoading };
}
