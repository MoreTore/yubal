import { api } from "./client";
import type { components } from "./schema";

// Re-export types from schema
export type Job = components["schemas"]["JobResponse"];
export type JobLog = components["schemas"]["LogEntrySchema"];
export type AlbumInfo = components["schemas"]["AlbumInfo"];

export type JobStatus =
  | "pending"
  | "downloading"
  | "tagging"
  | "complete"
  | "failed";

export type CreateJobResult =
  | {
      success: true;
      jobId: string;
    }
  | {
      success: false;
      error: string;
      activeJobId?: string;
    };

export async function createJob(
  url: string,
  audioFormat = "mp3"
): Promise<CreateJobResult> {
  const { data, error, response } = await api.POST("/api/v1/jobs", {
    body: { url, audio_format: audioFormat },
  });

  if (error) {
    if (response.status === 409) {
      // Job conflict - another job is running
      const detail = error.detail as { error: string; active_job_id: string };
      return {
        success: false,
        error: detail.error,
        activeJobId: detail.active_job_id,
      };
    }
    return { success: false, error: "Failed to create job" };
  }

  return { success: true, jobId: data.id };
}

export async function getJob(jobId: string): Promise<Job | null> {
  const { data, error } = await api.GET("/api/v1/jobs/{job_id}", {
    params: { path: { job_id: jobId } },
  });

  if (error) return null;
  return data;
}

export async function listJobs(): Promise<{
  jobs: Job[];
  activeJobId: string | null;
}> {
  const { data, error } = await api.GET("/api/v1/jobs");

  if (error) return { jobs: [], activeJobId: null };
  return {
    jobs: data.jobs,
    activeJobId: data.active_job_id ?? null,
  };
}

export async function deleteJob(jobId: string): Promise<boolean> {
  const { error } = await api.DELETE("/api/v1/jobs/{job_id}", {
    params: { path: { job_id: jobId } },
  });

  return !error;
}

export async function clearJobs(): Promise<number> {
  const { data, error } = await api.DELETE("/api/v1/jobs");

  if (error) return 0;
  return data.cleared;
}
