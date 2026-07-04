import { motion } from "framer-motion";

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

// Suggesting / voting phase banner with countdown and progress bar.
const VotingBanner = ({ votingPhase, timeRemaining }) => {
  if (!votingPhase || timeRemaining <= 0) return null;
  const isSuggestion = votingPhase.phase === "suggestion";
  return (
    <div
      className={`p-4 rounded-2xl ${
        isSuggestion
          ? "bg-gradient-to-r from-emerald-500/15 to-green-500/10 border border-emerald-500/30"
          : "bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/30"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs uppercase tracking-wider font-medium opacity-70">
            {isSuggestion ? "Suggesting phase" : "Voting phase"}
          </p>
          <p className="font-semibold text-sm">
            {isSuggestion
              ? "Add the songs you want to hear next"
              : "Pick your favourites — top votes get played"}
          </p>
        </div>
        <span className="text-2xl font-mono font-bold tabular-nums">
          {formatTime(timeRemaining)}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${isSuggestion ? "bg-emerald-400" : "bg-orange-400"}`}
          initial={{ width: 0 }}
          animate={{
            width: `${
              ((votingPhase.duration - timeRemaining) / votingPhase.duration) *
              100
            }%`,
          }}
          transition={{ duration: 1, ease: "linear" }}
        />
      </div>
    </div>
  );
};

export default VotingBanner;
