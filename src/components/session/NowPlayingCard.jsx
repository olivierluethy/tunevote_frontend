import { motion } from "framer-motion";
import { Volume2, VolumeX, Disc3 } from "lucide-react";
import SongWaveform from "./SongWaveform";

// ---------------------------------------------------------------------------
// NOW PLAYING — the energetic centerpiece of a live session.
//
// A large record-style album tile with an ambient glow and a slow spin while
// audio is playing (the turntable motif of a shared radio), the track title,
// a live-synced waveform, and the per-user mute + volume controls. Everything
// calms down under prefers-reduced-motion.
// ---------------------------------------------------------------------------
const NowPlayingCard = ({
  currentSong,
  isMutedForMe,
  volume,
  isPlaying,
  getProgress,
  onToggleMute,
  onVolumeChange,
}) => {
  if (!currentSong) return null;

  const live = !!isPlaying && !isMutedForMe;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 via-slate-900/40 to-slate-950/60 p-5 shadow-[0_10px_40px_-12px_rgba(16,185,129,0.35)] sm:p-6">
      {/* Ambient, breathing glow keyed to whether audio is actually playing */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl transition-opacity duration-700 ${
          live
            ? "bg-emerald-500/30 animate-ambient-glow motion-reduce:animate-none"
            : "bg-white/5"
        }`}
      />

      <div className="relative flex items-center gap-4 sm:gap-5">
        {/* Album tile — spins slowly like a record while playing */}
        <div className="relative shrink-0">
          <motion.div
            animate={live ? { rotate: 360 } : { rotate: 0 }}
            transition={
              live
                ? { duration: 8, repeat: Infinity, ease: "linear" }
                : { duration: 0.4 }
            }
            className={`relative h-24 w-24 overflow-hidden rounded-2xl ring-1 sm:h-32 sm:w-32 motion-reduce:!rotate-0 ${
              live
                ? "ring-emerald-400/50 shadow-[0_0_28px_-4px_rgba(16,185,129,0.6)]"
                : "ring-white/10"
            }`}
          >
            {currentSong.thumbnail ? (
              <img
                src={currentSong.thumbnail}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/10">
                <Disc3 className="h-10 w-10 text-white/40" />
              </div>
            )}
            {/* Center spindle for the record feel */}
            <div className="absolute inset-0 grid place-items-center">
              <span className="h-3 w-3 rounded-full bg-slate-950/80 ring-2 ring-white/30" />
            </div>
          </motion.div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-300">
            <span className="relative flex h-2 w-2">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Now playing
          </p>
          <p className="line-clamp-2 text-lg font-bold leading-tight text-white sm:text-2xl">
            {currentSong.title}
          </p>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={onToggleMute}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors ${
                isMutedForMe
                  ? "bg-red-500/20 text-red-400"
                  : "bg-white/10 text-white hover:bg-white/15"
              }`}
              title={isMutedForMe ? "Unmute for me" : "Mute for me"}
            >
              {isMutedForMe ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>

            {isMutedForMe ? (
              <span className="text-sm text-red-300/80">Muted for you</span>
            ) : (
              <div className="flex flex-1 items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={onVolumeChange}
                  aria-label="Volume"
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(16,185,129,0.9)]"
                />
                <span className="w-9 text-right text-xs tabular-nums text-white/50">
                  {volume}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Full-width live waveform — the pulse of the room */}
      <SongWaveform
        seed={currentSong.videoId || currentSong.title || ""}
        playing={live}
        getProgress={getProgress}
        bars={96}
        heightClass="h-20"
        className="relative mt-4"
      />
    </div>
  );
};

export default NowPlayingCard;
