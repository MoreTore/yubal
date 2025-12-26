import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import { Download, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Job } from "../api/jobs";
import { JobCard } from "./JobCard";

interface DownloadsPanelProps {
  jobs: Job[];
  currentJobId: string | null;
  onCancel: (jobId: string) => void;
  onResume: (jobId: string) => void;
  onDelete: (jobId: string) => void;
  onClear: () => void;
}

export function DownloadsPanel({
  jobs,
  currentJobId,
  onCancel,
  onResume,
  onDelete,
  onClear,
}: DownloadsPanelProps) {
  // Split jobs into active (queue) and completed (history)
  const activeJobs = jobs.filter((job) =>
    ["pending", "fetching_info", "downloading", "importing"].includes(
      job.status
    )
  );
  const completedJobs = jobs.filter((job) =>
    ["completed", "failed", "cancelled"].includes(job.status)
  );

  const hasCompletedJobs = completedJobs.length > 0;

  return (
    <Card className="border-default-200 flex flex-col overflow-hidden border">
      <CardHeader className="border-default-200 shrink-0 border-b px-4 py-3">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="text-default-500 h-4 w-4" />
            <span className="text-default-500 font-mono text-xs tracking-wider uppercase">
              Downloads
            </span>
            {jobs.length > 0 && (
              <span className="text-default-400 font-mono text-xs">
                {jobs.length}
              </span>
            )}
          </div>
          {hasCompletedJobs && (
            <Button
              variant="light"
              size="sm"
              className="text-default-500 hover:text-danger h-6 gap-1 px-2 text-xs"
              onPress={onClear}
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardBody className="h-72 space-y-2 overflow-y-auto p-3">
        {jobs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-default-400/50 font-mono text-xs">
              No downloads yet
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {activeJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <JobCard
                  job={job}
                  isActive={job.id === currentJobId}
                  onCancel={onCancel}
                  onResume={onResume}
                />
              </motion.div>
            ))}
            {completedJobs.map((job) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <JobCard
                  job={job}
                  isActive={job.id === currentJobId}
                  onResume={onResume}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </CardBody>
    </Card>
  );
}
