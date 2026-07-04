import { motion, AnimatePresence } from "framer-motion";
import { Timer } from "lucide-react";

// Host-only dialog to insert a timed break between songs.
const BreakModal = ({
  open,
  onClose,
  pauseDescription,
  setPauseDescription,
  pauseDuration,
  setPauseDuration,
  onAddBreak,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 16 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 16 }}
          className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="p-2 rounded-xl bg-amber-500/20">
              <Timer className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-semibold">Add a break</h3>
              <p className="text-xs text-white/50">
                Pauses the music for a set time
              </p>
            </div>
          </div>

          <label className="block text-xs text-white/60 mb-1">Label</label>
          <input
            type="text"
            value={pauseDescription}
            onChange={(e) => setPauseDescription(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none mb-3"
            placeholder="e.g. Short break, Toast, Speech"
          />

          <label className="block text-xs text-white/60 mb-1">
            Duration (seconds)
          </label>
          <div className="flex gap-2 mb-5">
            {[15, 30, 60, 120].map((d) => (
              <button
                key={d}
                onClick={() => setPauseDuration(d)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                  pauseDuration === d
                    ? "bg-amber-500/20 border border-amber-400/50 text-amber-200"
                    : "bg-white/5 border border-white/10 text-white/60"
                }`}
              >
                {d}s
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onAddBreak}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm"
            >
              Add break
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default BreakModal;
