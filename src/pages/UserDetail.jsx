// src/pages/UserDetail.jsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User,
  Music,
  Headphones,
  Users,
  Trophy,
  ThumbsUp,
  Flame,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  Vote,
  Radio,
} from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

// Format a duration in seconds as "1h 23m 45s" (omitting empty leading units).
const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec || parts.length === 0) parts.push(`${sec}s`);
  return parts.join(" ");
};

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await axios.get(`${API_URL}/user/${userId}`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070312] flex items-center justify-center text-white/50">
        Loading profile…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#070312] flex flex-col items-center justify-center text-white gap-3">
        <h1 className="text-2xl font-black tracking-tight">User not found</h1>
        <Link to="/dashboard" className="text-violet-300 hover:text-violet-200">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { user, top_songs, top_co_listeners, session_count, stats } = data;
  const activeSession = user.active_session;
  const maxSong = Math.max(...top_songs.map((s) => s.total_seconds || 0), 1);

  return (
    <div className="min-h-screen bg-[#070312] text-white">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {user.image_url && (
            <img
              src={user.image_url}
              className="w-full h-full object-cover opacity-20 blur-3xl scale-125"
              alt=""
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-violet-900/30 via-[#070312]/85 to-[#070312]" />
        </div>

        <div className="max-w-6xl mx-auto px-5 pt-6 pb-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-end gap-5"
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 200, damping: 20 }}
              className="relative shrink-0"
            >
              {user.image_url ? (
                <img
                  src={user.image_url}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover ring-1 ring-white/15 shadow-2xl shadow-violet-900/50"
                />
              ) : (
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl">
                  <User className="w-14 h-14 text-white/80" />
                </div>
              )}
              {user.is_live_host && (
                <span className="absolute -bottom-2 -right-2 flex items-center gap-1 bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-lg ring-2 ring-[#070312]">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              )}
            </motion.div>

            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.25em] text-violet-300/70 mb-1.5">
                Listener
              </p>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none mb-4 break-words">
                {user.username}
              </h1>
              <div className="flex flex-wrap gap-2">
                <HeroStat
                  icon={Headphones}
                  label="listened"
                  value={formatDuration(user.total_listen_seconds)}
                />
                <HeroStat
                  icon={Music}
                  label="songs"
                  value={stats.totalSongsHeard || 0}
                />
                <HeroStat icon={Users} label="sessions" value={session_count} />
              </div>

              {activeSession && (
                <Link
                  to={activeSession.join_url || "#"}
                  className={`mt-4 inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    activeSession.is_private
                      ? "bg-white/5 text-white/50 border border-white/10 cursor-default"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                  }`}
                >
                  <Radio className="w-4 h-4" />
                  {activeSession.is_private
                    ? "In a private room"
                    : `Live now — join ${activeSession.name || "the room"}`}
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="max-w-6xl mx-auto px-5 pb-16 space-y-5">
        {/* Highlight tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile
            icon={Trophy}
            value={stats.winsOfOwnSuggestions || 0}
            label="Song wins"
            accent="amber"
          />
          <StatTile
            icon={Flame}
            value={stats.maxWinStreakOwn || 0}
            label="Best streak"
            accent="fuchsia"
          />
          <StatTile
            icon={ThumbsUp}
            value={stats.votesOnOwnSuggestions || 0}
            label="Votes on own"
            accent="violet"
          />
          <StatTile
            icon={Vote}
            value={
              (stats.votesOnOthersAndWon || 0) +
              (stats.votesOnOthersAndLost || 0)
            }
            label="Total votes"
            accent="sky"
          />
        </div>

        {/* Top songs + co-listeners */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Panel title="Top songs" icon={Music}>
            {top_songs.length === 0 ? (
              <Empty>No songs listened yet.</Empty>
            ) : (
              <div className="space-y-1.5">
                {top_songs.map((song, i) => (
                  <motion.div
                    key={song.video_id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={`/song/${song.video_id}`}
                      className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="w-6 text-center text-sm font-bold text-white/30 group-hover:text-violet-300 transition-colors">
                        {i + 1}
                      </span>
                      <img
                        src={song.thumbnail}
                        alt=""
                        className="w-11 h-11 rounded-lg object-cover shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-violet-100 transition-colors">
                          {song.title}
                        </p>
                        <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                            style={{
                              width: `${Math.max(
                                6,
                                ((song.total_seconds || 0) / maxSong) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-white/50 shrink-0 tabular-nums">
                        {formatDuration(song.total_seconds)}
                      </span>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Listens with" icon={Users}>
            {top_co_listeners.length === 0 ? (
              <Empty>No shared sessions yet.</Empty>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {top_co_listeners.map((u, i) => (
                  <motion.div
                    key={u.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -3 }}
                  >
                    <Link
                      to={`/user/${u.id}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-violet-400/40 transition-colors"
                    >
                      {u.image_url ? (
                        <img
                          src={u.image_url}
                          className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-500/30 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-white/80" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {u.username}
                        </p>
                        <p className="text-[11px] text-white/40 truncate">
                          {formatDuration(u.total_seconds)} together
                        </p>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        {/* Voting highlights */}
        <Panel title="Voting highlights" icon={Vote}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatTile
              icon={TrendingUp}
              value={stats.votesOnOthersAndWon || 0}
              label="Backed a winner"
              accent="emerald"
            />
            <StatTile
              icon={TrendingDown}
              value={stats.votesOnOthersAndLost || 0}
              label="Backed a loser"
              accent="rose"
            />
            <StatTile
              icon={ThumbsUp}
              value={stats.votesOnOwnSuggestions || 0}
              label="Votes on own"
              accent="violet"
            />
            <StatTile
              icon={Eye}
              value={stats.sessionsWithoutAnyVote || 0}
              label="Sessions, no vote"
              accent="sky"
            />
            <StatTile
              icon={Zap}
              value={stats.ownSuggestionsLost || 0}
              label="Own songs lost"
              accent="amber"
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- small building blocks ---------------- */

function HeroStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
      <Icon className="w-3.5 h-3.5 text-violet-300" />
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
          {title}
        </h2>
      </div>
      {children}
    </motion.section>
  );
}

const ACCENTS = {
  violet: "text-violet-300",
  fuchsia: "text-fuchsia-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  rose: "text-rose-300",
  sky: "text-sky-300",
};

function StatTile({ icon: Icon, value, label, accent = "violet" }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${ACCENTS[accent] || ACCENTS.violet}`} />
      <p className="text-2xl font-black tracking-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-white/50 mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-white/40 py-4 text-center">{children}</p>;
}
