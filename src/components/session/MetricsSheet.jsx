import { useEffect, useState } from "react";
import axios from "axios";
import BottomSheet from "./BottomSheet";

const Stat = ({ label, value }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-3">
    <p className="text-2xl font-bold tabular-nums text-white">{value ?? 0}</p>
    <p className="text-[11px] text-white/50">{label}</p>
  </div>
);

// Read-only session summary (#67 §10), fetched fresh each time it opens.
const MetricsSheet = ({ open, onClose, sessionId, apiBase, headers }) => {
  const [m, setM] = useState(null);

  useEffect(() => {
    if (!open || !sessionId) return;
    setM(null);
    axios
      .get(`${apiBase}/sessions/${sessionId}/metrics`, { headers: headers() })
      .then((r) => setM(r.data))
      .catch(() => setM(null));
  }, [open, sessionId, apiBase]);

  return (
    <BottomSheet open={open} onClose={onClose} title="📊 Statistik">
      {!m ? (
        <p className="py-8 text-center text-sm text-white/50">Lade …</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Songs gespielt" value={m.songs_played} />
            <Stat label="Pausen" value={m.pauses_played} />
            <Stat label="Loops" value={m.loops} />
            <Stat label="Abstimmungen" value={m.change_requests} />
            <Stat label="Angenommen" value={m.applied} />
            <Stat label="Abgelaufen" value={m.expired} />
            <Stat label="Rückgängig" value={m.undone} />
            <Stat label="Fehlgeschlagen" value={m.failed} />
          </div>
          {m.most_influential?.length > 0 && (
            <>
              <p className="mb-2 mt-5 px-1 text-[11px] font-medium uppercase tracking-wider text-white/40">
                Einflussreichste Änderungen
              </p>
              <ul className="flex flex-col gap-1.5">
                {m.most_influential.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-white/90">{c.type}</span>
                    <span className="shrink-0 tabular-nums text-xs text-white/60">
                      {c.votes} Stimmen
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </BottomSheet>
  );
};

export default MetricsSheet;
