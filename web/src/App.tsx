import { useState } from "react";
import { Button } from "@heroui/react";
import { Download, X, Music2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { UrlInput } from "./components/UrlInput";
import { isValidUrl } from "./utils/url";
import { ConsoleOutput } from "./components/ConsoleOutput";
import { AlbumInfoCard, type TrackInfo } from "./components/AlbumInfoCard";
import { JobHistory } from "./components/JobHistory";
import { useJobs } from "./hooks/useJobs";

export default function App() {
  const [url, setUrl] = useState("");
  const {
    currentJobId,
    status,
    progress,
    logs,
    albumInfo,
    error,
    startJob,
    stopPolling,
    clearCurrentJob,
    jobs,
    refreshJobs,
    resumeJob,
  } = useJobs();

  const isSyncing =
    status === "pending" || status === "downloading" || status === "tagging";
  const canSync = isValidUrl(url) && !isSyncing;
  const showAlbumCard = isSyncing || status === "complete";

  // Extract track info from album info for the card
  const trackInfo: TrackInfo | null =
    albumInfo && status === "complete"
      ? {
          title: albumInfo.title,
          artist: albumInfo.artist,
          album: albumInfo.title,
        }
      : null;

  const handleSync = async () => {
    if (canSync) {
      await startJob(url);
    }
  };

  const handleClear = () => {
    clearCurrentJob();
    setUrl("");
    refreshJobs();
  };

  const handleCancel = () => {
    stopPolling();
    // Note: This only stops watching the job, the job continues on the server
  };

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <main className="w-full max-w-xl">
        {/* Header - v0 style with YouTube icon and version */}
        <div className="mb-6 flex items-center gap-2">
          <div className="bg-primary/10 rounded-lg p-2">
            <Music2 className="text-primary h-5 w-5" />
          </div>
          <div>
            <h1 className="text-foreground font-mono text-lg font-semibold">
              yubal
            </h1>
            <p className="text-default-500 font-mono text-xs">v0.1.0</p>
          </div>
        </div>

        {/* URL Input Section */}
        <div className="mb-6 flex gap-2">
          <div className="flex-1">
            <UrlInput value={url} onChange={setUrl} disabled={isSyncing} />
          </div>
          <Button
            color="primary"
            isIconOnly
            onPress={handleSync}
            isLoading={isSyncing}
            isDisabled={!canSync}
          >
            {!isSyncing && <Download className="h-4 w-4" />}
          </Button>
          {isSyncing && (
            <Button color="danger" isIconOnly onPress={handleCancel}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Error toast for job conflict */}
        {error && status === "error" && currentJobId && (
          <div className="bg-danger/10 text-danger border-danger/20 mb-4 rounded-lg border p-3 font-mono text-sm">
            <p>{error}</p>
            {currentJobId && (
              <Button
                size="sm"
                variant="light"
                color="danger"
                className="mt-2"
                onPress={() => resumeJob(currentJobId)}
              >
                View active job
              </Button>
            )}
          </div>
        )}

        {/* Album Info Card */}
        <AnimatePresence>
          {showAlbumCard && (
            <AlbumInfoCard
              trackInfo={trackInfo}
              progress={progress}
              status={status}
            />
          )}
        </AnimatePresence>

        {/* Console Output */}
        <ConsoleOutput logs={logs} status={status} />

        {/* Clear Button */}
        {(status === "complete" || status === "error") && (
          <div className="mt-4">
            <Button
              color="default"
              variant="flat"
              onPress={handleClear}
              fullWidth
            >
              Clear
            </Button>
          </div>
        )}

        {/* Job History (from backend) */}
        <JobHistory
          jobs={jobs}
          currentJobId={currentJobId}
          onRefresh={refreshJobs}
          onResume={resumeJob}
        />

        {/* Footer */}
        <div className="mt-6 space-y-1 text-center">
          <p className="text-default-500 font-mono text-xs">
            For educational purposes only
          </p>
          <p className="text-default-500/70 font-mono text-xs">
            Powered by{" "}
            <a
              href="https://github.com/yt-dlp/yt-dlp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              yt-dlp
            </a>
            {" & "}
            <a
              href="https://github.com/beetbox/beets"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              beets
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
