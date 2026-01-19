import { Chip, Spinner } from "@heroui/react";
import { ChevronDown, CloudOff, Terminal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { Job } from "../api/jobs";
import type { components } from "../api/schema";
import { useLocalStorage } from "../hooks/use-local-storage";
import { useLogs } from "../hooks/use-logs";
import { isActive } from "../lib/job-status";
import { EmptyState } from "./common/empty-state";
import { Panel, PanelContent, PanelHeader } from "./common/panel";
import { LogLine } from "./console/log-renderers";

type LogEntry = components["schemas"]["LogEntry"];

type ParsedLine =
  | { type: "json"; entry: LogEntry }
  | { type: "text"; text: string };

function parseLine(line: string): ParsedLine {
  try {
    return { type: "json", entry: JSON.parse(line) };
  } catch {
    return { type: "text", text: line };
  }
}

interface ConsolePanelProps {
  jobs?: Job[];
}

export function ConsolePanel({ jobs = [] }: ConsolePanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lines, isConnected } = useLogs();
  const [isExpanded, setIsExpanded] = useLocalStorage(
    "yubal-console-expanded",
    false,
  );

  const hasActiveJobs = jobs.some((job) => isActive(job.status));

  // Memoize parsed lines to avoid re-parsing on every render
  const parsedLines = useMemo(() => lines.map(parseLine), [lines]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <Panel>
      <PanelHeader
        className="hover:bg-content2 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
        leadingIcon={<Terminal size={18} />}
        badge={
          !isConnected ? (
            <Chip
              size="sm"
              radius="full"
              color="warning"
              variant="flat"
              startContent={<CloudOff size={16} className="mr-1 ml-1" />}
            >
              offline
            </Chip>
          ) : hasActiveJobs ? (
            <span className="flex items-center">
              <Spinner
                size="sm"
                variant="wave"
                color="primary"
                className="align-middle"
                classNames={{
                  wrapper: "h-full",
                }}
              />
            </span>
          ) : null
        }
        trailingIcon={
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center"
          >
            <ChevronDown size={18} />
          </motion.div>
        }
      >
        console
      </PanelHeader>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <PanelContent
              ref={containerRef}
              className="console-logs space-y-0.5 p-4 font-mono text-xs"
            >
              {parsedLines.length === 0 ? (
                <EmptyState icon={Terminal} title="No activity yet" mono />
              ) : (
                <AnimatePresence initial={false}>
                  {parsedLines.map((parsed, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {parsed.type === "json" ? (
                        <LogLine entry={parsed.entry} />
                      ) : (
                        <div className="text-foreground-400">{parsed.text}</div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </PanelContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
