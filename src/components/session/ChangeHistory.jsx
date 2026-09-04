import BottomSheet from "./BottomSheet";

const LABELS = {
  "song.skipped": "Song übersprungen",
  "pause.inserted": "Pause eingefügt",
  "item.removed": "Song entfernt",
  "item.moved": "Song verschoben",
  "loop.created": "Loop erstellt",
  "session.ended": "Session beendet",
  "change.undone": "Änderung rückgängig gemacht",
};

const describe = (ev) => {
  if (ev.type === "loop.created") {
    const rep = ev.payload?.repeat;
    return `Loop erstellt${rep ? ` ×${rep}` : ""}`;
  }
  return LABELS[ev.type] || ev.type;
};

const time = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

// Democratic change log (#66/#67): every applied change, newest first. Reversible
// changes that haven't been undone yet get a "Rückgängig" button, which starts an
// undo_event vote — the group decides, nothing is ever final.
const ChangeHistory = ({ open, onClose, events = [], onUndo, disabled }) => {
  return (
    <BottomSheet open={open} onClose={onClose} title="Verlauf">
      {events.length === 0 ? (
        <p className="px-2 py-8 text-center text-sm text-white/50">
          Noch keine Änderungen in dieser Session.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((ev) => {
            const undoable =
              ev.reversible && !ev.undone_at && ev.type !== "change.undone";
            return (
              <li
                key={ev.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-medium ${
                      ev.undone_at ? "text-white/40 line-through" : "text-white"
                    }`}
                  >
                    {describe(ev)}
                  </p>
                  <p className="text-[11px] text-white/40">{time(ev.created_at)}</p>
                </div>
                {undoable && (
                  <button
                    onClick={() => onUndo(ev.id)}
                    disabled={disabled}
                    className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                  >
                    ↩︎ Rückgängig
                  </button>
                )}
                {ev.undone_at && (
                  <span className="shrink-0 text-[11px] text-white/40">
                    rückgängig
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </BottomSheet>
  );
};

export default ChangeHistory;
