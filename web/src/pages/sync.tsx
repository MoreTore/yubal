import { BlurFade } from "../components/magicui/blur-fade";
import { SyncPanel } from "../components/sync/sync-panel";
import { useSync } from "../hooks/use-sync";

export function SyncPage() {
  const {
    playlists,
    addPlaylist,
    updatePlaylist,
    deletePlaylist,
    syncPlaylist,
    syncAll,
  } = useSync();

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await updatePlaylist(id, { enabled });
  };

  return (
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
  );
}
