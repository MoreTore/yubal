import { useState, useCallback, useRef, useEffect } from "react";
import {
  createJob,
  getJob,
  listJobs,
  type Job,
  type JobStatus,
  type AlbumInfo,
} from "../api/jobs";

export type ProgressStep =
  | "idle"
  | "pending"
  | "downloading"
  | "tagging"
  | "complete"
  | "error";

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

  // Job list
  jobs: Job[];
  refreshJobs: () => Promise<void>;
  resumeJob: (jobId: string) => void;
}

const POLL_INTERVAL = 2000; // 2 seconds

function mapJobStatus(status: JobStatus): ProgressStep {
  switch (status) {
    case "pending":
      return "pending";
    case "downloading":
      return "downloading";
    case "tagging":
      return "tagging";
    case "complete":
      return "complete";
    case "failed":
      return "error";
    default:
      return "idle";
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

        if (job.album_info) {
          setAlbumInfo(job.album_info);
        }

        if (job.message) {
          addLog(newStatus, job.message);
        }

        if (job.error) {
          setError(job.error);
        }

        // Stop polling if job is complete or failed
        if (newStatus === "complete" || newStatus === "error") {
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
      if (activeJob && !["complete", "failed"].includes(activeJob.status)) {
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
          step: mapJobStatus(log.step as JobStatus),
          message: log.message,
        }));
        setLogs(newLogs);
        logIdRef.current = newLogs.length;

        // Start polling
        startPolling(activeJobId);
      }
    }
  }, [currentJobId, startPolling]);

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
        step: mapJobStatus(log.step as JobStatus),
        message: log.message,
      }));
      setLogs(newLogs);
      logIdRef.current = newLogs.length;

      // If job is still running, start polling
      if (!["complete", "failed"].includes(job.status)) {
        startPolling(jobId);
      }
    },
    [jobs, resetState, startPolling]
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
    jobs,
    refreshJobs,
    resumeJob,
  };
}
