import { UrlInput } from "@/components/common/url-input";
import { SubscriptionsPanel } from "@/features/subscriptions/subscriptions-panel";
import { useSubscriptions } from "@/features/subscriptions/use-subscriptions";
import { isValidUrl } from "@/lib/url";
import { Button, NumberInput, Tooltip } from "@heroui/react";
import { Hash, Plus } from "lucide-react";
import { useState } from "react";

const DEFAULT_MAX_ITEMS = 100;

export function SubscriptionsPage() {
  const [url, setUrl] = useState("");
  const [maxItems, setMaxItems] = useState(DEFAULT_MAX_ITEMS);
  const [isAdding, setIsAdding] = useState(false);
  const {
    subscriptions,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    syncSubscription,
    syncAll,
  } = useSubscriptions();

  const canAdd = isValidUrl(url);

  const handleAdd = async () => {
    if (!canAdd) return;
    setIsAdding(true);
    const success = await addSubscription(url.trim(), maxItems);
    if (success) {
      setUrl("");
    }
    setIsAdding(false);
  };

  const handleToggleEnabled = async (id: string, enabled: boolean) => {
    await updateSubscription(id, { enabled });
  };

  return (
    <>
      {/* Page Title */}
      <h1 className="text-foreground mb-5 text-2xl font-bold">My Playlists</h1>

      {/* URL Input Section */}
      <section className="mb-6 flex gap-2">
        <div className="flex-1">
          <UrlInput
            value={url}
            onChange={setUrl}
            disabled={isAdding}
            placeholder="Playlist URL to sync automatically"
          />
        </div>
        <Tooltip content="Max tracks to sync per run" offset={14}>
          <NumberInput
            hideStepper
            variant="faded"
            value={maxItems}
            onValueChange={setMaxItems}
            minValue={1}
            maxValue={10000}
            radius="lg"
            fullWidth={false}
            formatOptions={{
              useGrouping: false,
            }}
            placeholder="Max"
            startContent={<Hash className="text-foreground-400 h-4 w-4" />}
            className="w-20 font-mono"
          />
        </Tooltip>
        <Button
          color="primary"
          radius="lg"
          variant={canAdd ? "shadow" : "solid"}
          className="shadow-primary-100/50"
          onPress={handleAdd}
          isDisabled={!canAdd}
          isLoading={isAdding}
          startContent={!isAdding && <Plus className="h-4 w-4" />}
        >
          Subscribe
        </Button>
      </section>

      <section className="mb-6">
        <SubscriptionsPanel
          subscriptions={subscriptions}
          onToggleEnabled={handleToggleEnabled}
          onSync={syncSubscription}
          onSyncAll={syncAll}
          onDelete={deleteSubscription}
        />
      </section>
    </>
  );
}
