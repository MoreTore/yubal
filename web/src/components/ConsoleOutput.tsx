import { useEffect, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LogEntry, ProgressStep } from "../hooks/useSync";
import { Card } from "@heroui/react";

interface ConsoleOutputProps {
  logs: LogEntry[];
  status: ProgressStep;
}

const stepColors: Record<ProgressStep, string> = {
  idle: "text-gray-500",
  starting: "text-blue-400",
  downloading: "text-cyan-400",
  tagging: "text-purple-400",
  complete: "text-green-400",
  error: "text-red-400",
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getTimestamp(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export function ConsoleOutput({ logs, status }: ConsoleOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isActive =
    status !== "idle" && status !== "complete" && status !== "error";
  const [currentTime, setCurrentTime] = useState(getTimestamp());

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  // Update blinking cursor timestamp
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        setCurrentTime(getTimestamp());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isActive]);

  return (
    <Card className="border-default-200 bg-background border-2 shadow-none">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b-2 border-default-200 bg-content1">
        <Terminal className="text-foreground-500 h-3.5 w-3.5" />
        <span className="text-foreground-500 font-mono text-xs">console</span>
      </div>
      {/* Console Content */}
      <div
        ref={containerRef}
        className="h-48 space-y-1 overflow-y-auto p-3 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <div className="text-foreground-600 flex h-full items-center justify-center">
            <span>Awaiting YouTube URL...</span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2"
              >
                <span className="shrink-0 text-gray-600/50">
                  {formatTime(log.timestamp)}
                </span>
                <span className={stepColors[log.step]}>{log.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
        {/* Blinking cursor when active */}
        {isActive && (
          <div className="flex gap-2">
            <span className="text-gray-600/50">{currentTime}</span>
            <span className="animate-pulse text-gray-500">&#9608;</span>
          </div>
        )}
      </div>
    </Card>
  );
}
