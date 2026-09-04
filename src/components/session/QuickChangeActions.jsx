import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import BottomSheet from "./BottomSheet";

const LOOP_COUNTS = [3, 5, 10];

// Mobile-first control center (#66/#67/#68): one "⚡ Steuern" tap opens a bottom
// sheet with the quick actions (skip / pause / end / history) and per-song
// actions (move to front / loop / remove). Every action starts a democratic
// change request via onCreate; the resulting vote is shown by ChangeRequestBanner.
const QuickChangeActions = ({
  onCreate,
  onOpenHistory,
  currentSong,
  queuedSongs = [],
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const act = (type, payload) => {
    onCreate(type, payload);
    setOpen(false);
    setExpandedId(null);
  };

  if (disabled) return null;

  const songTitle = (s) => s.title || s.description || "Song";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-3 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
      >
        ⚡ Steuern & abstimmen
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Session steuern">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2">
          <BigButton disabled={!currentSong} onClick={() => act("skip_current")}>
            ⏭️ Überspringen
          </BigButton>
          <BigButton onClick={() => act("insert_pause", { duration_seconds: 30 })}>
            ⏸️ Pause 30s
          </BigButton>
          <BigButton
            onClick={() => {
              setOpen(false);
              onOpenHistory?.();
            }}
          >
            🕘 Verlauf
          </BigButton>
          <BigButton danger onClick={() => act("end_session")}>
            🛑 Beenden
          </BigButton>
        </div>

        {/* Per-song actions */}
        <p className="mb-2 mt-5 px-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
          Songs
        </p>
        <ul className="flex flex-col gap-1.5">
          {currentSong && (
            <SongRow
              title={currentSong.title || "Aktueller Song"}
              badge="läuft"
              expanded={expandedId === "current"}
              onToggle={() =>
                setExpandedId(expandedId === "current" ? null : "current")
              }
            >
              <LoopButtons
                onLoop={(n) =>
                  act("create_loop", {
                    queue_item_ids: currentSong.queueItemId
                      ? [currentSong.queueItemId]
                      : undefined,
                    repeat: n,
                  })
                }
              />
            </SongRow>
          )}

          {queuedSongs.map((s) => (
            <SongRow
              key={s.id}
              title={songTitle(s)}
              expanded={expandedId === s.id}
              onToggle={() => setExpandedId(expandedId === s.id ? null : s.id)}
            >
              <ActionChip
                onClick={() =>
                  act("move_item", { queue_item_id: s.id, after_item_id: null })
                }
              >
                ⬆️ Als Nächstes
              </ActionChip>
              <ActionChip
                danger
                onClick={() =>
                  act("remove_queued_item", { queue_item_id: s.id })
                }
              >
                ❌ Entfernen
              </ActionChip>
              <LoopButtons
                onLoop={(n) =>
                  act("create_loop", { queue_item_ids: [s.id], repeat: n })
                }
              />
            </SongRow>
          ))}

          {!currentSong && queuedSongs.length === 0 && (
            <li className="px-1 py-6 text-center text-sm text-white/40">
              Keine Songs in der Queue.
            </li>
          )}
        </ul>
      </BottomSheet>
    </>
  );
};

const BigButton = ({ children, onClick, disabled, danger }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`rounded-2xl border px-3 py-4 text-sm font-semibold transition-colors disabled:opacity-40 ${
      danger
        ? "border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
        : "border-white/10 bg-white/5 text-white hover:bg-white/10"
    }`}
  >
    {children}
  </button>
);

const SongRow = ({ title, badge, expanded, onToggle, children }) => (
  <li className="rounded-xl border border-white/10 bg-white/5">
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-white">{title}</span>
        {badge && (
          <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            {badge}
          </span>
        )}
      </span>
      <span className="shrink-0 text-white/40">{expanded ? "▲" : "⋯"}</span>
    </button>
    <AnimatePresence initial={false}>
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="overflow-hidden"
        >
          <div className="flex flex-wrap gap-1.5 px-3 pb-3">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  </li>
);

const ActionChip = ({ children, onClick, danger }) => (
  <button
    onClick={onClick}
    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
      danger
        ? "bg-red-500/15 text-red-200 hover:bg-red-500/25"
        : "bg-white/10 text-white hover:bg-white/20"
    }`}
  >
    {children}
  </button>
);

const LoopButtons = ({ onLoop }) => (
  <div className="flex items-center gap-1.5">
    <span className="text-xs text-white/50">🔁 Loop</span>
    {LOOP_COUNTS.map((n) => (
      <button
        key={n}
        onClick={() => onLoop(n)}
        className="rounded-lg bg-violet-500/20 px-2.5 py-2 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/30"
      >
        ×{n}
      </button>
    ))}
    <button
      onClick={() => onLoop("endless")}
      className="rounded-lg bg-violet-500/20 px-2.5 py-2 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/30"
    >
      ∞
    </button>
  </div>
);

export default QuickChangeActions;
