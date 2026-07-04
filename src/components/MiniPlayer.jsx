import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Music,
  ListMusic,
  ThumbsUp,
} from "lucide-react";
import { usePlayback } from "../context/PlaybackContext";
import QueueOverlay from "./QueueOverlay";

// ---------------------------------------------------------------------------
// PERSISTENT MINI-PLAYER — radio-style "now playing" banner
//
// Rendered once at the app root (inside PlaybackProvider). Visible whenever a
// session is active AND the user is NOT already on that session's detail
// screen. Shows the current song of the ACTIVE playback session (not the page
// being viewed), the next-up candidate with an inline vote, and opens the full
// queue as an overlay — all without leaving the current page.
// ---------------------------------------------------------------------------

const MiniPlayer = () => {
  const {
    active,
    currentSong,
    isPlaying,
    isMutedForMe,
    isPaused,
    volume,
    queue,
    proposals,
    votingPhase,
    timeRemaining,
    togglePlayPause,
    toggleMute,
    setVolume,
    voteProposal,
    leaveLive,
  } = usePlayback();

  const location = useLocation();
  const navigate = useNavigate();
  const [queueOpen, setQueueOpen] = useState(false);

  const onThisSessionScreen =
    active && location.pathname === `/session/${active.sessionId}`;
  const show = !!active && !onThisSessionScreen;

  const openSession = () => {
    if (active) navigate(`/session/${active.sessionId}`);
  };

  // "Up Next": prefer the leading vote candidate (votable), else the next
  // decided queue item (info only).
  const topSuggestion = proposals
    .filter((p) => p.status === "suggested" && p.itemType === "music")
    .sort((a, b) => (b.votes || 0) - (a.votes || 0))[0];
  const nextQueued = queue.find((q) => q.status === "queued");
  const upNext = topSuggestion
    ? {
        id: topSuggestion.id,
        title: topSuggestion.title,
        thumbnail: topSuggestion.thumbnail,
        votes: topSuggestion.votes || 0,
        userHasVoted: topSuggestion.userHasVoted,
        votable: true,
      }
    : nextQueued
      ? {
          id: nextQueued.id,
          title:
            nextQueued.item_type === "pause"
              ? `${nextQueued.description || "Break"} · ${nextQueued.duration}s`
              : nextQueued.title,
          thumbnail: nextQueued.thumbnail,
          votable: false,
        }
      : null;

  const votingActive = votingPhase && timeRemaining > 0;

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-3 inset-x-3 z-50 max-w-3xl mx-auto"
          >
            <div className="rounded-2xl border border-green-500/30 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
              <div className="flex items-center gap-3 p-2.5">
                {/* Current song — tap to return to the full session */}
                <button
                  onClick={openSession}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div className="relative shrink-0">
                    {currentSong?.thumbnail ? (
                      <img
                        src={currentSong.thumbnail}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                        <Music className="w-5 h-5 text-white/50" />
                      </div>
                    )}
                    {isPlaying && !isPaused && !isMutedForMe && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-slate-900 animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate">
                      {isPaused
                        ? "On a break…"
                        : currentSong?.title || "Waiting for next song…"}
                    </p>
                    <p className="text-xs text-green-400/90 truncate">
                      {active?.sessionName || "Live session"}
                    </p>
                  </div>
                </button>

                {/* Up Next (hidden on narrow screens; queue button stays) */}
                {upNext && (
                  <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 pl-3 border-l border-white/10">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold flex items-center gap-1">
                        Up next
                        {votingActive && (
                          <span className="text-purple-300 font-mono normal-case">
                            · {Math.floor(timeRemaining / 60)}:
                            {(timeRemaining % 60).toString().padStart(2, "0")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-white/80 truncate">
                        {upNext.title}
                      </p>
                    </div>
                    {upNext.votable && (
                      <button
                        onClick={() => voteProposal(upNext.id)}
                        title={upNext.userHasVoted ? "Voted" : "Vote for next"}
                        className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                          upNext.userHasVoted
                            ? "bg-green-500 text-white"
                            : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30"
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span className="tabular-nums">{upNext.votes}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Controls */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={togglePlayPause}
                    disabled={isPaused}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    title={isPlaying ? "Pause" : "Play"}
                  >
                    {isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5" fill="currentColor" />
                    )}
                  </button>
                  <button
                    onClick={toggleMute}
                    className={`p-2 rounded-xl transition-colors ${
                      isMutedForMe
                        ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                    title={isMutedForMe ? "Unmute" : "Mute"}
                  >
                    {isMutedForMe ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    onClick={() => setQueueOpen(true)}
                    className="relative p-2 rounded-xl bg-white/10 hover:bg-white/15 transition-colors"
                    title="Open queue"
                  >
                    <ListMusic className="w-5 h-5" />
                    {votingActive && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                    )}
                  </button>
                  <button
                    onClick={leaveLive}
                    className="p-2 rounded-xl bg-white/10 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="Leave session"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Volume slider — mirrors the full-screen control */}
              {!isMutedForMe && (
                <div className="px-3 pb-2.5 -mt-0.5 flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  />
                  <span className="text-[11px] text-white/40 w-8 text-right">
                    {volume}%
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QueueOverlay open={queueOpen && show} onClose={() => setQueueOpen(false)} />
    </>
  );
};

export default MiniPlayer;
