import { useState } from "react";
import BottomSheet from "./BottomSheet";

// Drag-and-drop queue reorder (#68). Desktop: drag a row onto another to move it
// there. Touch: the ▲/▼ buttons. Every move is submitted as a democratic
// move_item change request (solo host → applies instantly; with others → a quick
// vote), so reordering stays consistent with the rest of the session.
const ReorderSheet = ({ open, onClose, songs = [], onMove, disabled }) => {
  const [dragId, setDragId] = useState(null);
  const title = (s) => s.title || s.description || "Song";

  // move_item places the song AFTER `after_item_id` (null = front of the queue).
  const moveUp = (i) => onMove(songs[i].id, songs[i - 2]?.id ?? null);
  const moveDown = (i) => {
    const after = songs[i + 1]?.id;
    if (after != null) onMove(songs[i].id, after);
  };
  const dropOn = (targetIdx) => {
    const target = songs[targetIdx];
    if (dragId == null || !target || target.id === dragId) {
      setDragId(null);
      return;
    }
    onMove(dragId, target.id);
    setDragId(null);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="↕ Reihenfolge ändern">
      {songs.length === 0 ? (
        <p className="py-8 text-center text-sm text-white/50">
          Keine Songs in der Queue.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {songs.map((s, i) => (
            <li
              key={s.id}
              draggable={!disabled}
              onDragStart={() => setDragId(s.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(i)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-3 ${
                dragId === s.id
                  ? "border-violet-400 bg-violet-500/20"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <span className="cursor-grab select-none text-white/40">≡</span>
              <span className="min-w-0 flex-1 truncate text-sm text-white">
                <span className="tabular-nums text-white/40">{i + 1}.</span>{" "}
                {title(s)}
              </span>
              <button
                onClick={() => moveUp(i)}
                disabled={disabled || i === 0}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                aria-label="Nach oben"
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(i)}
                disabled={disabled || i === songs.length - 1}
                className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                aria-label="Nach unten"
              >
                ▼
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 px-1 text-[11px] text-white/40">
        Jede Verschiebung wird zur Abstimmung gestellt.
      </p>
    </BottomSheet>
  );
};

export default ReorderSheet;
