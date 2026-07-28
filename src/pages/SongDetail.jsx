// src/pages/SongDetail.jsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowLeft,
  Play,
  Users,
  Clock,
  Headphones,
  Music,
  TrendingUp,
  Trophy,
  Radio,
  User,
  X,
  ChevronRight,
} from "lucide-react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { formatDistanceToNow } from "date-fns";
import axios from "axios";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
);

const API_URL = import.meta.env.VITE_API_URL;
const POLL_MS = 5000;

// Rolls the displayed integer from its previous value to the new one, like a
// live counter. Snaps instantly under reduced-motion.
function AnimatedNumber({ value, className = "" }) {
  const reduce = useReducedMotion();
  const spring = useSpring(value || 0, { stiffness: 90, damping: 18 });
  const text = useTransform(spring, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    if (reduce) spring.jump(value || 0);
    else spring.set(value || 0);
  }, [value, reduce, spring]);
  return (
    <motion.span className={`tabular-nums ${className}`}>{text}</motion.span>
  );
}

const timeAgo = (date) => {
  if (!date) return "never";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "never";
  return formatDistanceToNow(d, { addSuffix: true });
};

const RANK_WINDOWS = [
  { key: "all", label: "Overall" },
  { key: "month", label: "This month" },
  { key: "week", label: "This week" },
  { key: "day", label: "Today" },
  { key: "hour", label: "This hour" },
];

