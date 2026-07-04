import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, X, Music } from "lucide-react";
import { usePlayback } from "../context/PlaybackContext";

// ---------------------------------------------------------------------------
// PERSISTENT MINI-PLAYER
//
// Rendered once at the app root (inside PlaybackProvider). Visible whenever a
// session is active AND the user is NOT already on that session's detail
// screen — exactly like YouTube's mini-player. Tapping it returns to the full
// session; the ✕ fully leaves the session.
// ---------------------------------------------------------------------------

const MiniPlayer = () => {
  const {
    active,
    currentSong,
    isPlaying,
    isMutedForMe,
    isPaused,
    volume,
    togglePlayPause,
    toggleMute,
    setVolume,
    leaveLive,
  } = usePlayback();

  const location = useLocation();
  const navigate = useNavigate();

  const onThisSessionScreen =
    active && location.pathname === `/session/${active.sessionId}`;
  const show = !!active && !onThisSessionScreen;

  const openSession = () => {
    if (active) navigate(`/session/${active.sessionId}`);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed bottom-3 inset-x-3 z-50 max-w-2xl mx-auto"
        >
          <div className="rounded-2xl border border-green-500/30 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
            <div className="flex items-center gap-3 p-2.5">
              {/* Tap the artwork/title area to return to the full session */}
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
  );
};

export default MiniPlayer;
