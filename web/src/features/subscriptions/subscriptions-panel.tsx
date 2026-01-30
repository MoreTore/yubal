import type { Subscription } from "@/api/subscriptions";
import { EmptyState } from "@/components/common/empty-state";
import { Panel, PanelContent, PanelHeader } from "@/components/common/panel";
import { Button, Tooltip } from "@heroui/react";
import { Inbox, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { SubscriptionCard } from "./subscription-card";

interface SubscriptionsPanelProps {
  subscriptions: Subscription[];
  onToggleEnabled: (id: string, enabled: boolean) => void;
  onSync: (id: string) => void;
  onSyncAll: () => void;
  onDelete: (id: string) => void;
}

export function SubscriptionsPanel({
  subscriptions,
  onToggleEnabled,
  onSync,
  onSyncAll,
  onDelete,
}: SubscriptionsPanelProps) {
  const enabledCount = subscriptions.filter((s) => s.enabled).length;

  return (
    <Panel>
      <PanelHeader
        leadingIcon={<RefreshCw size={18} />}
        badge={
          subscriptions.length > 0 && (
            <span className="text-foreground-400 font-mono text-xs">
              ({enabledCount}/{subscriptions.length})
            </span>
          )
        }
        trailingIcon={
          subscriptions.length > 0 && (
            <Tooltip content="Sync all enabled subscriptions">
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

      <PanelContent height="h-[580px]" className="space-y-2">
        {subscriptions.length === 0 ? (
          <EmptyState icon={Inbox} title="No playlists registered" />
        ) : (
          <AnimatePresence initial={false}>
            {subscriptions.map((subscription) => (
              <motion.div
                key={subscription.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
              >
                <SubscriptionCard
                  subscription={subscription}
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
