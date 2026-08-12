// "Polar Moment" rank-gap stat (#50). Shows the user's rank on the votes-given
// leaderboard, the competitor directly above them, the gap, and a nudge.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Target, Crown } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://api.tunevote.com"
).replace(/\/+$/, "");

export default function PolarMoment() {
  const [data, setData] = useState(undefined); // undefined=loading, null=none

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setData(null);
      return;
    }
    axios
      .get(`${API_BASE}/stats/polar-moment`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data))
      .catch((err) => {
        console.error("polar-moment failed:", err);
        setData(null);
      });
  }, []);

  if (data === undefined) return null; // loading
  if (data === null) return null; // no votes cast yet / not logged in

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-5">
      <div className="mb-3 flex items-center gap-2">
        <Target className="h-5 w-5 text-purple-300" />
        <h3 className="font-semibold text-white">Polar Moment</h3>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold tabular-nums text-white">
          #{data.rank}
        </span>
        <span className="text-sm text-white/50">
          · {data.myScore} vote{data.myScore === 1 ? "" : "s"} given
        </span>
      </div>

      {data.above ? (
        <div className="mt-3 rounded-xl bg-white/5 p-3">
          <p className="text-sm text-white/70">
            Next up:{" "}
            <span className="font-semibold text-white">{data.above.name}</span>{" "}
            <span className="tabular-nums text-white/50">
              ({data.above.score})
            </span>
          </p>
          <p className="mt-1 text-sm text-purple-200">{data.suggestion}</p>
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/5 p-3 text-sm text-yellow-200">
          <Crown className="h-4 w-4" />
          {data.suggestion}
        </div>
      )}
    </div>
  );
}
