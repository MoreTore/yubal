import { Button } from "@heroui/react";
import {
  Clock,
  Music,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Job } from "../api/jobs";
import { deleteJob, clearJobs } from "../api/jobs";

interface JobHistoryProps {
  jobs: Job[];
  currentJobId: string | null;
  onRefresh: () => void;
  onResume: (jobId: string) => void;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "complete":
      return <CheckCircle className="text-success h-4 w-4" />;
    case "failed":
      return <XCircle className="text-danger h-4 w-4" />;
    case "downloading":
    case "tagging":
    case "pending":
      return <Loader2 className="text-primary h-4 w-4 animate-spin" />;
    default:
      return <Music className="text-default-400 h-4 w-4" />;
  }
}

export function JobHistory({
  jobs,
  currentJobId,
  onRefresh,
  onResume,
}: JobHistoryProps) {
  // Filter out current job
  const historyJobs = jobs.filter((job) => job.id !== currentJobId);

  if (historyJobs.length === 0) return null;

  const handleDelete = async (jobId: string) => {
    await deleteJob(jobId);
    onRefresh();
  };

  const handleClearAll = async () => {
    await clearJobs();
    onRefresh();
  };

  const completedCount = historyJobs.filter(
    (j) => j.status === "complete" || j.status === "failed"
  ).length;

  return (
    <div className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="text-default-500 h-4 w-4" />
          <span className="text-foreground font-mono text-sm font-medium">
            Job History
          </span>
          <span className="text-default-500 font-mono text-xs">
            ({historyJobs.length})
          </span>
        </div>
        {completedCount > 0 && (
          <Button
            variant="light"
            size="sm"
            onPress={handleClearAll}
            className="text-default-500 font-mono text-xs"
          >
            Clear All
          </Button>
        )}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {historyJobs.map((job) => {
            const isRunning = !["complete", "failed"].includes(job.status);
            const albumTitle = job.album_info?.title || "Unknown Album";
            const artistName = job.album_info?.artist || "Unknown Artist";

            return (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="group bg-default-50 flex items-center gap-3 rounded-lg border border-white/10 p-3"
              >
                <div className="bg-default-100 flex h-10 w-10 shrink-0 items-center justify-center rounded">
                  <StatusIcon status={job.status} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate font-mono text-sm font-medium">
                    {albumTitle}
                  </p>
                  <p className="text-default-500 truncate font-mono text-xs">
                    {artistName}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`font-mono text-xs ${
                        job.status === "complete"
                          ? "text-success"
                          : job.status === "failed"
                            ? "text-danger"
                            : "text-primary"
                      }`}
                    >
                      {job.status}
                    </span>
                    {job.progress > 0 && job.progress < 100 && (
                      <>
                        <span className="text-default-300 text-xs">
                          &#8226;
                        </span>
                        <span className="text-default-400 font-mono text-xs">
                          {Math.round(job.progress)}%
                        </span>
                      </>
                    )}
                    <span className="text-default-300 text-xs">&#8226;</span>
                    <span className="text-default-400 font-mono text-xs">
                      {formatDate(job.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {isRunning ? (
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => onResume(job.id)}
                      title="View progress"
                    >
                      <Play className="text-primary h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button
                      isIconOnly
                      variant="light"
                      size="sm"
                      onPress={() => handleDelete(job.id)}
                      title="Delete job"
                    >
                      <Trash2 className="text-default-400 h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
