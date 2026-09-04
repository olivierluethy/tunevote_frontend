import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Quick "⚡ Abstimmung" launcher: one tap opens the four generic change requests
// (skip, pause, remove, end). Deliberately compact and mobile-friendly — the
// full mobile-UX epic (#68) comes later. `onCreate(type, payload)` POSTs the
// request; the resulting banner is rendered by ChangeRequestBanner.
const QuickChangeActions = ({
  onCreate,
  currentSong,
  queuedSongs = [],
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const act = (type, payload) => {
    onCreate(type, payload);
    setOpen(false);
    setRemoving(false);
  };

  if (disabled) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-500/20"
      >
        ⚡ Abstimmung starten
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-2 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur"
          >
            {!removing ? (
              <>
                <ActionButton
                  disabled={!currentSong}
                  onClick={() => act("skip_current")}
                >
                  ⏭️ Aktuellen Song überspringen
                </ActionButton>
                <ActionButton
                  onClick={() => act("insert_pause", { duration_seconds: 30 })}
                >
                  ⏸️ 30-Sek.-Pause einfügen
                </ActionButton>
                <ActionButton
                  disabled={!queuedSongs.length}
                  onClick={() => setRemoving(true)}
                >
                  ❌ Song aus der Queue entfernen
                </ActionButton>
                <ActionButton onClick={() => act("end_session")}>
                  🛑 Session beenden
                </ActionButton>
              </>
            ) : (
              <>
                <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-white/50">
                  Welchen Song entfernen?
                </p>
                {queuedSongs.map((s) => (
                  <ActionButton
                    key={s.id}
                    onClick={() =>
                      act("remove_queued_item", { queue_item_id: s.id })
                    }
                  >
                    <span className="truncate">
                      {s.title || s.description || "Song"}
                    </span>
                  </ActionButton>
                ))}
                <ActionButton onClick={() => setRemoving(false)}>
                  ← Zurück
                </ActionButton>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ActionButton = ({ children, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-40"
  >
    {children}
  </button>
);

export default QuickChangeActions;
