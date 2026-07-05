import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Music,
  ThumbsUp,
  Search,
  Plus,
  Timer,
  Radio,
  Sparkles,
} from "lucide-react";
import { usePlayback } from "../context/PlaybackContext";

// ---------------------------------------------------------------------------
// QUEUE OVERLAY
//
// Opened from the persistent banner. A modal (never a route change) over the
// current page showing the ACTIVE playback session's queue: now playing, the
// live voting candidates (vote inline), the decided up-next list, and a song
// search to suggest a new track — all without leaving the page.
// ---------------------------------------------------------------------------

const QueueOverlay = ({ open, onClose }) => {
  const {
    active,
    currentSong,
    queue,
    proposals,
    votingPhase,
    timeRemaining,
    voteProposal,
    proposeSong,
    searchSongs,
  } = usePlayback();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      const r = await searchSongs(query);
      setResults(r);
      setSearching(false);
    }, 450);
    return () => clearTimeout(t);
  }, [query, open, searchSongs]);

  // Reset the search field whenever the overlay is closed.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const suggested = proposals
    .filter((p) => p.status === "suggested")
    .sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const queued = queue.filter((q) => q.status === "queued");

  const handleAdd = async (video) => {
    setAddingId(video.id.videoId);
    const ok = await proposeSong(video);
    setAddingId(null);
    if (ok) {
      setQuery("");
      setResults([]);
    }
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const votingActive = votingPhase && timeRemaining > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.98, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="w-full max-w-lg max-h-[85vh] flex flex-col bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 shrink-0">
                  <Radio className="w-5 h-5 text-purple-300" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white truncate">Queue</h3>
                  <p className="text-xs text-green-400/90 truncate">
                    {active?.sessionName || "Live session"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1">
              {/* Now playing */}
              {currentSong && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-green-400 mb-2">
                    Now playing
                  </p>
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-green-500/10 border border-green-500/30">
                    <div className="relative shrink-0">
                      {currentSong.thumbnail ? (
                        <img
                          src={currentSong.thumbnail}
                          alt=""
                          className="w-11 h-11 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-white/10 flex items-center justify-center">
                          <Music className="w-5 h-5 text-white/50" />
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
                    </div>
                    <p className="flex-1 min-w-0 text-sm font-medium text-white truncate">
                      {currentSong.title}
                    </p>
                  </div>
                </div>
              )}

              {/* Voting now */}
              {suggested.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-purple-300 flex items-center gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5" />
                      {votingActive && votingPhase.phase === "voting"
                        ? "Vote for next"
                        : "Up for voting"}
                    </p>
                    {votingActive && (
                      <span className="text-xs font-mono font-bold tabular-nums text-white/60">
                        {formatTime(timeRemaining)}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {suggested.map((song) => (
                      <div
                        key={song.id}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/10"
                      >
                        {song.itemType === "music" ? (
                          <img
                            src={song.thumbnail}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                            <Timer className="w-4 h-4 text-yellow-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className="text-sm truncate">{song.title}</p>
                            {song.itemSource === "ai" && (
                              <span
                                title="AI suggestion"
                                className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-semibold ring-1 ring-purple-400/30"
                              >
                                <Sparkles className="w-3 h-3" />
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/40">
                            {song.votes || 0}{" "}
                            {song.votes === 1 ? "vote" : "votes"}
                          </p>
                        </div>
                        <button
                          onClick={() => voteProposal(song.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                            song.userHasVoted
                              ? "bg-green-500 text-white"
                              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {song.userHasVoted ? "Voted" : "Vote"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Up next (decided queue) */}
              {queued.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-white/50 mb-2">
                    Up next ({queued.length})
                  </p>
                  <div className="space-y-1.5">
                    {queued.map((item, i) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                      >
                        <span className="w-5 text-center text-xs text-white/30 font-mono shrink-0">
                          {i + 1}
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
                        <p className="flex-1 min-w-0 text-sm truncate">
                          {item.item_type === "pause"
                            ? `${item.description || "Break"} · ${item.duration}s`
                            : item.title}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {suggested.length === 0 && queued.length === 0 && (
                <p className="text-sm text-white/40 text-center py-4">
                  Nothing queued yet — suggest the first song below.
                </p>
              )}
            </div>

            {/* Suggest a song — sticky footer */}
            <div className="border-t border-white/10 p-4 shrink-0 bg-slate-900">
              <div className="relative flex items-center rounded-xl bg-white/5 border border-white/10 focus-within:border-purple-400/60 transition-colors">
                <Search className="absolute left-3 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Suggest a song…"
                  className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none"
                />
              </div>
              {(searching || results.length > 0) && (
                <div className="mt-2 space-y-1.5 max-h-56 overflow-y-auto">
                  {searching && (
                    <p className="text-xs text-white/40 px-1 py-2">Searching…</p>
                  )}
                  {results.map((video) => (
                    <button
                      key={video.id.videoId}
                      onClick={() => handleAdd(video)}
                      disabled={addingId === video.id.videoId}
                      className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.99] transition-all text-left disabled:opacity-50"
                    >
                      <img
                        src={video.snippet.thumbnails.default.url}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0"
                      />
                      <p className="flex-1 min-w-0 text-sm truncate">
                        {video.snippet.title}
                      </p>
                      <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold shrink-0">
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default QueueOverlay;
