"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { tokens } from "@/lib/tokens";

const c = tokens.color;
const r = tokens.radius;
const dur = tokens.duration;

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  shortcut?: string;
  section?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

const DEFAULT_RECENT_IDS = [
  "nav-dj",
  "nav-producer",
  "nav-business",
];

export default function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentIds] = useState<string[]>(DEFAULT_RECENT_IDS);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = commands.filter((cmd) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q) ||
      cmd.section?.toLowerCase().includes(q)
    );
  });

  const recentCommands = commands.filter((cmd) =>
    recentIds.includes(cmd.id)
  );

  const recentNotInFiltered = recentCommands.filter(
    (rc) => !filtered.some((f) => f.id === rc.id)
  );

  const grouped = filtered.reduce<Record<string, CommandItem[]>>(
    (acc, cmd) => {
      const section = cmd.section || "Commands";
      if (!acc[section]) acc[section] = [];
      acc[section].push(cmd);
      return acc;
    },
    {}
  );

  const flatList = query
    ? filtered
    : [...recentNotInFiltered, ...filtered.filter(
        (cmd) => !recentIds.includes(cmd.id)
      )];

  const sections = Object.keys(grouped);

  const selectedCommand = flatList[selectedIndex];

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const executeCommand = useCallback(
    (cmd: CommandItem) => {
      cmd.action();
      onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < flatList.length - 1 ? prev + 1 : 0
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : flatList.length - 1
        );
        return;
      }
      if (e.key === "Enter" && selectedCommand) {
        e.preventDefault();
        executeCommand(selectedCommand);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, flatList, selectedIndex, selectedCommand, executeCommand]);

  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur.small / 1000 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          <motion.div
            className={cn(
              "relative z-10 w-full max-w-lg overflow-hidden border border-jarvis-red/15 bg-jarvis-surface/80 backdrop-blur-[20px]",
              "jarvis-shadow-lg"
            )}
            style={{ borderRadius: r.window }}
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: dur.small / 1000, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center gap-3 border-b border-jarvis-red/10 px-4 py-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-jarvis-red/20 bg-jarvis-red/10">
                <span className="text-[10px] text-jarvis-red">⌘</span>
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search commands..."
                className="flex-1 bg-transparent font-mono text-sm text-jarvis-text-primary placeholder-jarvis-text-disabled outline-none"
              />
              <kbd className="rounded-md border border-jarvis-text-disabled/30 bg-jarvis-panel px-1.5 py-0.5 font-mono text-[10px] text-jarvis-text-muted">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
              {!query && recentNotInFiltered.length > 0 && (
                <div className="px-3 pb-1 pt-2">
                  <span className="text-[10px] font-medium tracking-wider text-jarvis-text-muted uppercase">
                    Recent
                  </span>
                </div>
              )}

              {query
                ? sections.map((section) => (
                    <div key={section}>
                      <div className="px-3 pb-1 pt-2">
                        <span className="text-[10px] font-medium tracking-wider text-jarvis-text-muted uppercase">
                          {section}
                        </span>
                      </div>
                      {grouped[section].map((cmd) => {
                        const idx = flatList.indexOf(cmd);
                        return (
                          <CommandRow
                            key={cmd.id}
                            command={cmd}
                            selected={idx === selectedIndex}
                            onSelect={() => executeCommand(cmd)}
                            onHover={() => setSelectedIndex(idx)}
                          />
                        );
                      })}
                    </div>
                  ))
                : flatList.map((cmd) => {
                    const isRecent = recentIds.includes(cmd.id);
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        selected={flatList.indexOf(cmd) === selectedIndex}
                        onSelect={() => executeCommand(cmd)}
                        onHover={() =>
                          setSelectedIndex(flatList.indexOf(cmd))
                        }
                        badge={isRecent ? "RECENT" : undefined}
                      />
                    );
                  })}

              {flatList.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <span className="text-[12px] text-jarvis-text-disabled">
                    No commands found
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-jarvis-red/10 px-4 py-2">
              <div className="flex items-center gap-3 text-[10px] text-jarvis-text-disabled">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-jarvis-text-disabled/30 bg-jarvis-panel px-1 py-px font-mono text-[9px]">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-jarvis-text-disabled/30 bg-jarvis-panel px-1 py-px font-mono text-[9px]">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-jarvis-text-disabled/30 bg-jarvis-panel px-1 py-px font-mono text-[9px]">esc</kbd>
                  close
                </span>
              </div>
              <span className="text-[10px] text-jarvis-red/40">
                JARVIS
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CommandRow({
  command,
  selected,
  onSelect,
  onHover,
  badge,
}: {
  command: CommandItem;
  selected: boolean;
  onSelect: () => void;
  onHover: () => void;
  badge?: string;
}) {
  return (
    <button
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2 text-left transition-colors duration-100",
        selected
          ? "bg-jarvis-red/10 text-jarvis-red"
          : "text-jarvis-text-secondary hover:bg-jarvis-red/5"
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors duration-100",
          selected
            ? "border-jarvis-red/30 bg-jarvis-red/15 text-jarvis-red"
            : "border-jarvis-text-disabled/30 bg-jarvis-panel text-jarvis-text-muted group-hover:border-jarvis-red/20"
        )}
      >
        <span className="text-xs">{command.icon || "◆"}</span>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-[13px] font-medium",
              selected ? "text-jarvis-red" : "text-jarvis-text-primary"
            )}
          >
            {command.label}
          </span>
          {badge && (
            <span className="shrink-0 rounded bg-jarvis-red/10 px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-jarvis-red/60 uppercase">
              {badge}
            </span>
          )}
        </div>
        {command.description && (
          <span className="text-[11px] text-jarvis-text-muted">
            {command.description}
          </span>
        )}
      </div>

      {command.shortcut && (
        <div className="flex shrink-0 items-center gap-1">
          {command.shortcut.split("+").map((key, i) => (
            <kbd
              key={i}
              className="rounded border border-jarvis-text-disabled/30 bg-jarvis-panel px-1.5 py-0.5 font-mono text-[10px] text-jarvis-text-muted"
            >
              {key}
            </kbd>
          ))}
        </div>
      )}
    </button>
  );
}
