import { Button, NumberInput, Tab, Tabs, Tooltip } from "@heroui/react";
import { Download, Hash, RefreshCw } from "lucide-react";
import { useState } from "react";
import { ConsolePanel } from "./components/console-panel";
import { DownloadsPanel } from "./components/downloads-panel";
import { Footer } from "./components/layout/footer";
import { Header } from "./components/layout/header";
import { BlurFade } from "./components/magicui/blur-fade";
import { SyncPanel } from "./components/sync/sync-panel";
import { UrlInput } from "./components/url-input";
import { useJobs } from "./hooks/use-jobs";
import { useSync } from "./hooks/use-sync";
import { isValidUrl } from "./lib/url";

const DEFAULT_MAX_ITEMS = 50;

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("downloads");
  const [url, setUrl] = useState("");
  const [maxItems, setMaxItems] = useState(DEFAULT_MAX_ITEMS);
  const { jobs, startJob, cancelJob, deleteJob } = useJobs();
  const {
    playlists,
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
    syncAll,
  } = useSync();

  const canDownload = isValidUrl(url);

  const handleDownload = async () => {
    if (canDownload) {
      await startJob(url, maxItems);
      setUrl("");
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    await deleteJob(jobId);
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await updatePlaylist(id, { enabled });
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* Tab Navigation */}
        <BlurFade delay={0.05} direction="up">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as string)}
            variant="underlined"
            classNames={{
              tabList: "gap-4 mb-4",
              tab: "px-0 h-10",
              cursor: "bg-primary",
            }}
          >
            <Tab
              key="downloads"
              title={
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  <span>Downloads</span>
                </div>
              }
            />
            <Tab
              key="sync"
              title={
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  <span>Sync</span>
                </div>
              }
            />
          </Tabs>
        </BlurFade>

        {activeTab === "downloads" && (
          <>
            {/* URL Input Section */}
            <BlurFade delay={0.05} direction="up">
              <section className="mb-6 flex gap-2">
                <div className="flex-1">
                  <UrlInput value={url} onChange={setUrl} />
                </div>
                <Tooltip content="Max number of tracks to download" offset={14}>
                  <NumberInput
                    hideStepper
                    variant="faded"
                    value={maxItems}
                    onValueChange={setMaxItems}
                    minValue={1}
                    maxValue={10000}
                    radius="lg"
                    fullWidth={false}
                    startContent={
                      <Hash className="text-foreground-400 h-4 w-4" />
                    }
                    className="w-24 font-mono"
                  />
                </Tooltip>
                <Button
                  color="primary"
                  radius="lg"
                  variant={canDownload ? "shadow" : "solid"}
                  className="shadow-primary-100/50"
                  onPress={handleDownload}
                  isDisabled={!canDownload}
                  startContent={<Download className="h-4 w-4" />}
                >
                  Download
                </Button>
              </section>
            </BlurFade>

            {/* Downloads Panels */}
            <BlurFade delay={0.1} direction="up">
              <section className="mb-6 flex flex-col gap-4">
                <DownloadsPanel
                  jobs={jobs}
                  onCancel={cancelJob}
                  onDelete={handleDeleteJob}
                />
                <ConsolePanel jobs={jobs} />
              </section>
            </BlurFade>
          </>
        )}

        {activeTab === "sync" && (
          <BlurFade delay={0.05} direction="up">
            <section className="mb-6">
              <SyncPanel
                playlists={playlists}
                onAddPlaylist={addPlaylist}
                onToggleEnabled={handleToggleEnabled}
                onSync={syncPlaylist}
                onSyncAll={syncAll}
                onDelete={deletePlaylist}
              />
            </section>
          </BlurFade>
        )}
      </main>

      <BlurFade delay={0.15} direction="up">
        <Footer />
      </BlurFade>
    </div>
  );
}
