import { AnsiUp } from "ansi_up";
import { ChevronDown, Terminal } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import { useLocalStorage } from "../hooks/use-local-storage";
import { useLogs } from "../hooks/use-logs";
import { Panel, PanelContent, PanelHeader } from "./common/panel";

export function ConsolePanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lines, isConnected } = useLogs();
  const [isExpanded, setIsExpanded] = useLocalStorage(
    "yubal-console-expanded",
    false,
  );

  // Convert ANSI to HTML with CSS classes (not inline styles)
  const ansiConverter = useMemo(() => {
    const converter = new AnsiUp();
    converter.use_classes = true;
    return converter;
  }, []);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  const panelHeader = (
    <PanelHeader
      className="hover:bg-content2 cursor-pointer select-none"
      onClick={() => setIsExpanded(!isExpanded)}
      leadingIcon={<Terminal size={18} />}
      badge={
        !isConnected && (
          <span className="text-warning text-xs">disconnected</span>
        )
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
  );

  const panelContent = (
    <PanelContent
      ref={containerRef}
      className="console-logs space-y-0.5 p-4 font-mono text-xs"
    >
      {lines.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <span className="text-foreground-400">Awaiting YouTube URL...</span>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          {lines.map((line, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="whitespace-pre-wrap"
              dangerouslySetInnerHTML={{
                __html: ansiConverter.ansi_to_html(line),
              }}
            />
          ))}
        </AnimatePresence>
      )}
    </PanelContent>
  );

  return (
    <Panel>
      {panelHeader}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}
