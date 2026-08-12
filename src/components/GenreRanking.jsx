// Genre ranking over a time window (#43). Self-contained: fetches
// GET /stats/genre-ranking?window=week|month|all and renders ranked share bars.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart3 } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://api.tunevote.com"
).replace(/\/+$/, "");

const WINDOWS = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All time" },
];

export default function GenreRanking() {
  const [window, setWindow] = useState("week");
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    axios
      .get(`${API_BASE}/stats/genre-ranking`, { params: { window } })
      .then((res) => {
        if (!cancelled) setRanking(res.data.ranking || []);
      })
      .catch((err) => {
        console.error("genre ranking failed:", err);
        if (!cancelled) setRanking([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [window]);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <BarChart3 className="w-5 h-5 text-purple-300" />
          Trending genres
        </h3>
        <div className="flex gap-1">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => setWindow(w.key)}
              className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                window === w.key
                  ? "bg-purple-500/30 text-purple-200 border border-purple-400/40"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-white/40 text-sm">Loading…</p>
      ) : ranking.length === 0 ? (
        <p className="text-white/40 text-sm">No plays in this window yet.</p>
      ) : (
        <ul className="space-y-2">
          {ranking.map((r, i) => (
            <li key={r.genre} className="flex items-center gap-3">
              <span className="w-5 text-white/40 text-sm tabular-nums">
                {i + 1}
              </span>
              <div className="flex-1">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/90">{r.genre}</span>
                  <span className="text-white/50 tabular-nums">
                    {Math.round(r.share * 100)}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    style={{ width: `${Math.round(r.share * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
