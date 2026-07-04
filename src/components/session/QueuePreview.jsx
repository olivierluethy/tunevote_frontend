import { motion } from "framer-motion";
import { ListMusic, ChevronUp, ChevronDown, Timer } from "lucide-react";

// Compact "up next" list: next 3 items by default, expandable to the full
// queue, plus the host's add-a-break button.
const QueuePreview = ({
  queuedSongs,
  showAll,
  setShowAll,
  currentSong,
  isLiveJoined,
  showBreakButton,
  canAddSongs,
  onAddBreak,
}) => (
  <section className="px-4 pt-2 pb-3">
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
        <ListMusic className="w-4 h-4 text-purple-400" />
        Up next{" "}
        <span className="text-white/40 font-normal">({queuedSongs.length})</span>
      </h2>
      {queuedSongs.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"
        >
          {showAll ? "Show less" : `Show all ${queuedSongs.length}`}
          {showAll ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>
      )}
    </div>

    <div className="space-y-1.5">
      {(showAll ? queuedSongs : queuedSongs.slice(0, 3)).map((item, index) => {
        const isCurrent =
          currentSong?.queueItemId === item.id && isLiveJoined;
        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03 }}
            className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
              isCurrent
                ? "bg-green-500/15 border border-green-500/30"
                : item.item_type === "pause"
                  ? "bg-yellow-500/10 border border-yellow-500/20"
                  : "bg-white/5 border border-white/5"
            }`}
          >
            <span className="w-6 text-center text-xs text-white/30 font-mono shrink-0">
              {index + 1}
            </span>
            {item.item_type === "music" ? (
              <img
                src={item.thumbnail}
                alt=""
                className="w-9 h-9 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                <Timer className="w-4 h-4 text-yellow-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">
                {item.item_type === "pause"
                  ? `${item.description || "Pause"} · ${item.duration}s`
                  : item.title}
              </p>
              <p className="text-xs text-white/40 truncate">
                {item.addedBy || "Guest"}
              </p>
            </div>
            {isCurrent && (
              <span className="text-[10px] uppercase tracking-wider font-bold text-green-400 shrink-0">
                Playing
              </span>
            )}
          </motion.div>
        );
      })}
    </div>

    {showBreakButton && (
      <button
        onClick={onAddBreak}
        disabled={!canAddSongs}
        className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-white/15 hover:border-amber-400/40 hover:bg-amber-500/5 text-xs text-white/50 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Timer className="w-3.5 h-3.5" />
        Add a break between songs
      </button>
    )}
  </section>
);

export default QueuePreview;
