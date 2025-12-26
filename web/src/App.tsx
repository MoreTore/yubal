import { useState } from "react";
import { Button } from "@heroui/react";
import { Download } from "lucide-react";
import { UrlInput } from "./components/UrlInput";
import { isValidUrl } from "./utils/url";
import { ConsolePanel } from "./components/ConsolePanel";
import { DownloadsPanel } from "./components/DownloadsPanel";
import { Header } from "./components/Header";
import { Footer } from "./components/Footer";
import { useJobs } from "./hooks/useJobs";
import { deleteJob } from "./api/jobs";

export default function App() {
  const [url, setUrl] = useState("");
  const {
    currentJobId,
    status,
    logs,
    startJob,
    cancelJob,
    clearCurrentJob,
    jobs,
    refreshJobs,
  } = useJobs();

  const canSync = isValidUrl(url);

  const handleSync = async () => {
    if (canSync) {
      await startJob(url);
      setUrl("");
    }
  };

  const handleDelete = async (jobId: string) => {
    await deleteJob(jobId);
    if (jobId === currentJobId) {
      clearCurrentJob();
    }
    await refreshJobs();
  };

  return (
    <div className="bg-background flex min-h-screen flex-col justify-center px-4 py-6">
      <main className="mx-auto w-full max-w-4xl">
        <Header />

        {/* URL Input Section */}
        <section className="mb-6 flex gap-2">
          <div className="flex-1">
            <UrlInput value={url} onChange={setUrl} />
          </div>
          <Button
            color="primary"
            size="md"
            onPress={handleSync}
            isDisabled={!canSync}
            startContent={<Download className="h-4 w-4" />}
          >
            Download
          </Button>
        </section>

        {/* Two Column Grid */}
        <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DownloadsPanel
            jobs={jobs}
            onCancel={cancelJob}
            onDelete={handleDelete}
          />
          <ConsolePanel logs={logs} status={status} />
        </section>

        <Footer />
      </main>
    </div>
  );
}
