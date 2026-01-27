import { Button, Input, Tooltip } from "@heroui/react";
import { Inbox, Link, Plus, RefreshCw, Type } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { SyncedPlaylist } from "../../api/subscriptions";
import { isValidUrl } from "../../lib/url";
import { EmptyState } from "../common/empty-state";
import { Panel, PanelContent, PanelHeader } from "../common/panel";
import { SyncedPlaylistCard } from "./synced-playlist-card";

interface SyncPanelProps {
  playlists: SyncedPlaylist[];
  onAddPlaylist: (url: string, name: string) => Promise<boolean>;
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onSync: (id: string) => void;
  onSyncAll: () => void;
  onDelete: (id: string) => void;
}

export function SyncPanel({
  playlists,
  onAddPlaylist,
  onToggleEnabled,
  onSync,
  onSyncAll,
  onDelete,
}: SyncPanelProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const canAdd = isValidUrl(url) && name.trim().length > 0;
  const enabledCount = playlists.filter((p) => p.enabled).length;

  const handleAdd = async () => {
    if (!canAdd) return;
    setIsAdding(true);
    const success = await onAddPlaylist(url.trim(), name.trim());
    if (success) {
      setUrl("");
      setName("");
    }
    setIsAdding(false);
  };

  return (
    <Panel>
      <PanelHeader
        leadingIcon={<RefreshCw size={18} />}
        badge={
          playlists.length > 0 && (
            <span className="text-foreground-400 font-mono text-xs">
              ({enabledCount}/{playlists.length})
            </span>
          )
        }
        trailingIcon={
          playlists.length > 0 && (
            <Tooltip content="Sync all enabled playlists">
              <Button
                variant="light"
                size="sm"
                className="text-foreground-500 hover:text-primary"
                onPress={onSyncAll}
                startContent={<RefreshCw className="h-3.5 w-3.5" />}
              >
                Sync All
              </Button>
            </Tooltip>
          )
        }
      >
        Synced Playlists
      </PanelHeader>

      {/* Add playlist form */}
      <div className="border-divider flex gap-2 border-b px-3 pb-3">
        <Input
          placeholder="Playlist URL"
          value={url}
          onValueChange={setUrl}
          variant="faded"
          radius="lg"
          size="sm"
          startContent={<Link className="text-foreground-400 h-4 w-4" />}
          className="flex-1"
          classNames={{ input: "font-mono text-xs" }}
        />
        <Input
          placeholder="Name"
          value={name}
          onValueChange={setName}
          variant="faded"
          radius="lg"
          size="sm"
          startContent={<Type className="text-foreground-400 h-4 w-4" />}
          className="w-40"
          classNames={{ input: "font-mono text-xs" }}
        />
        <Button
          color="primary"
          radius="lg"
          size="sm"
          isIconOnly
          isDisabled={!canAdd}
          isLoading={isAdding}
          onPress={handleAdd}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <PanelContent height="h-[340px]" className="space-y-2">
        {playlists.length === 0 ? (
          <EmptyState icon={Inbox} title="No playlists registered" />
        ) : (
          <AnimatePresence initial={false}>
            {playlists.map((playlist) => (
              <motion.div
                key={playlist.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SyncedPlaylistCard
                  playlist={playlist}
                  onToggleEnabled={onToggleEnabled}
                  onSync={onSync}
                  onDelete={onDelete}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </PanelContent>
    </Panel>
  );
}
