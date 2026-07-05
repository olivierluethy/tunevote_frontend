import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
//
// This file is the VISUAL layer only: it reads playback state/actions from the
// provider and renders them. It owns no playback logic or data flow.
// ---------------------------------------------------------------------------

// Small live equalizer over the album art while a track is actively playing.
// Purely decorative; collapses to a calm static bar under prefers-reduced-motion.
const EqualizerBars = () => (
  <div className="flex h-full items-end gap-[2.5px]" aria-hidden="true">
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className="w-[3px] h-full origin-bottom rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.8)] animate-equalize motion-reduce:animate-none motion-reduce:!h-1/2"
        style={{ animationDelay: `${i * 130}ms` }}
      />
    ))}
  </div>
);

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
    getPlaybackProgress,
  } = usePlayback();

  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
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

  // --- Derived visual state -------------------------------------------------
  const onBreak = isPaused;
  const playing = !!currentSong && isPlaying && !onBreak && !isMutedForMe;

  // Ambient edge-glow reacts to state: emerald when live, amber on a break,
  // dim when idle/waiting.
  const glowGradient = onBreak
    ? "from-amber-500/40 via-orange-500/25 to-amber-500/40"
    : playing
      ? "from-emerald-500/50 via-purple-500/30 to-pink-500/45"
      : "from-white/10 via-white/[0.06] to-white/10";
  const accentBorder = onBreak ? "border-amber-400/30" : "border-emerald-400/25";

  // Live song-progress bar. We poll the provider's server-authoritative getter
  // ~2.5×/sec and let CSS ease the fill between ticks so it glides smoothly.
  // Read-only: playback is synced session-wide, so seeking is intentionally off.
  const [progress, setProgress] = useState({ position: 0, duration: 0 });
  useEffect(() => {
    if (!show || !currentSong || onBreak) {
      setProgress({ position: 0, duration: 0 });
      return;
    }
    const tick = () => setProgress(getPlaybackProgress());
    tick();
    const id = setInterval(tick, 400);
    return () => clearInterval(id);
    // getPlaybackProgress reads refs (stable); re-subscribe only on song change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, currentSong?.videoId, onBreak]);

  const pct =
    progress.duration > 0
      ? Math.min(100, (progress.position / progress.duration) * 100)
      : 0;
  const showProgress = !!currentSong && !onBreak && progress.duration > 0;
  const fmtTime = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${sec}`;
  };

  // framer-motion presets, all disabled under prefers-reduced-motion.
  const enter = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { y: 90, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: 90, opacity: 0 },
      };
  const press = reduce
    ? {}
    : { whileHover: { scale: 1.09 }, whileTap: { scale: 0.88 } };

  const statusText = onBreak
    ? "On a break…"
    : currentSong?.title || "Waiting for next song…";

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            {...enter}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed bottom-2 sm:bottom-3 inset-x-2 sm:inset-x-3 z-50 max-w-3xl mx-auto"
          >
            {/* Positioning wrapper so the ambient glow can sit behind the bar */}
            <div className="relative">
              {/* Ambient breathing glow */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute -inset-1 rounded-[26px] bg-gradient-to-r ${glowGradient} blur-xl opacity-60 animate-ambient-glow motion-reduce:animate-none`}
              />

              {/* The glass bar */}
              <div
                className={`relative rounded-[22px] border ${accentBorder} bg-gradient-to-b from-slate-900/85 to-slate-950/90 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden`}
              >
                {/* subtle top sheen */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />

                <div className="flex items-center gap-2.5 sm:gap-3 p-2 sm:p-2.5">
                  {/* Current song — tap to return to the full session */}
                  <button
                    onClick={openSession}
                    className="group flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 text-left"
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`relative w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-xl overflow-hidden ring-1 transition-shadow ${
                          playing
                            ? "ring-emerald-400/40 shadow-[0_0_18px_-2px_rgba(16,185,129,0.55)]"
                            : "ring-white/10"
                        }`}
                      >
                        {currentSong?.thumbnail ? (
                          <img
                            src={currentSong.thumbnail}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-white/10 flex items-center justify-center">
                            <Music className="w-5 h-5 text-white/50" />
                          </div>
                        )}
                        {/* live equalizer overlay */}
                        {playing && (
                          <div className="absolute inset-x-0 bottom-0 flex h-4 items-end justify-center bg-gradient-to-t from-black/75 via-black/30 to-transparent pb-1">
                            <div className="h-2.5">
                              <EqualizerBars />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.p
                          key={statusText}
                          initial={reduce ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.22 }}
                          className="text-sm font-semibold text-white truncate"
                        >
                          {statusText}
                        </motion.p>
                      </AnimatePresence>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium max-w-full ${
                          onBreak ? "text-amber-300/90" : "text-emerald-400/90"
                        }`}
                      >
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          {playing && (
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping motion-reduce:animate-none" />
                          )}
                          <span
                            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                              onBreak ? "bg-amber-400" : "bg-emerald-400"
                            }`}
                          />
                        </span>
                        <span className="truncate">
                          {active?.sessionName || "Live session"}
                        </span>
                      </span>
                    </div>
                  </button>

                  {/* Up Next (desktop/tablet only; queue button covers mobile) */}
                  {upNext && (
                    <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 pl-3 border-l border-white/10">
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.div
                          key={upNext.id}
                          initial={reduce ? false : { opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -12 }}
                          transition={{ duration: 0.28 }}
                          className="flex items-center gap-2 min-w-0 flex-1"
                        >
                          {upNext.thumbnail ? (
                            <img
                              src={upNext.thumbnail}
                              alt=""
                              className="w-8 h-8 rounded-lg object-cover shrink-0 ring-1 ring-white/10"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                              <Music className="w-4 h-4 text-white/40" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold flex items-center gap-1">
                              Up next
                              {votingActive && (
                                <span className="text-purple-300 font-mono normal-case tabular-nums">
                                  · {Math.floor(timeRemaining / 60)}:
                                  {(timeRemaining % 60)
                                    .toString()
                                    .padStart(2, "0")}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-white/80 truncate">
                              {upNext.title}
                            </p>
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      {upNext.votable && (
                        <motion.button
                          {...press}
                          onClick={() => voteProposal(upNext.id)}
                          title={upNext.userHasVoted ? "Voted" : "Vote for next"}
                          className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-shadow ${
                            upNext.userHasVoted
                              ? "bg-emerald-500 text-white shadow-[0_0_16px_-2px_rgba(16,185,129,0.7)]"
                              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/40"
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="relative w-[1ch] text-center overflow-hidden tabular-nums">
                            <AnimatePresence mode="popLayout" initial={false}>
                              <motion.span
                                key={upNext.votes}
                                initial={
                                  reduce ? false : { y: -12, opacity: 0 }
                                }
                                animate={{ y: 0, opacity: 1 }}
                                exit={
                                  reduce ? { opacity: 0 } : { y: 12, opacity: 0 }
                                }
                                transition={{ duration: 0.2 }}
                                className="block"
                              >
                                {upNext.votes}
                              </motion.span>
                            </AnimatePresence>
                          </span>
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Controls */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {/* Play / Pause — primary, prominent */}
                    <motion.button
                      {...press}
                      onClick={togglePlayPause}
                      disabled={onBreak}
                      className="grid place-items-center w-10 h-10 rounded-full text-slate-950 bg-gradient-to-br from-emerald-300 to-emerald-500 shadow-lg shadow-emerald-500/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                      title={isPlaying ? "Pause" : "Play"}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={isPlaying ? "pause" : "play"}
                          initial={
                            reduce
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 0.4, rotate: -45 }
                          }
                          animate={
                            reduce
                              ? { opacity: 1 }
                              : { opacity: 1, scale: 1, rotate: 0 }
                          }
                          exit={
                            reduce
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 0.4, rotate: 45 }
                          }
                          transition={{ duration: 0.16 }}
                          className="flex"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5" fill="currentColor" />
                          ) : (
                            <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </motion.button>

                    {/* Mute */}
                    <motion.button
                      {...press}
                      onClick={toggleMute}
                      className={`grid place-items-center w-9 h-9 rounded-full transition-colors ${
                        isMutedForMe
                          ? "bg-red-500/20 text-red-400"
                          : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                      title={isMutedForMe ? "Unmute" : "Mute"}
                    >
                      {isMutedForMe ? (
                        <VolumeX className="w-[18px] h-[18px]" />
                      ) : (
                        <Volume2 className="w-[18px] h-[18px]" />
                      )}
                    </motion.button>

                    {/* Queue */}
                    <motion.button
                      {...press}
                      onClick={() => setQueueOpen(true)}
                      className="relative grid place-items-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/15 transition-colors"
                      title="Open queue"
                    >
                      <ListMusic className="w-[18px] h-[18px]" />
                      {votingActive && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75 animate-ping motion-reduce:animate-none" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-purple-400" />
                        </span>
                      )}
                    </motion.button>

                    {/* Close */}
                    <motion.button
                      {...press}
                      onClick={leaveLive}
                      className="grid place-items-center w-9 h-9 rounded-full bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400 transition-colors"
                      title="Leave session"
                    >
                      <X className="w-[18px] h-[18px]" />
                    </motion.button>
                  </div>
                </div>

                {/* Song progress — live, read-only (session-synced playback) */}
                {showProgress && (
                  <div className="px-3 -mt-1 pb-1.5 flex items-center gap-2">
                    <span className="text-[10px] tabular-nums text-white/45 w-8 text-right shrink-0">
                      {fmtTime(progress.position)}
                    </span>
                    <div className="relative flex-1 h-3 flex items-center">
                      <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-[width] duration-500 ease-linear motion-reduce:transition-none"
                          style={{ width: `${pct}%` }}
                        >
                          <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer motion-reduce:hidden" />
                        </div>
                      </div>
                      <div
                        className="absolute h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_8px_rgba(52,211,153,0.9)] transition-[left] duration-500 ease-linear motion-reduce:transition-none"
                        style={{ left: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] tabular-nums text-white/45 w-8 shrink-0">
                      {fmtTime(progress.duration)}
                    </span>
                  </div>
                )}

                {/* Volume bar — custom animated track over a transparent native input */}
                {!isMutedForMe && (
                  <div className="px-3 pb-2.5 -mt-0.5 flex items-center gap-3">
                    <Volume2 className="w-3.5 h-3.5 text-white/35 shrink-0" />
                    <div className="relative flex-1 h-4 flex items-center group/vol">
                      {/* transparent native range on top = real interaction/drag */}
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(parseInt(e.target.value))}
                        aria-label="Volume"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                      />
                      {/* track */}
                      <div className="pointer-events-none absolute inset-x-0 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="relative h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                          style={{ width: `${volume}%` }}
                        >
                          {/* shimmer sweep across the filled portion */}
                          <span className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer motion-reduce:hidden" />
                        </div>
                      </div>
                      {/* glowing thumb */}
                      <div
                        className="pointer-events-none absolute z-10 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white ring-2 ring-emerald-400/60 shadow-[0_0_10px_rgba(52,211,153,0.9)] transition-transform group-hover/vol:scale-125"
                        style={{ left: `${volume}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-white/40 w-8 text-right tabular-nums">
                      {volume}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <QueueOverlay open={queueOpen && show} onClose={() => setQueueOpen(false)} />
    </>
  );
};

export default MiniPlayer;
