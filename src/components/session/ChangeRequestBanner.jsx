import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Live countdown of whole seconds until `iso`, refreshed once per second.
const useCountdown = (iso) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return 0;
  return Math.max(0, Math.round((new Date(iso).getTime() - now) / 1000));
};

const OneRequest = ({ req, onVote, voted, disabled }) => {
  const remaining = useCountdown(req.expires_at);
  const pct = req.needed ? Math.min(100, (req.votes / req.needed) * 100) : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-violet-200/70">
            Abstimmung läuft
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {req.description}
          </p>
        </div>
        <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-white/80">
          {remaining}s
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full bg-violet-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-white/60">
          {req.votes}/{req.needed} Ja
        </span>
        <button
          onClick={() => onVote(req.id)}
          disabled={voted || disabled}
          className="shrink-0 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
        >
          {voted ? "✓ Dafür" : "👍 Dafür"}
        </button>
      </div>
    </motion.div>
  );
};

// Stack of currently-open change requests, each with its own countdown and a
// single upvote button. Purely presentational — data + socket live in SessionPage.
const ChangeRequestBanner = ({ requests = [], onVote, votedIds, disabled }) => {
  if (!requests.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {requests.map((req) => (
          <OneRequest
            key={req.id}
            req={req}
            onVote={onVote}
            voted={votedIds?.has(req.id)}
            disabled={disabled}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ChangeRequestBanner;
