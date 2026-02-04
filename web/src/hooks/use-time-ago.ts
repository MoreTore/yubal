import { useEffect, useState } from "react";
import { formatTimeAgo } from "@/lib/format";

const INTERVAL_MS = 1000;

export function useTimeAgo(dateString: string | null | undefined): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!dateString) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [dateString]);

  return formatTimeAgo(dateString);
}
