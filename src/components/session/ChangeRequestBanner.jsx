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

// One "Jetzt / Danach" line: the first few queue labels joined with arrows.
const PreviewLine = ({ label, items = [], muted }) => (
  <div className="flex items-baseline gap-2">
    <span className="w-12 shrink-0 uppercase tracking-wider text-white/40">
      {label}
    </span>
    <span className={`truncate ${muted ? "text-white/50" : "text-white/90"}`}>
      {items.slice(0, 5).join("  →  ") || "—"}
      {items.length > 5 ? "  →  …" : ""}
    </span>
  </div>
);

// Multi-option poll: one button per option, each showing its live tally.
const PollOptions = ({ req, myVote, onVote, disabled }) => {
  const maxVotes = Math.max(1, ...req.options.map((o) => o.votes));
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {req.options.map((opt) => {
        const picked = myVote === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onVote(req.id, opt.id)}
            disabled={disabled}
            className={`relative overflow-hidden rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
              picked
                ? "border-violet-400 bg-violet-500/20 text-white"
                : "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
            }`}
          >
            <span
              className="absolute inset-y-0 left-0 bg-violet-400/10"
              style={{ width: `${(opt.votes / maxVotes) * 100}%` }}
            />
            <span className="relative z-10 flex items-center justify-between gap-2">
              <span className="truncate">
                {picked ? "● " : ""}
                {opt.label}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-white/60">
                {opt.votes}
              </span>
            </span>
          </button>
        );
      })}
      <p className="text-[11px] text-white/40">
        Benötigt {req.needed} Stimmen · {req.live} live
      </p>
    </div>
  );
};

// Ranking poll: tap options in preference order, then submit. Shows the current
// Borda points per option.
const RankingOptions = ({ req, onRank, disabled }) => {
  const [order, setOrder] = useState([]);
  const toggle = (id) =>
    setOrder((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const rankOf = (id) => {
    const i = order.indexOf(id);
    return i >= 0 ? i + 1 : null;
  };
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {req.options.map((opt) => {
        const r = rankOf(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            disabled={disabled}
            className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:opacity-40 ${
              r
                ? "border-violet-400 bg-violet-500/20 text-white"
                : "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
            }`}
          >
            <span className="truncate">
              {r ? `${r}. ` : ""}
              {opt.label}
            </span>
            <span className="shrink-0 tabular-nums text-xs text-white/60">
              {opt.votes} P.
            </span>
          </button>
        );
      })}
      <button
        onClick={() => onRank(req.id, order)}
        disabled={disabled || !order.length}
        className="mt-1 rounded-lg bg-violet-500 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
      >
        Reihenfolge abschicken
      </button>
      <p className="text-[11px] text-white/40">
        Tippe die Optionen in Wunsch-Reihenfolge · Borda-Punkte
      </p>
    </div>
  );
};

const OneRequest = ({ req, onVote, onRank, myVote, disabled }) => {
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
            {req.is_poll ? "Abstimmung — wähle eine Option" : "Abstimmung läuft"}
          </p>
          <p className="truncate text-sm font-semibold text-white">
            {req.description}
          </p>
        </div>
        <span className="shrink-0 font-mono text-lg font-bold tabular-nums text-white/80">
          {remaining}s
        </span>
      </div>

      {req.preview && (
        <div className="mt-3 space-y-1 rounded-xl bg-black/20 p-2.5 text-[11px]">
          <PreviewLine label="Jetzt" items={req.preview.before} muted />
          <PreviewLine label="Danach" items={req.preview.after} />
        </div>
      )}

      {req.is_poll && req.vote_method === "ranking" ? (
        <RankingOptions req={req} onRank={onRank} disabled={disabled} />
      ) : req.is_poll ? (
        <PollOptions req={req} myVote={myVote} onVote={onVote} disabled={disabled} />
      ) : (
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
            disabled={!!myVote || disabled}
            className="shrink-0 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
          >
            {myVote ? "✓ Dafür" : "👍 Dafür"}
          </button>
        </div>
      )}
    </motion.div>
  );
};

// Stack of currently-open change requests / polls. Purely presentational — data
// and socket handling live in SessionPage. `myVotes` maps crId → optionId | true.
const ChangeRequestBanner = ({
  requests = [],
  onVote,
  onRank,
  myVotes = {},
  disabled,
}) => {
  if (!requests.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {requests.map((req) => (
          <OneRequest
            key={req.id}
            req={req}
            onVote={onVote}
            onRank={onRank}
            myVote={myVotes[req.id]}
            disabled={disabled}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ChangeRequestBanner;
