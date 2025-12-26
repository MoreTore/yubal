import { useState, useCallback, useRef, useEffect } from "react";
import {
  createJob,
  getJob,
  listJobs,
  cancelJob as cancelJobApi,
  type Job,
  type JobStatus,
  type AlbumInfo,
} from "../api/jobs";

export type ProgressStep =
  | "idle"
  | "pending"
  | "fetching_info"
  | "downloading"
  | "importing"
  | "complete"
  | "error"
  | "cancelled";

export interface LogEntry {
  id: number;
  timestamp: Date;
  step: ProgressStep;
  message: string;
}

export interface UseJobsResult {
  // Current job state
  currentJobId: string | null;
  status: ProgressStep;
  progress: number;
  logs: LogEntry[];
  albumInfo: AlbumInfo | null;
  error: string | null;

  // Actions
  startJob: (url: string, audioFormat?: string) => Promise<void>;
  stopPolling: () => void;
  clearCurrentJob: () => void;
  cancelJob: (jobId: string) => Promise<void>;

  // Job list
  jobs: Job[];
  activeJobs: Job[];
  completedJobs: Job[];
  refreshJobs: () => Promise<void>;
  resumeJob: (jobId: string) => void;
}

const POLL_INTERVAL = 2000; // 2 seconds

function mapJobStatus(status: JobStatus): ProgressStep {
  switch (status) {
    case "pending":
      return "pending";
    case "fetching_info":
      return "fetching_info";
    case "downloading":
      return "downloading";
    case "importing":
      return "importing";
    case "completed":
      return "complete";
    case "failed":
      return "error";
    case "cancelled":
      return "cancelled";
    default:
      return "idle";
  }
}

