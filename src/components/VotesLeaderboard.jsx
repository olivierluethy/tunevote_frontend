// "Most votes given" leaderboard (#42). Self-contained: fetches
// GET /stats/votes-leaderboard, highlights the current user, and — if they fall
// outside the top slice — shows their own rank in a footer row.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Trophy } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://api.tunevote.com"
).replace(/\/+$/, "");

const MEDAL = ["🥇", "🥈", "🥉"];

export default function VotesLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios
      .get(`${API_BASE}/stats/votes-leaderboard`, { params: { limit: 10 }, headers })
      .then((res) => setData(res.data))
      .catch((err) => console.error("leaderboard failed:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  const entries = data?.entries || [];
  const meInList = entries.some((e) => e.isMe);

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
      <h3 className="mb-4 flex items-center gap-2 font-semibold text-white">
        <Trophy className="h-5 w-5 text-yellow-400" />
        Top voters
      </h3>

      {entries.length === 0 ? (
        <p className="text-sm text-white/40">No votes cast yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li
              key={e.userId}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
                e.isMe ? "bg-purple-500/15 border border-purple-400/30" : "bg-white/5"
              }`}
            >
              <span className="w-6 text-center text-sm tabular-nums text-white/50">
                {MEDAL[e.rank - 1] || e.rank}
              </span>
              <span className="flex-1 truncate text-sm text-white/90">
                {e.name}
                {e.isMe && (
                  <span className="ml-1 text-xs text-purple-300">(you)</span>
                )}
              </span>
              <span className="text-sm font-semibold tabular-nums text-white">
                {e.score}
              </span>
            </li>
          ))}
        </ul>
      )}

      {data?.me && !meInList && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-purple-400/30 bg-purple-500/10 px-3 py-2">
          <span className="w-6 text-center text-sm tabular-nums text-white/60">
            {data.me.rank}
          </span>
          <span className="flex-1 truncate text-sm text-white/90">
            {data.me.name}
            <span className="ml-1 text-xs text-purple-300">(you)</span>
          </span>
          <span className="text-sm font-semibold tabular-nums text-white">
            {data.me.score}
          </span>
        </div>
      )}
    </div>
  );
}
