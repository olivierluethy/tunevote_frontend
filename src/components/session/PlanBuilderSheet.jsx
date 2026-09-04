import { useState } from "react";
import BottomSheet from "./BottomSheet";

// "Änderungsplan" (#67): bundle several actions into ONE plan and put it to a
// single vote (Plan vs. nichts), instead of many separate proposals. Uses the
// backend's multi-action alternative-flow options (applyFlow).
const PlanBuilderSheet = ({ open, onClose, queuedSongs = [], onSubmit, disabled }) => {
  const [steps, setSteps] = useState([]);
  const title = (s) => s.title || s.description || "Song";

  const add = (type, payload, label) =>
    setSteps((p) => [...p, { type, payload, label }]);
  const removeStep = (i) => setSteps((p) => p.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!steps.length) return;
    onSubmit(
      steps.map((s) => ({ type: s.type, payload: s.payload })),
      steps.map((s) => s.label).join(" + "),
    );
    setSteps([]);
    onClose();
  };

  const close = () => {
    setSteps([]);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={close} title="🧩 Änderungsplan">
      {steps.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 p-2">
          {steps.map((s, i) => (
            <span
              key={i}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-2 py-1 text-xs text-white"
            >
              {i > 0 && <span className="text-white/30">+</span>}
              <span className="max-w-[10rem] truncate">{s.label}</span>
              <button
                onClick={() => removeStep(i)}
                className="text-white/50 hover:text-white"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <p className="mb-1 px-1 text-[11px] uppercase tracking-wider text-white/40">
        Aktion hinzufügen
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <AddBtn onClick={() => add("insert_pause", { duration_seconds: 30 }, "⏸ Pause 30s")}>
          ＋ ⏸ Pause 30s
        </AddBtn>
        <AddBtn onClick={() => add("skip_current", {}, "⏭ Skip")}>＋ ⏭ Skip</AddBtn>
      </div>

      {queuedSongs.length > 0 && (
        <>
          <p className="mb-1 px-1 text-[11px] uppercase tracking-wider text-white/40">
            Song-Aktionen
          </p>
          <ul className="flex flex-col gap-1.5">
            {queuedSongs.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-sm text-white/90">
                  {title(s)}
                </span>
                <button
                  onClick={() =>
                    add(
                      "create_loop",
                      { queue_item_ids: [s.id], repeat: 3 },
                      `🔁 ${title(s)} ×3`,
                    )
                  }
                  className="rounded-lg bg-violet-500/20 px-2.5 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/30"
                >
                  🔁 ×3
                </button>
                <button
                  onClick={() =>
                    add(
                      "remove_queued_item",
                      { queue_item_id: s.id },
                      `❌ ${title(s)}`,
                    )
                  }
                  className="rounded-lg bg-red-500/15 px-2.5 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/25"
                >
                  ❌
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button
        onClick={submit}
        disabled={disabled || !steps.length}
        className="mt-4 w-full rounded-xl bg-violet-500 px-3 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-400 disabled:opacity-40"
      >
        Plan zur Abstimmung stellen ({steps.length})
      </button>
    </BottomSheet>
  );
};

const AddBtn = ({ children, onClick }) => (
  <button
    onClick={onClick}
    className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
  >
    {children}
  </button>
);

export default PlanBuilderSheet;
