import { motion, AnimatePresence } from "framer-motion";
import { Search, Link2, Timer, Plus } from "lucide-react";
import { trackEvent } from "../../utils/analytics";

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
  onProposeSong,
  sessionId,
}) => (
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
        // A song title / YouTube URL is short; cap typed & pasted input so an
        // over-long paste can never reach the fuzzy-match. Keep in sync with
        // MAX_SEARCH_LEN in SessionPage.jsx (the JS guard that also covers the
        // clipboard "Paste link" button, which bypasses this attribute).
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

export default SearchPanel;
