import { motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";

// "Now playing" card with the per-user mute toggle and volume slider.
const NowPlayingCard = ({
  currentSong,
  isMutedForMe,
  volume,
  onToggleMute,
  onVolumeChange,
}) => {
  if (!currentSong) return null;
  return (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/10 border border-green-500/30">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <img
            src={currentSong.thumbnail}
            alt=""
            className="w-14 h-14 rounded-xl object-cover"
          />
          <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="w-2 h-2 bg-green-400 rounded-full"
            />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-green-400 font-medium uppercase tracking-wider mb-0.5">
            Now playing
          </p>
          <p className="font-semibold truncate">{currentSong.title}</p>
        </div>
        <button
          onClick={onToggleMute}
          className={`p-2.5 rounded-xl transition-colors shrink-0 ${
            isMutedForMe
              ? "bg-red-500/20 text-red-400"
              : "bg-white/10 hover:bg-white/15"
          }`}
          title={isMutedForMe ? "Unmute for me" : "Mute for me"}
        >
          {isMutedForMe ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
      </div>
      {!isMutedForMe && (
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={onVolumeChange}
            className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          />
          <span className="text-xs text-white/50 w-8 text-right">{volume}%</span>
        </div>
      )}
    </div>
  );
};

export default NowPlayingCard;