export default function SongDetail() {
  const { videoId } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const pollRef = useRef(null);

  // Top-artists leaderboard popup (opened from a ranking window)
  const [rankModal, setRankModal] = useState(null); // { key, label }
  const [rankArtists, setRankArtists] = useState([]);
  const [rankLoading, setRankLoading] = useState(false);

  const openRankModal = async (key, label) => {
    setRankModal({ key, label });
    setRankLoading(true);
    setRankArtists([]);
    try {
      const res = await axios.get(`${API_URL}/top-artists?window=${key}`);
      setRankArtists(res.data.artists || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRankLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/song/${videoId}/stats`);
        if (alive) {
          setData(res.data);
          setNotFound(false);
        }
      } catch (err) {
        if (alive && err.response?.status === 404) setNotFound(true);
        else console.error(err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    pollRef.current = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(pollRef.current);
    };
  }, [videoId]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#070312] flex items-center justify-center text-white/50">
        Loading song…
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#070312] flex flex-col items-center justify-center text-white gap-3">
        <h1 className="text-2xl font-black tracking-tight">Song not found</h1>
        <Link to="/dashboard" className="text-violet-300 hover:text-violet-200">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const { song, plays, listeners, total_minutes, last_listened, daily, forecast, rankings } =
    data;

  return (
    <div className="min-h-screen bg-[#070312] text-white">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          {song.thumbnail && (
            <img
              src={song.thumbnail}
              className="w-full h-full object-cover opacity-25 blur-3xl scale-125"
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
              className="shrink-0"
            >
              {song.thumbnail ? (
                <img
                  src={song.thumbnail}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover ring-1 ring-white/15 shadow-2xl shadow-violet-900/50"
                />
              ) : (
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl">
                  <Music className="w-14 h-14 text-white/80" />
                </div>
              )}
            </motion.div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="text-[11px] uppercase tracking-[0.25em] text-violet-300/70">
                  Song
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none mb-3 break-words">
                {song.title}
              </h1>
              {song.artist_id ? (
                <Link
                  to={`/artist/${song.artist_id}`}
                  className="inline-flex items-center gap-1.5 text-white/70 hover:text-violet-300 transition-colors"
                >
                  <Music className="w-4 h-4" />
                  {song.artist_name || "Unknown artist"}
                </Link>
              ) : (
                <span className="text-white/50">{song.artist_name || ""}</span>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="max-w-6xl mx-auto px-5 pb-16 space-y-5">
        {/* Headline stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile icon={Play} label="Plays" accent="violet">
            <AnimatedNumber value={plays} />
          </StatTile>
          <StatTile icon={Users} label="Listeners" accent="fuchsia">
            <AnimatedNumber value={listeners} />
          </StatTile>
          <StatTile icon={Headphones} label="Minutes" accent="sky">
            <AnimatedNumber value={total_minutes} />
          </StatTile>
          <StatTile icon={Clock} label="Last listened" accent="emerald" small>
            {timeAgo(last_listened)}
          </StatTile>
        </div>

        {/* Trend + forecast */}
        <Panel title="Listening trend & forecast" icon={TrendingUp}>
          {daily.length === 0 ? (
            <Empty>Not enough listening history yet to chart.</Empty>
          ) : (
            <>
              <div className="h-56 w-full">
                <TrendChart daily={daily} forecast={forecast} />
              </div>
              <p className="mt-2 text-[11px] text-white/40">
                Solid = last 30 days · dashed = projected next {forecast.length}{" "}
                days
              </p>
            </>
          )}
        </Panel>

        {/* Rankings */}
        <Panel title="Popularity ranking" icon={Trophy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {RANK_WINDOWS.map(({ key, label }) => {
              const r = rankings[key] || { rank: null, total: 0, plays: 0 };
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => openRankModal(key, label)}
                  title={`Top 10 artists — ${label}`}
                  className="group rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center transition-colors hover:border-violet-400/40 hover:bg-white/[0.06]"
                >
                  <p className="text-[11px] uppercase tracking-[0.2em] text-violet-300/70 mb-2">
                    {label}
                  </p>
                  {r.rank ? (
                    <p className="text-3xl font-black tracking-tight leading-none">
                      <span className="text-white/40 text-xl align-top">#</span>
                      <AnimatedNumber value={r.rank} />
                    </p>
                  ) : (
                    <p className="text-3xl font-black tracking-tight leading-none text-white/25">
                      —
                    </p>
                  )}
                  <p className="text-[11px] text-white/40 mt-1.5">
                    {r.rank ? `of ${r.total.toLocaleString()}` : "unranked"}
                  </p>
                  <p className="text-[11px] text-white/30 mt-0.5">
                    <AnimatedNumber value={r.plays} className="text-white/50" />{" "}
                    {r.plays === 1 ? "play" : "plays"}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-300/60 group-hover:text-violet-300 transition-colors">
                    View top 10
                    <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/40">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Updating live every {POLL_MS / 1000}s · tap a window for the top 10
          </p>
        </Panel>
      </div>

      {/* ===== Top-artists leaderboard popup ===== */}
      <AnimatePresence>
        {rankModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setRankModal(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md max-h-[80vh] bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-violet-300/70">
                    Top artists
                  </p>
                  <p className="text-sm font-semibold">{rankModal.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRankModal(null)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 overflow-y-auto">
                {rankLoading ? (
                  <p className="text-sm text-white/40 py-6 text-center">Loading…</p>
                ) : rankArtists.length === 0 ? (
                  <Empty>No artists yet for this window.</Empty>
                ) : (
                  <div className="space-y-2">
                    {rankArtists.map((a, i) => (
                      <motion.div
                        key={a.artist_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3"
                      >
                        <span className="w-6 text-center text-sm font-bold tabular-nums text-white/40">
                          {i + 1}
                        </span>
                        {a.image_url ? (
                          <img
                            src={a.image_url}
                            className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-500/30 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-white/80" />
                          </div>
                        )}
                        <Link
                          to={`/artist/${a.artist_id}`}
                          onClick={() => setRankModal(null)}
                          className="flex-1 min-w-0 text-sm font-medium truncate hover:text-violet-300 transition-colors"
                        >
                          {a.artist_name}
                        </Link>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums">
                            {a.plays.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-white/40">
                            {a.plays === 1 ? "play" : "plays"}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- chart ---------------- */

function TrendChart({ daily, forecast }) {
  const labels = [
    ...daily.map((d) => d.date.slice(5)),
    ...forecast.map((d) => d.date.slice(5)),
  ];
  const histData = [
    ...daily.map((d) => d.listens),
    ...forecast.map(() => null),
  ];
  // Forecast line starts at the last real point so it connects seamlessly.
  const foreData = labels.map((_, i) => {
    if (daily.length && i === daily.length - 1) return daily[daily.length - 1].listens;
    if (i >= daily.length) return forecast[i - daily.length].listens;
    return null;
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Listens / day",
        data: histData,
        borderColor: "#a855f7",
        backgroundColor: "rgba(168,85,247,0.15)",
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        spanGaps: false,
      },
      {
        label: "Projected",
        data: foreData,
        borderColor: "#e879f9",
        borderDash: [5, 5],
        fill: false,
        tension: 0.3,
        pointRadius: 0,
        spanGaps: false,
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: { color: "#ccc", precision: 0 },
        grid: { color: "rgba(255,255,255,0.1)" },
      },
      x: {
        ticks: { color: "#ccc", maxTicksLimit: 8 },
        grid: { display: false },
      },
    },
    plugins: {
      legend: { display: true, labels: { color: "#ccc", boxWidth: 12 } },
    },
  };
  return <Line data={data} options={options} />;
}

/* ---------------- building blocks ---------------- */

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
  sky: "text-sky-300",
};

function StatTile({ icon: Icon, label, accent = "violet", small = false, children }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${ACCENTS[accent] || ACCENTS.violet}`} />
      <p
        className={`font-black tracking-tight leading-none ${
          small ? "text-base" : "text-2xl"
        }`}
      >
        {children}
      </p>
      <p className="text-[11px] text-white/50 mt-1.5">{label}</p>
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-white/40 py-6 text-center">{children}</p>;
}
