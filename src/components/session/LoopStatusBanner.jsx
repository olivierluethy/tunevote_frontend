import { motion, AnimatePresence } from "framer-motion";

const RUN_OPTIONS = [3, 5, 10, null]; // null = endless

// Live status for active loops (#66/#68): "🔁 Loop aktiv · Durchlauf 3/10" with
// one-tap Beenden and a run-count setter. Every action starts a democratic
// change request (onEnd / onSetRuns), shown as a vote by ChangeRequestBanner.
const LoopStatusBanner = ({ loops = [], onEnd, onSetRuns, onPoll, disabled }) => {
  if (!loops.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {loops.map((loop) => {
          const total = loop.total_runs; // null = endless
          const runLabel =
            total == null
              ? `Durchlauf ${loop.current_run} · ∞`
              : `Durchlauf ${loop.current_run}/${total}`;
          return (
            <motion.div
              key={loop.id}
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-500/15 to-blue-500/10 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-indigo-200/70">
                    🔁 Loop aktiv · {runLabel}
                  </p>
                  <p className="truncate text-sm font-semibold text-white">
                    {loop.songs?.join(" → ") || "Loop"}
                  </p>
                </div>
                <button
                  onClick={() => onEnd(loop.id)}
                  disabled={disabled}
                  className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                >
                  ⏹ Beenden
                </button>
              </div>

              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-xs text-white/50">Durchläufe:</span>
                {RUN_OPTIONS.map((n) => (
                  <button
                    key={n ?? "endless"}
                    onClick={() => onSetRuns(loop.id, n)}
                    disabled={disabled}
                    className="rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-xs font-semibold text-indigo-200 transition-colors hover:bg-indigo-500/30 disabled:opacity-40"
                  >
                    {n == null ? "∞" : `×${n}`}
                  </button>
                ))}
                {onPoll && (
                  <button
                    onClick={() => onPoll(loop)}
                    disabled={disabled}
                    className="ml-auto rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                  >
                    🗳 Abstimmen
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export default LoopStatusBanner;
