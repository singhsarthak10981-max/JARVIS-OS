"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { getModule } from "@/lib/modules";
import { tokens } from "@/lib/tokens";
import Sidebar from "./sidebar";
import TopHUD from "./top-hud";
import CommandCenterDashboard from "./command-center-dashboard";
import ModulePlaceholder from "./modules/module-placeholder";

const dur = tokens.duration;

export default function CommandCenter() {
  const active = useAppStore((s) => s.activeModule);
  const navigate = useAppStore((s) => s.navigate);
  const currentModule = getModule(active);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-jarvis-bg-secondary">
      <Sidebar activeModule={active} onModuleChange={navigate} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopHUD activeModule={active} />

        <main className="relative flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {active === "command-center" ? (
              <motion.div
                key="command-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.small / 1000 }}
              >
                <CommandCenterDashboard />
              </motion.div>
            ) : currentModule ? (
              <motion.div
                key={currentModule.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: dur.small / 1000 }}
              >
                <ModulePlaceholder module={currentModule} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
