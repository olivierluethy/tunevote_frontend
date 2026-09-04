import { useState } from "react";
import BottomSheet from "./BottomSheet";

// Named sections (#66): group queued songs into a named block, then skip/jump it
// as a whole. Every action is a democratic change request.
const SectionsSheet = ({
  open,
  onClose,
  sections = [],
  queuedSongs = [],
  onCreate,
  onSkip,
  onJump,
  onMove,
  onRename,
  disabled,
}) => {
  const [name, setName] = useState("");
  const [sel, setSel] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const toggle = (id) =>
    setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const songTitle = (s) => s.title || s.description || "Song";

  const create = () => {
    if (!name.trim() || !sel.length) return;
    onCreate(name.trim(), sel);
    setName("");
    setSel([]);
    onClose();
  };

  const active = sections.filter((s) => s.status === "active");
  const moveUp = (i) => onMove(active[i].id, active[i - 2]?.id ?? null);
  const moveDown = (i) => {
    const after = active[i + 1]?.id;
    if (after != null) onMove(active[i].id, after);
  };
  const saveName = (id) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="📚 Abschnitte">
      {active.length > 0 && (
        <ul className="mb-4 flex flex-col gap-2">
          {active.map((s, i) => (
            <li
              key={s.id}
              className="rounded-xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex flex-col">
                    <button
                      onClick={() => moveUp(i)}
                      disabled={disabled || i === 0 || !s.queued_count}
                      className="text-white/40 hover:text-white disabled:opacity-30"
                      aria-label="Abschnitt nach oben"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => moveDown(i)}
                      disabled={disabled || i === active.length - 1 || !s.queued_count}
                      className="text-white/40 hover:text-white disabled:opacity-30"
                      aria-label="Abschnitt nach unten"
                    >
                      ▼
                    </button>
                  </span>
                  <div className="min-w-0">
                    {editingId === s.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && saveName(s.id)}
                        maxLength={80}
                        autoFocus
                        className="w-full rounded-lg border border-violet-400 bg-white/10 px-2 py-1 text-sm text-white outline-none"
                      />
                    ) : (
                      <p className="truncate text-sm font-semibold text-white">
                        📚 {s.name}
                        <button
                          onClick={() => {
                            setEditingId(s.id);
                            setEditName(s.name);
                          }}
                          disabled={disabled}
                          className="ml-1.5 text-white/40 hover:text-white disabled:opacity-30"
                          aria-label="Umbenennen"
                        >
                          ✏️
                        </button>
                      </p>
                    )}
                    <p className="text-[11px] text-white/40">
                      {s.queued_count} offen · {s.items.length} Songs
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {editingId === s.id ? (
                    <button
                      onClick={() => saveName(s.id)}
                      className="rounded-lg bg-violet-500 px-2.5 py-2 text-xs font-semibold text-white hover:bg-violet-400"
                    >
                      Speichern (Abstimmung)
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => onJump(s.id)}
                        disabled={disabled || !s.queued_count}
                        className="rounded-lg bg-white/10 px-2.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40"
                      >
                        ⏭ Anspringen
                      </button>
                      <button
                        onClick={() => onSkip(s.id)}
                        disabled={disabled || !s.queued_count}
                        className="rounded-lg bg-red-500/15 px-2.5 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/25 disabled:opacity-40"
                      >
                        Überspringen
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="mb-1 px-1 text-[11px] uppercase tracking-wider text-white/40">
        Neuer Abschnitt
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name (z. B. Peak)"
        maxLength={80}
        className="mb-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-400"
      />
      <div className="flex flex-col gap-1.5">
        {queuedSongs.map((s) => {
          const on = sel.includes(s.id);
          return (
            <button
              key={s.id}
              onClick={() => toggle(s.id)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                on
                  ? "border-violet-400 bg-violet-500/20 text-white"
                  : "border-white/10 bg-white/5 text-white/90 hover:bg-white/10"
              }`}
            >
              <span>{on ? "☑" : "☐"}</span>
              <span className="truncate">{songTitle(s)}</span>
            </button>
          );
        })}
        {queuedSongs.length === 0 && (
          <p className="px-1 py-4 text-center text-sm text-white/40">
            Keine Songs in der Queue.
          </p>
        )}
      </div>

      <button
        onClick={create}
        disabled={disabled || !name.trim() || !sel.length}
        className="mt-3 w-full rounded-xl bg-violet-500 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
      >
        Abschnitt zur Abstimmung stellen ({sel.length})
      </button>
    </BottomSheet>
  );
};

export default SectionsSheet;
