import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Link2, Timer, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import axios from "axios";
import { trackEvent } from "../../utils/analytics";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://api.tunevote.com"
).replace(/\/+$/, "");

// 7-day trend arrow for a search result (#46).
function TrendBadge({ trend }) {
  if (!trend || trend.dir === "flat") {
    return (
      <span className="flex items-center gap-0.5 text-[11px] text-white/30 shrink-0">
        <Minus className="w-3 h-3" />
      </span>
    );
  }
  const up = trend.dir === "up";
  return (
    <span
      className={`flex items-center gap-0.5 text-[11px] font-semibold shrink-0 ${
        up ? "text-emerald-400" : "text-rose-400"
      }`}
      title="Plays + votes vs. the previous 7 days"
    >
      {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {up ? "+" : ""}
      {trend.pct}%
    </span>
  );
}

// Song search + paste-link input and the live results list. Kept as a single
// component rendered at one stable position so the <input> reconciles as the
// same DOM node across stage transitions (preserving focus/selection).
const SearchPanel = ({
  isLargeSearch,
  searchQuery,
  setSearchQuery,
  canAddSongs,
  inputRef,
  onPasteLink,
  searchResults,
  searched,
  onProposeSong,
  sessionId,
}) => {
  const [trends, setTrends] = useState({});

  // Fetch 7-day momentum for the currently visible results (#46). Best-effort:
  // if it fails, rows simply render without an arrow.
  useEffect(() => {
    const ids = searchResults
      .map((v) => v?.id?.videoId)
      .filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    axios
      .get(`${API_BASE}/trends`, { params: { videoIds: ids.join(",") } })
      .then((res) => !cancelled && setTrends(res.data || {}))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [searchResults]);

  return (
    <div className="space-y-2">
      <div
        className={`relative flex items-center gap-2 ${
          isLargeSearch ? "p-1" : ""
        } rounded-2xl bg-white/5 border-2 border-white/10 focus-within:border-purple-400/60 transition-colors`}
      >
        <Search
          className={`absolute left-4 text-white/40 pointer-events-none ${
            isLargeSearch ? "w-5 h-5" : "w-4 h-4"
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          maxLength={200}
          placeholder={
            isLargeSearch
              ? "Type a song or paste a YouTube link…"
              : "Add another song…"
          }
          className={`w-full bg-transparent text-white placeholder-white/40 focus:outline-none ${
            isLargeSearch ? "pl-12 pr-24 py-4 text-base" : "pl-10 pr-20 py-3 text-sm"
          }`}
          value={searchQuery}
          disabled={!canAddSongs}
          onFocus={() =>
            trackEvent("search_input_focused", { session_id: sessionId })
          }
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            trackEvent("search_query_changed", {
              session_id: sessionId,
              query_length: value.length,
            });
          }}
        />
        <button
          onClick={onPasteLink}
          disabled={!canAddSongs}
          className="absolute right-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium text-white/70 hover:text-white transition-all disabled:opacity-40"
          title="Paste a YouTube link from your clipboard"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Paste link</span>
        </button>
      </div>

      {!canAddSongs && (
        <p className="text-xs text-amber-300/80 flex items-center gap-1.5 px-1">
          <Timer className="w-3.5 h-3.5" />
          Voting in progress — you can add new songs in the next round.
        </p>
      )}

      {/* #51 — song not found: point the user at the paste-link option. */}
      {canAddSongs &&
        searched &&
        searchQuery.trim().length > 0 &&
        searchResults.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-white/60">
            No match for “{searchQuery.trim()}”. Got the video?{" "}
            <button
              onClick={onPasteLink}
              className="font-medium text-purple-300 underline-offset-2 hover:underline"
            >
              Paste its YouTube link
            </button>{" "}
            to add it directly.
          </div>
        )}

      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1.5 max-h-80 overflow-y-auto rounded-xl"
          >
            {searchResults.map((video, idx) => (
              <button
                key={video.id.videoId}
                onClick={() => {
                  trackEvent("search_result_clicked", {
                    session_id: sessionId,
                    position: idx,
                    total_results: searchResults.length,
                    video_id: video.id.videoId,
                  });
                  onProposeSong(video, { source: "search", position: idx });
                }}
                disabled={!canAddSongs}
                className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.99] transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <img
                  src={video.snippet.thumbnails.default.url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
                <p className="flex-1 text-sm truncate">{video.snippet.title}</p>
                <TrendBadge trend={trends[video.id.videoId]} />
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold shrink-0 group-hover:shadow-lg group-hover:shadow-purple-500/30 transition-shadow">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchPanel;
