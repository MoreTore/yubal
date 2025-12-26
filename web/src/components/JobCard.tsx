import { Button, Progress } from "@heroui/react";
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Play,
  Trash2,
} from "lucide-react";
import type { Job, JobStatus } from "../api/jobs";

interface JobCardProps {
  job: Job;
  isActive?: boolean;
  onCancel?: (jobId: string) => void;
  onResume?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
}

function getStatusIcon(status: JobStatus) {
  switch (status) {
    case "pending":
      return <Clock className="text-default-400 h-3.5 w-3.5" />;
    case "fetching_info":
      return <Loader2 className="text-default-500 h-3.5 w-3.5 animate-spin" />;
    case "downloading":
      return <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />;
    case "importing":
      return <Loader2 className="text-secondary h-3.5 w-3.5 animate-spin" />;
    case "completed":
      return <CheckCircle className="text-success h-3.5 w-3.5" />;
    case "failed":
      return <XCircle className="text-danger h-3.5 w-3.5" />;
    case "cancelled":
      return <X className="text-warning h-3.5 w-3.5" />;
  }
}

function getProgressColor(
  status: JobStatus
): "default" | "primary" | "secondary" | "success" | "warning" | "danger" {
  switch (status) {
    case "downloading":
      return "primary";
    case "importing":
      return "secondary";
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "cancelled":
      return "warning";
    default:
      return "default";
  }
}

function isRunningStatus(status: JobStatus): boolean {
  return ["pending", "fetching_info", "downloading", "importing"].includes(
    status
  );
}

function isFinishedStatus(status: JobStatus): boolean {
  return ["completed", "failed", "cancelled"].includes(status);
}

export function JobCard({
  job,
  isActive,
  onCancel,
  onResume,
  onDelete,
}: JobCardProps) {
  const isRunning = isRunningStatus(job.status);
  const isFinished = isFinishedStatus(job.status);
  const showProgress = isRunning;

  // Get display info - prefer album_info if available
  const title = job.album_info?.title || null;
  const artist = job.album_info?.artist || null;
  const trackCount = job.album_info?.track_count || null;

  return (
    <div
      className={`bg-background rounded-lg border px-3 py-2.5 transition-colors ${
        isActive
          ? "border-primary/50 bg-primary/5"
          : job.status === "cancelled"
            ? "border-default-200 opacity-50"
            : "border-default-200"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0">{getStatusIcon(job.status)}</div>
        <div className="min-w-0 flex-1">
          {title ? (
            <>
              <p className="text-foreground truncate font-mono text-sm">
                {title}
              </p>
              <div className="flex items-center gap-2">
                <p className="text-default-500 truncate font-mono text-xs">
                  {artist}
                </p>
                {isFinished && trackCount && (
                  <>
                    <span className="text-default-400/30 text-xs">·</span>
                    <span className="text-default-500/70 font-mono text-xs">
                      {trackCount} tracks
                    </span>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-default-500 truncate font-mono text-xs">
              {job.url}
            </p>
          )}
        </div>
        {isRunning && onCancel && (
          <Button
            variant="light"
            size="sm"
            isIconOnly
            className="text-default-500 hover:text-danger h-7 w-7 shrink-0"
            onPress={() => onCancel(job.id)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
        {isFinished && !isActive && onResume && (
          <Button
            variant="light"
            size="sm"
            isIconOnly
            className="text-default-500 hover:text-primary h-7 w-7 shrink-0"
            onPress={() => onResume(job.id)}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
        )}
        {isFinished && onDelete && (
          <Button
            variant="light"
            size="sm"
            isIconOnly
            className="text-default-500 hover:text-danger h-7 w-7 shrink-0"
            onPress={() => onDelete(job.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {showProgress && (
        <div className="mt-2 flex items-center gap-2">
          <Progress
            value={job.progress}
            size="sm"
            color={getProgressColor(job.status as JobStatus)}
            className="flex-1"
            classNames={{
              indicator: "transition-all duration-500 ease-out",
            }}
            aria-label="Job progress"
          />
          <span className="text-default-500 w-8 text-right font-mono text-xs">
            {Math.round(job.progress)}%
          </span>
        </div>
      )}
    </div>
  );
}
