import BottomSheet from "./BottomSheet";

// Long-press a queued song → its extended options (#68). Each action is a
// democratic change request. Buttons only; the gesture is just the shortcut in.
const SongActionSheet = ({
  open,
  onClose,
  song,
  onMoveFront,
  onLoop,
  onRemove,
  disabled,
}) => {
  const title = song ? song.title || song.description || "Song" : "";
  const isPause = song?.item_type === "pause";
  const run = (fn) => {
    if (song) fn(song.id);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => run(onMoveFront)}
          disabled={disabled}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm text-white transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          ⬆️ Als Nächstes
        </button>

        {!isPause && (
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-sm text-white/60">🔁 Loop</span>
            {[3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => {
                  if (song) onLoop(song.id, n);
                  onClose();
                }}
                disabled={disabled}
                className="rounded-lg bg-violet-500/20 px-3 py-2 text-xs font-semibold text-violet-200 transition-colors hover:bg-violet-500/30 disabled:opacity-40"
              >
                ×{n}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => run(onRemove)}
          disabled={disabled}
          className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-left text-sm text-red-200 transition-colors hover:bg-red-500/20 disabled:opacity-40"
        >
          ❌ Entfernen
        </button>
      </div>
    </BottomSheet>
  );
};

export default SongActionSheet;
