// Live anonymous home-page poll (#44). Self-contained: fetches the active poll,
// lets anyone vote once (localStorage guard + server UNIQUE), and updates result
// bars live via the global `poll_results` socket broadcast.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_URL || "https://api.tunevote.com"
).replace(/\/+$/, "");

// Stable anonymous id so a guest can't vote twice from the same browser.
function anonId() {
  let id = localStorage.getItem("pollAnonId");
  if (!id) {
    id =
      (crypto?.randomUUID && crypto.randomUUID()) ||
      `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem("pollAnonId", id);
  }
  return id;
}

function authHeaders() {
  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  if (token) return { Authorization: `Bearer ${token}` };
  if (guestToken) return { "x-guest-token": guestToken };
  return {};
}

export default function HomePoll() {
  const [poll, setPoll] = useState(null);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API_BASE}/polls/active`)
      .then((res) => {
        if (cancelled || !res.data) return;
        setPoll(res.data);
        setVoted(!!localStorage.getItem(`poll_voted_${res.data.id}`));
      })
      .catch((err) => console.error("poll load failed:", err));

    const socket = io(`${API_BASE}/`);
    socket.on("poll_results", (data) => {
      setPoll((prev) =>
        prev && prev.id === data.pollId ? { ...prev, ...data } : prev
      );
    });
    return () => {
      cancelled = true;
      socket.disconnect();
    };
  }, []);

  const vote = async (optionId) => {
    if (!poll || voted) return;
    setVoted(true); // optimistic
    localStorage.setItem(`poll_voted_${poll.id}`, "1");
    try {
      const res = await axios.post(
        `${API_BASE}/polls/${poll.id}/vote`,
        { optionId, voterKey: anonId() },
        { headers: authHeaders() }
      );
      setPoll((prev) => ({ ...prev, ...res.data }));
    } catch (err) {
      // 409 = already voted (keep the voted state); other errors revert.
      if (err.response?.status !== 409) {
        setVoted(false);
        localStorage.removeItem(`poll_voted_${poll.id}`);
      }
      console.error("poll vote failed:", err);
    }
  };

  if (!poll) return null;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white/90">
        <BarChart3 className="h-4 w-4 text-purple-300" />
        {poll.question}
      </h3>

      <div className="space-y-2">
        {poll.options.map((o) =>
          voted ? (
            <div key={o.id} className="relative">
              <div className="flex justify-between px-3 py-2 text-sm">
                <span className="relative z-10 text-white/90">{o.label}</span>
                <span className="relative z-10 tabular-nums text-white/60">
                  {o.pct}%
                </span>
              </div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${o.pct}%` }}
                transition={{ duration: 0.5 }}
                className="absolute inset-y-0 left-0 rounded-lg bg-gradient-to-r from-purple-500/40 to-pink-500/40"
              />
              <div className="absolute inset-0 rounded-lg border border-white/10" />
            </div>
          ) : (
            <button
              key={o.id}
              onClick={() => vote(o.id)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm text-white/90 transition-colors hover:border-purple-400/40 hover:bg-purple-500/15"
            >
              {o.label}
            </button>
          )
        )}
      </div>

      <p className="mt-3 text-right text-xs text-white/40">
        {poll.total} {poll.total === 1 ? "vote" : "votes"}
      </p>
    </div>
  );
}
