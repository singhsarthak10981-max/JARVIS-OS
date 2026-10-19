"use client";

import { getModule, type ModuleId } from "@/lib/modules";
import { useAppStore } from "@/lib/store";
import ModuleShell from "./ModuleShell";
import GlassCard from "@/components/glass-card";
import StatusDot from "@/components/ui/status-dot";

/**
 * Honest shell for a pillar that is not built yet.
 *
 * The previous placeholder rendered "Module mounted successfully" and
 * "STATUS: ONLINE", which described the component tree rather than a feature
 * and read like a working integration. This version states plainly that the
 * workspace is a shell, lists only what is planned, and offers one real
 * action (ask JARVIS about it).
 */
export default function ModulePreview({ moduleId }: { moduleId: ModuleId }) {
  const openAssistant = useAppStore((s) => s.openAssistant);
  const definition = getModule(moduleId);
  if (!definition) return null;

  return (
    <ModuleShell moduleId={definition.id} title={definition.label} hideHeader flush>
      <div className="mx-auto flex h-full max-w-2xl flex-col justify-center gap-4 overflow-y-auto p-5 sm:p-8 jarvis-scroll">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-jarvis-red/25 bg-jarvis-red/10 text-[16px] text-jarvis-red">
            {definition.icon}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[15px] font-medium text-jarvis-text-primary">{definition.label}</h2>
              <span className="rounded border border-jarvis-warning/30 bg-jarvis-warning/10 px-1.5 py-0.5 text-[9px] tracking-[0.14em] text-jarvis-warning uppercase">
                Not yet built
              </span>
            </div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-jarvis-text-muted">
              {definition.description}
            </p>
          </div>
        </div>

        <GlassCard hover={false} className="p-4 sm:p-5">
          <div className="text-[9.5px] tracking-[0.2em] text-jarvis-text-disabled uppercase">
            Planned for this workspace
          </div>
          {definition.planned && definition.planned.length > 0 ? (
            <ul className="mt-2.5 space-y-2">
              {definition.planned.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[12px] text-jarvis-text-secondary"
                >
                  <StatusDot tone="idle" size={4} className="mt-[7px]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-jarvis-text-secondary">
              No capabilities have been defined for this workspace yet.
            </p>
          )}

          <p className="mt-4 border-t border-white/[0.06] pt-3 text-[10.5px] leading-relaxed text-jarvis-text-disabled">
            This is a shell. It shows no data and claims no integration until the module
            is built.
          </p>
        </GlassCard>

        <div>
          <button
            type="button"
            onClick={() => openAssistant(`What is planned for the ${definition.label} workspace?`)}
            className="rounded-[10px] border border-jarvis-red/25 bg-jarvis-red/[0.06] px-3 py-2 text-[10px] font-medium tracking-[0.14em] text-jarvis-red uppercase transition-colors hover:bg-jarvis-red/10"
          >
            Ask JARVIS about this workspace
          </button>
        </div>
      </div>
    </ModuleShell>
  );
}
