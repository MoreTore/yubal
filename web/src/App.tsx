import { Badge, Button, NumberInput, Tooltip } from "@heroui/react";
import { Disc3, Download, Hash, ListMusic } from "lucide-react";
import { useState } from "react";
import { match } from "ts-pattern";
import { ConsolePanel } from "./components/console-panel";
import { DownloadsPanel } from "./components/downloads-panel";
import { Footer } from "./components/layout/footer";
import { Header } from "./components/layout/header";
import { BlurFade } from "./components/magicui/blur-fade";
import { UrlInput } from "./components/url-input";
import { useJobs } from "./hooks/use-jobs";
import { getUrlType, isValidUrl, UrlType } from "./lib/url";

const DEFAULT_MAX_ITEMS = 50;

export default function App() {
  const [url, setUrl] = useState("");
  const [maxItems, setMaxItems] = useState(DEFAULT_MAX_ITEMS);
  const { jobs, logs, startJob, cancelJob, deleteJob } = useJobs();

  const canSync = isValidUrl(url);
  const urlType = canSync ? getUrlType(url) : null;
  const isPlaylist = urlType === UrlType.PLAYLIST;

  const handleSync = async () => {
    if (canSync) {
      await startJob(url, isPlaylist ? maxItems : undefined);
      setUrl("");
    }
  };

  const handleDelete = async (jobId: string) => {
    await deleteJob(jobId);
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {/* URL Input Section */}
        <BlurFade delay={0.05} direction="up">
          <section className="mb-6 flex gap-2">
            <div className="flex-1">
              <UrlInput value={url} onChange={setUrl} />
            </div>
            {isPlaylist && (
              <Tooltip content="Max number of tracks to download" offset={14}>
                <NumberInput
                  hideStepper
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
            )}
            <Badge
              color="secondary"
              content="new"
              size="sm"
              isInvisible={urlType != UrlType.PLAYLIST}
            >
              <Button
                color="primary"
                radius="lg"
                variant={canSync ? "shadow" : "solid"}
                onPress={handleSync}
                isDisabled={!canSync}
                startContent={match(urlType)
                  .with(UrlType.ALBUM, () => <Disc3 className="h-4 w-4" />)
                  .with(UrlType.PLAYLIST, () => (
                    <ListMusic className="h-4 w-4" />
                  ))
                  .otherwise(() => (
                    <Download className="h-4 w-4" />
                  ))}
              >
                {match(urlType)
                  .with(UrlType.ALBUM, () => "Download album")
                  .with(UrlType.PLAYLIST, () => "Download playlist")
                  .otherwise(() => "Download")}
              </Button>
            </Badge>
          </section>
        </BlurFade>

        {/* Stacked Panels */}
        <BlurFade delay={0.1} direction="up">
          <section className="mb-6 flex flex-col gap-4">
            <DownloadsPanel
              jobs={jobs}
              onCancel={cancelJob}
              onDelete={handleDelete}
            />
            <ConsolePanel logs={logs} jobs={jobs} />
          </section>
        </BlurFade>
      </main>

      <BlurFade delay={0.15} direction="up">
        <Footer />
      </BlurFade>
    </div>
  );
}