// Map backend log step values to frontend ProgressStep
// Backend ProgressStep: "starting", "downloading", "tagging", "complete", "error"
function mapLogStep(step: string): ProgressStep {
  switch (step) {
    case "starting":
      return "fetching_info";
    case "downloading":
      return "downloading";
    case "tagging":
      return "importing";
    case "complete":
      return "complete";
    case "error":
      return "error";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export function useJobs(): UseJobsResult {
  // Current job state
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<ProgressStep>("idle");
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [albumInfo, setAlbumInfo] = useState<AlbumInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Job list
  const [jobs, setJobs] = useState<Job[]>([]);

  // Refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const logIdRef = useRef(0);
  const lastMessageRef = useRef<string>("");

  const addLog = useCallback((step: ProgressStep, message: string) => {
    // Skip if same message as last logged
    if (message === lastMessageRef.current) return;
    lastMessageRef.current = message;

    logIdRef.current += 1;
    setLogs((prev) => [
      ...prev,
      {
        id: logIdRef.current,
        timestamp: new Date(),
        step,
        message,
      },
    ]);
  }, []);

  const resetState = useCallback(() => {
    setStatus("idle");
    setProgress(0);
    setLogs([]);
    setAlbumInfo(null);
    setError(null);
    logIdRef.current = 0;
    lastMessageRef.current = "";
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();

      const poll = async () => {
        const job = await getJob(jobId);
        if (!job) {
          stopPolling();
          setError("Job not found");
          setStatus("error");
          return;
        }

        const newStatus = mapJobStatus(job.status as JobStatus);
        setStatus(newStatus);
        setProgress(job.progress);

        // Update the job in the jobs array so DownloadsPanel gets live updates
        setJobs((prevJobs) => prevJobs.map((j) => (j.id === jobId ? job : j)));

        if (job.album_info) {
          setAlbumInfo(job.album_info);
        }

        if (job.message) {
          addLog(newStatus, job.message);
        }

        if (job.error) {
          setError(job.error);
        }

        // Stop polling if job is complete, failed, or cancelled
        if (
          newStatus === "complete" ||
          newStatus === "error" ||
          newStatus === "cancelled"
        ) {
          stopPolling();
        }
      };

      // Poll immediately, then at interval
      poll();
      pollingRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [addLog, stopPolling]
  );

  const startJob = useCallback(
    async (url: string, audioFormat = "mp3") => {
      resetState();
      setStatus("pending");
      addLog("pending", `Creating job for: ${url}`);

      const result = await createJob(url, audioFormat);

      if (!result.success) {
        setStatus("error");
        setError(result.error);
        addLog("error", result.error);

        // If there's an active job, set it as current so user can see it
        if (result.activeJobId) {
          setCurrentJobId(result.activeJobId);
          addLog("pending", `Active job: ${result.activeJobId}`);
        }
        return;
      }

      setCurrentJobId(result.jobId);
      addLog("pending", `Job created: ${result.jobId}`);

      // Refresh job list to show the new job immediately
      const { jobs: jobList } = await listJobs();
      setJobs(jobList);

      startPolling(result.jobId);
    },
    [addLog, resetState, startPolling]
  );

  const clearCurrentJob = useCallback(() => {
    stopPolling();
    setCurrentJobId(null);
    resetState();
  }, [resetState, stopPolling]);

  const refreshJobs = useCallback(async () => {
    const { jobs: jobList, activeJobId } = await listJobs();
    setJobs(jobList);

    // Auto-resume active job if we're not tracking any
    if (activeJobId && !currentJobId) {
      const activeJob = jobList.find((j) => j.id === activeJobId);
      if (
        activeJob &&
        !["completed", "failed", "cancelled"].includes(activeJob.status)
      ) {
        // Resume the active job
        setCurrentJobId(activeJobId);
        setStatus(mapJobStatus(activeJob.status as JobStatus));
        setProgress(activeJob.progress);
        if (activeJob.album_info) {
          setAlbumInfo(activeJob.album_info);
        }

        // Load existing logs
        const newLogs = activeJob.logs.map((log, i) => ({
          id: i + 1,
          timestamp: new Date(log.timestamp),
          step: mapLogStep(log.step),
          message: log.message,
        }));
        setLogs(newLogs);
        logIdRef.current = newLogs.length;

        // Start polling
        startPolling(activeJobId);
      }
    }
  }, [currentJobId, startPolling]);

  const cancelJob = useCallback(
    async (jobId: string) => {
      await cancelJobApi(jobId);
      // If cancelling current job, stop polling and update status
      if (jobId === currentJobId) {
        stopPolling();
        setStatus("cancelled");
        addLog("cancelled", "Job cancelled by user");
      }
      // Refresh the job list to get updated statuses
      const { jobs: jobList } = await listJobs();
      setJobs(jobList);
    },
    [currentJobId, stopPolling, addLog]
  );

  const resumeJob = useCallback(
    (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;

      resetState();
      setCurrentJobId(jobId);
      setStatus(mapJobStatus(job.status as JobStatus));
      setProgress(job.progress);
      if (job.album_info) {
        setAlbumInfo(job.album_info);
      }
      if (job.error) {
        setError(job.error);
      }

      // Load existing logs
      const newLogs = job.logs.map((log, i) => ({
        id: i + 1,
        timestamp: new Date(log.timestamp),
        step: mapLogStep(log.step),
        message: log.message,
      }));
      setLogs(newLogs);
      logIdRef.current = newLogs.length;

      // If job is still running, start polling
      if (!["completed", "failed", "cancelled"].includes(job.status)) {
        startPolling(jobId);
      }
    },
    [jobs, resetState, startPolling]
  );

  // Computed job lists
  const activeJobs = jobs.filter((job) =>
    ["pending", "fetching_info", "downloading", "importing"].includes(
      job.status
    )
  );
  const completedJobs = jobs.filter((job) =>
    ["completed", "failed", "cancelled"].includes(job.status)
  );

  // Refresh jobs on mount and check for active job
  useEffect(() => {
    refreshJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    currentJobId,
    status,
    progress,
    logs,
    albumInfo,
    error,
    startJob,
    stopPolling,
    clearCurrentJob,
    cancelJob,
    jobs,
    activeJobs,
    completedJobs,
    refreshJobs,
    resumeJob,
  };
}
