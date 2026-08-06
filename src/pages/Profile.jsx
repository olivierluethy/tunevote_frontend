// src/pages/Profile.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Save,
  ArrowLeft,
  Trophy,
  ThumbsUp,
  Flame,
  Vote,
  Eye,
  TrendingUp,
  TrendingDown,
  Zap,
  Headphones,
  Music,
  Users,
  Repeat,
  Clock,
  Camera,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  Settings,
  BarChart3,
  History,
  Star,
  Edit3,
  Lock,
  CheckCircle,
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Link2,
  Copy,
  ClipboardPaste,
  Wand2,
  EyeOff,
  Send,
  Upload,
} from "lucide-react";
import axios from "axios";
import { Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import {
  format,
  formatDistanceToNow,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from "date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Human-friendly "last listened" text, e.g. "3 days ago". null if never.
const formatLastListened = (val) => {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return formatDistanceToNow(d, { addSuffix: true });
};

// A DATE/DATETIME value from the API can arrive as "2026-07-28" or a full ISO
// string. Reduce both to the YYYY-MM-DD day key for matching/grouping.
const dayKey = (val) => String(val).slice(0, 10);

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

// Rate a password 0–4 with a label/colour for the strength meter.
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: "", barColor: "", textColor: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(score, 4);
  const labels = ["Very weak", "Weak", "Medium", "Strong", "Very strong"];
  const barColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
  ];
  const textColors = [
    "text-red-400",
    "text-orange-400",
    "text-yellow-400",
    "text-lime-400",
    "text-green-400",
  ];
  return {
    score,
    label: labels[score],
    barColor: barColors[score],
    textColor: textColors[score],
  };
}

// Cryptographically-random password using an unambiguous character set.
function generateStrongPassword(length = 16) {
  const chars =
    "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[arr[i] % chars.length];
  return out;
}

/* ---------- small presentational building blocks ---------- */

function HeroStat({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
      <Icon className="w-3.5 h-3.5 text-violet-300" />
      <span className="text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

function Panel({ title, icon: Icon, badge, className = "", children }) {
  return (
    <section
      className={`rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2 mb-3">
          {Icon && <Icon className="w-4 h-4 text-violet-400" />}
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
            {title}
          </h2>
          {badge != null && (
            <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
              {badge}
            </span>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

function StatTile({ icon: Icon, value, label, accent = "text-violet-300" }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon className={`w-4 h-4 ${accent}`} />}
      </div>
      <p className="text-xl font-black tracking-tight tabular-nums leading-none">
        {value}
      </p>
      <p className="text-white/40 text-[11px] mt-1">{label}</p>
    </div>
  );
}

function Empty({ children }) {
  return <p className="text-sm text-white/40 py-6 text-center">{children}</p>;
}

export default function Profile() {
  const [userData, setUserData] = useState({
    username: "",
    email: "",
    profileImage: null,
  });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [topSongs, setTopSongs] = useState([]);
  const [recentListens, setRecentListens] = useState([]);
  const [maxSongSeconds, setMaxSongSeconds] = useState(1);

  const [listeningStats, setListeningStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);

  const [artistModalOpen, setArtistModalOpen] = useState(false);
  const [activeArtist, setActiveArtist] = useState(null);
  const [artistInsights, setArtistInsights] = useState(null);
  const [artistLoading, setArtistLoading] = useState(false);

  // Voting-activity chart + listening calendar
  const [votingActivity, setVotingActivity] = useState(null);
  const [calendarListens, setCalendarListens] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Per-artist calendar (inside the artist modal)
  const [artistCalMonth, setArtistCalMonth] = useState(new Date());
  const [artistSelectedDay, setArtistSelectedDay] = useState(null);

  // Auth: OAuth-only users (Google/Facebook) have no password to change.
  const [hasPassword, setHasPassword] = useState(true);

  // Profile image via URL
  const [imageSourceUrl, setImageSourceUrl] = useState(null);
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [imageUrlPreviewError, setImageUrlPreviewError] = useState(false);
  const [imageUrlSaving, setImageUrlSaving] = useState(false);

  // Password strength / generator / email-a-new-password
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [emailPwSending, setEmailPwSending] = useState(false);
  // Inline banner shown after "email me the new password" (replaces alert()).
  const [emailPwNotice, setEmailPwNotice] = useState("");

  // Navigation: active tab + the single "edit picture" modal
  const [tab, setTab] = useState("overview");
  const [pictureModalOpen, setPictureModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const syncUserToLocalStorage = (username, email) => {
    if (username) localStorage.setItem("username", username);
    if (email) localStorage.setItem("email", email);
    localStorage.setItem("user", JSON.stringify({ username, email }));
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`,
  });

  const ListeningTrendChart = ({
    dailyListens,
    dailySessions,
    maxDailySeconds,
  }) => {
    const today = new Date();
    const labels = [];
    const dataPoints = [];

    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];

      labels.push(dateStr.slice(5));

      const dayData = dailyListens.find((d) => d.date === dateStr);
      dataPoints.push(dayData ? dayData.seconds / 60 : 0);
    }

    const chartData = {
      labels,
      datasets: [
        {
          label: "Listening time per day (minutes)",
          data: dataPoints,
          borderColor: "#a855f7",
          backgroundColor: "rgba(168, 85, 247, 0.3)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: "#a855f7",
          pointBorderColor: "#fff",
          pointHoverRadius: 6,
        },
        {
          label: "Maximum possible listening time",
          data: Array(30).fill(maxDailySeconds / 60),
          borderColor: "rgba(255,255,255,0.2)",
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    };

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: Math.ceil((maxDailySeconds / 60) * 1.1),
          title: { display: true, text: "minutes", color: "#fff" },
          ticks: { color: "#ccc" },
          grid: { color: "rgba(255,255,255,0.1)" },
        },
        x: {
          title: { display: true, text: "Date", color: "#fff" },
          ticks: { color: "#ccc" },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => {
              const labelStr = context.label;
              const minutes = context.parsed.y;

              const dayEntry = dailySessions.find(
                (d) => d.date.slice(5) === labelStr
              );
              const sessions = dayEntry?.sessions || [];

              if (sessions.length === 0) {
                return `No sessions on this day`;
              }

              const sessionLines = sessions.map(
                (s) =>
                  `${s.title || "Untitled session"} • ${s.minutes} min • ${new Date(s.started_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              );

              return [`${minutes} Total minutes`, ...sessionLines];
            },
          },
        },
      },
    };

    return (
      <div className="h-48 w-full">
        <Line data={chartData} options={options} />
      </div>
    );
  };

  // Bar (votes) + area (songs heard) over the last 30 days — shows when you
  // voted vs. when you only listened.
  const VotingActivityChart = ({ votesByDay = [], listensByDay = [] }) => {
    const today = new Date();
    const labels = [];
    const votes = [];
    const listens = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().split("T")[0];
      labels.push(key.slice(5));
      const v = votesByDay.find((x) => dayKey(x.date) === key);
      votes.push(v ? Number(v.votes) : 0);
      const l = listensByDay.find((x) => dayKey(x.date) === key);
      listens.push(l ? Number(l.listens) : 0);
    }
    const data = {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Votes cast",
          data: votes,
          backgroundColor: "rgba(236, 72, 153, 0.7)",
          borderRadius: 3,
          order: 2,
        },
        {
          type: "line",
          label: "Songs heard",
          data: listens,
          borderColor: "#a855f7",
          backgroundColor: "rgba(168,85,247,0.15)",
          tension: 0.3,
          pointRadius: 0,
          fill: true,
          order: 1,
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
        tooltip: { callbacks: { title: (items) => items[0].label } },
      },
    };
    return (
      <div className="h-48 w-full">
        <Bar data={data} options={options} />
      </div>
    );
  };

  // Month calendar of listening history; click a day to see what you heard.
  const ListenCalendar = () => {
    const byDay = {};
    for (const l of calendarListens) {
      const k = format(new Date(l.listened_from), "yyyy-MM-dd");
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(l);
    }
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const maxDaySeconds = Math.max(
      1,
      ...Object.values(byDay).map((list) =>
        list.reduce((a, b) => a + (b.listen_seconds || 0), 0)
      )
    );
    const selectedKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
    const selectedList = selectedKey ? byDay[selectedKey] || [] : [];
    const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

    return (
      <div className="space-y-2 max-w-[18rem] mx-auto">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Previous year"
              onClick={() => {
                setCalendarMonth(subMonths(calendarMonth, 12));
                setSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Previous month"
              onClick={() => {
                setCalendarMonth(subMonths(calendarMonth, 1));
                setSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs font-medium">
            {format(calendarMonth, "MMMM yyyy")}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Next month"
              onClick={() => {
                setCalendarMonth(addMonths(calendarMonth, 1));
                setSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Next year"
              onClick={() => {
                setCalendarMonth(addMonths(calendarMonth, 12));
                setSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <div key={w} className="text-[9px] text-white/30 py-0.5">
              {w}
            </div>
          ))}
          {days.map((day) => {
            const k = format(day, "yyyy-MM-dd");
            const list = byDay[k] || [];
            const secs = list.reduce((a, b) => a + (b.listen_seconds || 0), 0);
            const inMonth = isSameMonth(day, calendarMonth);
            const isSel = selectedDay && isSameDay(day, selectedDay);
            const intensity = secs > 0 ? 0.15 + 0.55 * (secs / maxDaySeconds) : 0;
            return (
              <button
                key={k}
                disabled={!list.length}
                onClick={() => setSelectedDay(isSel ? null : day)}
                className={`h-7 rounded-md text-[10px] flex items-center justify-center relative border ${
                  isSel ? "border-violet-400" : "border-transparent"
                } ${inMonth ? "text-white/80" : "text-white/20"} ${
                  list.length
                    ? "hover:border-violet-400/50 cursor-pointer"
                    : "cursor-default"
                }`}
                style={
                  secs > 0
                    ? { backgroundColor: `rgba(168,85,247,${intensity})` }
                    : undefined
                }
              >
                {format(day, "d")}
                {list.length > 0 && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-fuchsia-400" />
                )}
              </button>
            );
          })}
        </div>
        {/* Day detail as a popup modal (not inline) */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
              onClick={() => setSelectedDay(null)}
            >
              <motion.div
                initial={{ y: "100%", opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0.6 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="w-full max-w-sm max-h-[75vh] bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div>
                    <p className="text-sm font-semibold">
                      {format(selectedDay, "EEEE, d MMMM yyyy")}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {selectedList.length}{" "}
                      {selectedList.length === 1 ? "song" : "songs"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto">
                  {selectedList.length === 0 ? (
                    <p className="text-xs text-white/40">
                      Nothing listened on this day.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedList.map((l, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <img
                            src={l.thumbnail}
                            alt=""
                            className="w-9 h-9 rounded-lg object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{l.title}</p>
                            <p className="text-[10px] text-white/40">
                              {new Date(l.listened_from).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <span className="text-[10px] text-white/40 shrink-0">
                            {Math.max(1, Math.floor((l.listen_seconds || 0) / 60))}m
                          </span>
                        </div>
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
  };

  // Compact calendar of when the user listened to a specific artist; clicking a
  // day pops up the times + songs of that artist on that day.
  const ArtistListenCalendar = ({ events = [] }) => {
    const byDay = {};
    for (const e of events) {
      const k = format(new Date(e.listened_from), "yyyy-MM-dd");
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push(e);
    }
    const monthStart = startOfMonth(artistCalMonth);
    const monthEnd = endOfMonth(artistCalMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const maxDaySeconds = Math.max(
      1,
      ...Object.values(byDay).map((list) =>
        list.reduce((a, b) => a + (b.listen_seconds || 0), 0)
      )
    );
    const selKey = artistSelectedDay
      ? format(artistSelectedDay, "yyyy-MM-dd")
      : null;
    const selList = selKey ? byDay[selKey] || [] : [];
    const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

    return (
      <div className="space-y-2 max-w-[18rem] mx-auto">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Previous year"
              onClick={() => {
                setArtistCalMonth(subMonths(artistCalMonth, 12));
                setArtistSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Previous month"
              onClick={() => {
                setArtistCalMonth(subMonths(artistCalMonth, 1));
                setArtistSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs font-medium">
            {format(artistCalMonth, "MMMM yyyy")}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Next month"
              onClick={() => {
                setArtistCalMonth(addMonths(artistCalMonth, 1));
                setArtistSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              title="Next year"
              onClick={() => {
                setArtistCalMonth(addMonths(artistCalMonth, 12));
                setArtistSelectedDay(null);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdays.map((w) => (
            <div key={w} className="text-[9px] text-white/30 py-0.5">
              {w}
            </div>
          ))}
          {days.map((day) => {
            const k = format(day, "yyyy-MM-dd");
            const list = byDay[k] || [];
            const secs = list.reduce((a, b) => a + (b.listen_seconds || 0), 0);
            const inMonth = isSameMonth(day, artistCalMonth);
            const isSel = artistSelectedDay && isSameDay(day, artistSelectedDay);
            const intensity = secs > 0 ? 0.15 + 0.55 * (secs / maxDaySeconds) : 0;
            return (
              <button
                key={k}
                disabled={!list.length}
                onClick={() => setArtistSelectedDay(isSel ? null : day)}
                className={`h-7 rounded-md text-[10px] flex items-center justify-center relative border ${
                  isSel ? "border-violet-400" : "border-transparent"
                } ${inMonth ? "text-white/80" : "text-white/20"} ${
                  list.length
                    ? "hover:border-violet-400/50 cursor-pointer"
                    : "cursor-default"
                }`}
                style={
                  secs > 0
                    ? { backgroundColor: `rgba(168,85,247,${intensity})` }
                    : undefined
                }
              >
                {format(day, "d")}
                {list.length > 0 && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-fuchsia-400" />
                )}
              </button>
            );
          })}
        </div>
        {events.length === 0 && (
          <p className="text-[11px] text-white/40 text-center">
            No listens of this artist in the last 90 days.
          </p>
        )}

        {/* Nested day popup: times + songs of this artist that day */}
        <AnimatePresence>
          {artistSelectedDay && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
              onClick={() => setArtistSelectedDay(null)}
            >
              <motion.div
                initial={{ y: "100%", opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "100%", opacity: 0.6 }}
                transition={{ type: "spring", damping: 26, stiffness: 320 }}
                className="w-full max-w-sm max-h-[70vh] bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div>
                    <p className="text-sm font-semibold">{activeArtist?.name}</p>
                    <p className="text-[11px] text-white/40">
                      {format(artistSelectedDay, "EEEE, d MMMM yyyy")} —{" "}
                      {selList.length} {selList.length === 1 ? "play" : "plays"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArtistSelectedDay(null)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto">
                  {selList.length === 0 ? (
                    <p className="text-xs text-white/40">Nothing on this day.</p>
                  ) : (
                    <div className="space-y-2">
                      {selList
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(a.listened_from) - new Date(b.listened_from)
                        )
                        .map((e, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-12 shrink-0 text-[11px] text-white/50">
                              {new Date(e.listened_from).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <p className="flex-1 min-w-0 text-sm truncate">
                              {e.title}
                            </p>
                            <span className="text-[10px] text-white/40 shrink-0">
                              {Math.max(1, Math.floor((e.listen_seconds || 0) / 60))}m
                            </span>
                          </div>
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
  };

  const openArtistModal = async (artist) => {
    setActiveArtist(artist);
    setArtistModalOpen(true);
    setArtistInsights(null);
    setArtistLoading(true);
    setArtistCalMonth(new Date());
    setArtistSelectedDay(null);

    try {
      const res = await api.get(
        `/profile/artist/${artist.artist_id}/insights`,
        { headers: getAuthHeaders() }
      );
      setArtistInsights(res.data);
    } catch (err) {
      console.error("Artist insights load failed", err);
    } finally {
      setArtistLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!token) {
        navigate("/login");
        return;
      }

      try {
        // The profile call is essential (identity); the stat calls are
        // optional — a single failing stat endpoint must not blank the page.
        const [
          profileR,
          statsR,
          listeningR,
          recentR,
          votingR,
          calendarR,
        ] = await Promise.allSettled([
          api.get("/profile", { headers: getAuthHeaders() }),
          api.get("/profile/user-stats", { headers: getAuthHeaders() }),
          api.get("/profile/listening-summary", {
            headers: getAuthHeaders(),
          }),
          api.get("/profile/recent-listens", { headers: getAuthHeaders() }),
          api.get("/profile/voting-activity", { headers: getAuthHeaders() }),
          api.get("/profile/listen-calendar", { headers: getAuthHeaders() }),
        ]);

        if (profileR.status === "rejected") throw profileR.reason;
        const profileRes = profileR.value;

        // Log any stat failures but keep rendering with empty defaults.
        for (const r of [statsR, listeningR, recentR, votingR, calendarR]) {
          if (r.status === "rejected") console.error("Stat load failed:", r.reason);
        }
        const listeningData = listeningR.status === "fulfilled"
          ? listeningR.value.data
          : { stats: null, topSongs: [], topArtists: [] };

        setListeningStats(listeningData.stats);
        setVotingActivity(votingR.status === "fulfilled" ? votingR.value.data : null);
        setCalendarListens(
          calendarR.status === "fulfilled" ? calendarR.value.data.listens || [] : []
        );

        const topSongsData = listeningData.topSongs || [];
        setTopSongs(topSongsData);
        setMaxSongSeconds(
          Math.max(...topSongsData.map((s) => s.total_seconds), 1)
        );
        setRecentListens(
          recentR.status === "fulfilled" ? recentR.value.data.recentListens : []
        );
        setTopArtists(listeningData.topArtists || []);

        const {
          username = "",
          email = "",
          imageType,
          imageData,
          imageSourceUrl: srcUrl = null,
          hasPassword: hasPw = true,
        } = profileRes.data;
        setImageSourceUrl(srcUrl);
        setHasPassword(hasPw);
        setUserData((prev) => ({
          ...prev,
          username,
          email,
          profileImage:
            imageData && imageType
              ? `data:${imageType};base64,${imageData}`
              : prev.profileImage,
        }));

        setStats(statsR.status === "fulfilled" ? statsR.value.data : null);

        syncUserToLocalStorage(username, email);
      } catch (err) {
        console.error("Error loading data:", err);
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          localStorage.clear();
          navigate("/login");
          return;
        }
        setError("Could not load profile or statistics – please try again later");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, navigate]);

  // Shared upload path for both the file picker and drag & drop.
  const uploadImageFile = async (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be max 5 MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Only image files allowed");
      return;
    }

    const formData = new FormData();
    formData.append("profileImage", file);

    try {
      setError("");
      const res = await api.post("/profile/image", formData, {
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "multipart/form-data",
        },
      });

      const { imageType, imageData } = res.data;
      const newImageUrl = `data:${imageType};base64,${imageData}`;
      setUserData((prev) => ({ ...prev, profileImage: newImageUrl }));
      setImageSourceUrl(null); // an uploaded file has no source URL
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err.response?.data?.error || "Image could not be uploaded");
    }
  };

  const handleImageUpload = (e) => uploadImageFile(e.target.files[0]);

  const handleImageDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadImageFile(file);
  };

  // One-click paste of an image link from the clipboard.
  const handlePasteImageUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setImageUrlInput(text.trim());
        setImageUrlPreviewError(false);
      }
    } catch {
      setError("Couldn't read the clipboard — paste the link manually.");
    }
  };

  // Set the profile picture from a pasted image URL (no file upload needed).
  const handleImageUrlSave = async () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    try {
      setImageUrlSaving(true);
      setError("");
      const res = await api.post(
        "/profile/image-url",
        { url },
        { headers: getAuthHeaders() }
      );
      const { imageType, imageData, imageSourceUrl: srcUrl } = res.data;
      setUserData((prev) => ({
        ...prev,
        profileImage: `data:${imageType};base64,${imageData}`,
      }));
      setImageSourceUrl(srcUrl || url);
      setImageUrlInput("");
      setImageUrlPreviewError(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error setting image from URL:", err);
      setError(
        err.response?.data?.error || "Image could not be loaded from that URL"
      );
    } finally {
      setImageUrlSaving(false);
    }
  };

  // Generate a new password server-side and email it to the user.
  const handleEmailNewPassword = async () => {
    if (
      !confirm(
        "This will change your password and email the new one to you. Continue?"
      )
    ) {
      return;
    }
    try {
      setEmailPwSending(true);
      setError("");
      const res = await api.post(
        "/profile/email-new-password",
        {},
        { headers: getAuthHeaders() }
      );
      setError("");
      setEmailPwNotice(
        res.data?.message ||
          "A new password has been sent to your email address."
      );
      setTimeout(() => setEmailPwNotice(""), 6000);
    } catch (err) {
      console.error("Error emailing new password:", err);
      setError(
        err.response?.data?.error || "New password could not be sent by email"
      );
    } finally {
      setEmailPwSending(false);
    }
  };

  const handleDeleteImage = async () => {
    if (!confirm("Are you sure you want to delete your profile picture?")) {
      return;
    }

    try {
      setError("");
      await api.delete("/profile/image", {
        headers: getAuthHeaders(),
      });

      setUserData((prev) => ({ ...prev, profileImage: null }));
      setImageSourceUrl(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error deleting profile picture:", err);
      setError(err.response?.data?.error || "Profile picture could not be deleted");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    if (!data.currentPassword) delete data.currentPassword;
    if (!data.newPassword) delete data.newPassword;
    if (!data.confirmPassword) delete data.confirmPassword;

    try {
      const res = await api.post("/profile", data, {
        headers: getAuthHeaders(),
      });

      const updatedUsername = res.data.username || data.username;
      const updatedEmail = res.data.email || data.email;

      setUserData({ ...userData, username: updatedUsername, email: updatedEmail });
      syncUserToLocalStorage(updatedUsername, updatedEmail);
      setNewPasswordValue("");
      setConfirmPasswordValue("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving:", err);
      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }
      setError(
        err.response?.data?.error ||
          "Error saving – please check your input"
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070312] flex items-center justify-center text-white/50">
        Loading…
      </div>
    );
  }

  const TABS = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "artists", label: "Artists", icon: Star },
    { id: "songs", label: "Songs", icon: Music },
    { id: "history", label: "History", icon: History },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  const totalSeconds = (listeningStats?.total_minutes || 0) * 60;

  return (
    <div className="min-h-screen bg-[#070312] text-white">
      {/* Ambient glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/4 w-[440px] h-[440px] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/5 w-[320px] h-[320px] bg-fuchsia-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Toasts */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[70] max-w-md mx-auto p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm text-center flex items-center justify-center gap-2 backdrop-blur-xl"
          >
            <CheckCircle className="w-4 h-4" />
            Saved successfully!
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[70] max-w-md mx-auto p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm text-center flex items-center justify-center gap-2 backdrop-blur-xl"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError("")} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
        {emailPwNotice && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-4 left-4 right-4 z-[70] max-w-md mx-auto p-3 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-200 text-sm text-center flex items-center justify-center gap-2 backdrop-blur-xl"
          >
            <Send className="w-4 h-4" />
            {emailPwNotice}
            <button onClick={() => setEmailPwNotice("")} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-5 pb-16">
        {/* Top bar */}
        <div className="py-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
        </div>

        {/* HERO */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col sm:flex-row sm:items-end gap-5 mb-6"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.05, type: "spring", stiffness: 200, damping: 20 }}
            className="relative shrink-0 self-start"
          >
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden ring-1 ring-white/15 shadow-2xl shadow-violet-900/40 bg-slate-800">
              {userData.profileImage ? (
                <img
                  src={userData.profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500">
                  <User className="w-12 h-12 text-white/80" />
                </div>
              )}
            </div>
            <button
              onClick={() => setPictureModalOpen(true)}
              title="Edit picture"
              className="absolute -bottom-2 -right-2 p-2 rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 border-2 border-[#070312] hover:shadow-lg hover:shadow-violet-500/30 transition-all"
            >
              <Camera className="w-4 h-4 text-white" />
            </button>
          </motion.div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.25em] text-violet-300/70 mb-1.5">
              Profile
            </p>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-none mb-1.5 break-words">
              {userData.username || "Unknown"}
            </h1>
            <p className="text-white/50 text-sm truncate mb-4">
              {userData.email}
            </p>
            <div className="flex flex-wrap gap-2">
              <HeroStat
                icon={Headphones}
                value={formatDuration(totalSeconds)}
                label="listened"
              />
              <HeroStat
                icon={Music}
                value={listeningStats?.song_listens || 0}
                label="songs"
              />
              <HeroStat
                icon={Users}
                value={listeningStats?.sessions_count || 0}
                label="sessions"
              />
              <HeroStat
                icon={Trophy}
                value={stats?.winsAgainstQueue || 0}
                label="wins"
              />
            </div>
          </div>
        </motion.div>

        {/* TAB BAR */}
        <div className="flex gap-1 p-1 rounded-2xl bg-white/[0.04] border border-white/10 mb-5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative flex-1 min-w-[4.5rem] px-3 py-2 rounded-xl text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                tab === t.id ? "text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {tab === t.id && (
                <motion.span
                  layoutId="tabpill"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/90 to-fuchsia-500/90 -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <t.icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {/* ---------------- OVERVIEW ---------------- */}
            {tab === "overview" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Panel title="Voting" icon={Vote}>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <StatTile
                      icon={Trophy}
                      value={stats?.winsAgainstQueue || 0}
                      label="Wins vs queue"
                      accent="text-yellow-400"
                    />
                    <StatTile
                      icon={Flame}
                      value={stats?.maxStreakWinsAgainstQueue || 0}
                      label="Win streak"
                      accent="text-orange-400"
                    />
                    <StatTile
                      icon={ThumbsUp}
                      value={stats?.votesOnOwnSuggestions || 0}
                      label="Votes on own"
                      accent="text-cyan-400"
                    />
                    <StatTile
                      icon={Vote}
                      value={
                        (stats?.votesOnOthersAndWon || 0) +
                        (stats?.votesOnOthersAndLost || 0)
                      }
                      label="Total votes"
                      accent="text-violet-300"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-medium">
                            Successful votes
                          </span>
                        </div>
                        <span className="font-bold tabular-nums">
                          {stats?.votesOnOthersAndWon || 0}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500"
                          style={{
                            width: `${Math.min((stats?.maxStreakVotesOnWinningOthers || 0) * 10, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">
                        Streak: {stats?.maxStreakVotesOnWinningOthers || 0}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium">Lost votes</span>
                        </div>
                        <span className="font-bold tabular-nums">
                          {stats?.votesOnOthersAndLost || 0}
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-fuchsia-500"
                          style={{
                            width: `${Math.min((stats?.maxStreakVotesOnLosingOthers || 0) * 10, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">
                        Streak: {stats?.maxStreakVotesOnLosingOthers || 0}
                      </p>
                    </div>
                  </div>
                </Panel>

                <Panel title="Activity" icon={BarChart3}>
                  <p className="text-xs text-white/40 mb-2">
                    When you voted vs. only listened — last 30 days.
                  </p>
                  {votingActivity ? (
                    <VotingActivityChart
                      votesByDay={votingActivity.votesByDay || []}
                      listensByDay={votingActivity.listensByDay || []}
                    />
                  ) : (
                    <Empty>No activity yet.</Empty>
                  )}
                </Panel>
              </div>
            )}

            {/* ---------------- ARTISTS ---------------- */}
            {tab === "artists" && (
              <Panel title="Top artists" icon={Star} badge={topArtists.length || null}>
                {topArtists.length === 0 ? (
                  <Empty>No artists yet — join a session and start listening.</Empty>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-2">
                    {topArtists.map((artist, i) => (
                      <motion.button
                        key={artist.artist_id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        whileHover={{ y: -3 }}
                        onClick={() => openArtistModal(artist)}
                        className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-violet-400/40 transition-colors text-left"
                      >
                        <span className="text-xs font-bold text-white/30 w-5 text-center shrink-0">
                          {i + 1}
                        </span>
                        {artist.image_url ? (
                          <img
                            src={artist.image_url}
                            alt={artist.name}
                            className="w-11 h-11 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-white/80" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {artist.name}
                          </p>
                          <p className="text-xs text-white/40 truncate">
                            {formatDuration(artist.total_seconds)}
                            {formatLastListened(artist.last_listened) && (
                              <span className="text-white/30">
                                {" · "}
                                {formatLastListened(artist.last_listened)}
                              </span>
                            )}
                          </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-white/30 rotate-[-90deg] shrink-0" />
                      </motion.button>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {/* ---------------- SONGS ---------------- */}
            {tab === "songs" && (
              <Panel title="Top songs" icon={Music} badge={topSongs.length || null}>
                {topSongs.length === 0 ? (
                  <Empty>No songs yet.</Empty>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {topSongs.map((song, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/10"
                      >
                        <span className="text-xs font-bold text-white/30 w-4 text-center shrink-0">
                          {i + 1}
                        </span>
                        <img
                          src={song.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {song.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                style={{
                                  width: `${Math.min(
                                    (song.total_seconds / maxSongSeconds) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-white/40 shrink-0 tabular-nums">
                              {formatDuration(song.total_seconds)}
                            </span>
                          </div>
                          {formatLastListened(song.last_listened) && (
                            <p className="text-[10px] text-white/30 mt-0.5">
                              Last heard {formatLastListened(song.last_listened)}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            {/* ---------------- HISTORY ---------------- */}
            {tab === "history" && (
              <div className="grid gap-4 md:grid-cols-2">
                <Panel
                  title="Recent listens"
                  icon={History}
                  badge={recentListens.length || null}
                >
                  {recentListens.length === 0 ? (
                    <Empty>Nothing here yet.</Empty>
                  ) : (
                    <div className="space-y-1.5 max-h-[26rem] overflow-y-auto pr-1">
                      {recentListens.map((l, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() =>
                            l.artist_id &&
                            openArtistModal({
                              artist_id: l.artist_id,
                              name: l.artist_name,
                              image_url: l.artist_image_url,
                            })
                          }
                          className={`flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] border border-white/10 transition-colors ${
                            l.artist_id
                              ? "cursor-pointer hover:border-violet-400/40"
                              : ""
                          }`}
                        >
                          <img
                            src={l.thumbnail}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {l.title}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-white/40">
                              {l.artist_name && (
                                <>
                                  <span className="truncate text-violet-300/80 max-w-[7rem]">
                                    {l.artist_name}
                                  </span>
                                  <span>•</span>
                                </>
                              )}
                              <span
                                className={
                                  l.completed
                                    ? "text-emerald-400"
                                    : "text-yellow-400"
                                }
                              >
                                {l.completed ? "✓" : "Partial"}
                              </span>
                              <span>•</span>
                              <span>{Math.floor(l.listen_seconds / 60)}m</span>
                            </div>
                          </div>
                          <div className="text-[10px] text-white/30 text-right shrink-0 flex items-center gap-1">
                            <span className="whitespace-nowrap">
                              {new Date(l.listened_from).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric" }
                              )}
                            </span>
                            {l.artist_id && (
                              <ChevronDown className="w-4 h-4 text-white/30 rotate-[-90deg]" />
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Panel>

                <Panel title="Listening calendar" icon={Calendar}>
                  {calendarListens.length > 0 ? (
                    <ListenCalendar />
                  ) : (
                    <Empty>No listening history in the last 90 days yet.</Empty>
                  )}
                </Panel>
              </div>
            )}

            {/* ---------------- SETTINGS ---------------- */}
            {tab === "settings" && (
              <Panel title="Edit profile" icon={Edit3}>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-white/50 mb-1 block">
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="text"
                        name="username"
                        defaultValue={userData.username}
                        required
                        minLength={3}
                        maxLength={50}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-violet-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="email"
                        name="email"
                        defaultValue={userData.email}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-violet-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Password — only for accounts that HAVE a password. */}
                  {hasPassword ? (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-white/50 mb-3 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Change password (optional)
                      </p>
                      <div className="space-y-2">
                        <input
                          type="password"
                          name="currentPassword"
                          placeholder="Current password"
                          autoComplete="current-password"
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-violet-400 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="relative">
                            <input
                              type={showNewPassword ? "text" : "password"}
                              name="newPassword"
                              value={newPasswordValue}
                              onChange={(e) => setNewPasswordValue(e.target.value)}
                              placeholder="New password"
                              autoComplete="new-password"
                              className="w-full px-4 py-2.5 pr-9 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-violet-400 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowNewPassword((v) => !v)}
                              tabIndex={-1}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/70"
                            >
                              {showNewPassword ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <input
                            type={showNewPassword ? "text" : "password"}
                            name="confirmPassword"
                            value={confirmPasswordValue}
                            onChange={(e) =>
                              setConfirmPasswordValue(e.target.value)
                            }
                            placeholder="Confirm"
                            autoComplete="new-password"
                            className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-violet-400 focus:outline-none"
                          />
                        </div>

                        {newPasswordValue &&
                          (() => {
                            const s = passwordStrength(newPasswordValue);
                            return (
                              <div>
                                <div className="flex gap-1">
                                  {[0, 1, 2, 3].map((idx) => (
                                    <div
                                      key={idx}
                                      className={`h-1.5 flex-1 rounded-full ${
                                        idx < s.score ? s.barColor : "bg-white/10"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                  <span className={`text-[11px] ${s.textColor}`}>
                                    {s.label}
                                  </span>
                                  {confirmPasswordValue &&
                                    confirmPasswordValue !== newPasswordValue && (
                                      <span className="text-[11px] text-red-400">
                                        Passwords don’t match
                                      </span>
                                    )}
                                </div>
                              </div>
                            );
                          })()}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const pw = generateStrongPassword();
                              setNewPasswordValue(pw);
                              setConfirmPasswordValue(pw);
                              setShowNewPassword(true);
                            }}
                            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Wand2 className="w-3.5 h-3.5 text-violet-400" />
                            Generate
                          </button>
                          <button
                            type="button"
                            disabled={!newPasswordValue}
                            onClick={() => {
                              navigator.clipboard?.writeText(newPasswordValue);
                              setSuccess(true);
                              setTimeout(() => setSuccess(false), 2000);
                            }}
                            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            Copy
                          </button>
                        </div>
                        <p className="text-[10px] text-white/30">
                          Tip: generate one, copy it into your password manager,
                          then save your changes.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleEmailNewPassword}
                        disabled={emailPwSending}
                        className="mt-3 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5 text-fuchsia-400" />
                        {emailPwSending
                          ? "Sending…"
                          : "Change it for me & email me the new password"}
                      </button>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-white/10">
                      <p className="text-xs text-white/40 flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        You sign in with a linked account (Google/Facebook), so
                        there’s no password to change.
                      </p>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save changes
                  </button>
                </form>
              </Panel>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ===== PICTURE MODAL (upload + URL + remove, all in one place) ===== */}
      <AnimatePresence>
        {pictureModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[65] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setPictureModalOpen(false)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
                  Profile picture
                </h2>
                <button
                  onClick={() => setPictureModalOpen(false)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-5">
                {/* Current picture */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden ring-1 ring-white/15 bg-slate-800 shrink-0">
                    {userData.profileImage ? (
                      <img
                        src={userData.profileImage}
                        alt="Current"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500">
                        <User className="w-9 h-9 text-white/80" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 text-[11px] text-white/40">
                    {imageSourceUrl ? (
                      <>
                        From:{" "}
                        <a
                          href={imageSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-300 underline break-all"
                        >
                          {imageSourceUrl}
                        </a>
                      </>
                    ) : userData.profileImage ? (
                      "Uploaded file."
                    ) : (
                      "No profile picture yet."
                    )}
                  </div>
                </div>

                {/* Upload a file — click to browse or drag & drop */}
                <div>
                  <motion.div
                    role="button"
                    tabIndex={0}
                    animate={{ scale: isDragging ? 1.02 : 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 22 }}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") &&
                      fileInputRef.current?.click()
                    }
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onDrop={handleImageDrop}
                    className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 flex flex-col items-center justify-center text-center gap-2 outline-none transition-colors focus-visible:border-violet-400 ${
                      isDragging
                        ? "border-violet-400 bg-violet-500/10"
                        : "border-white/15 bg-white/[0.03] hover:border-violet-400/50 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isDragging ? "bg-violet-500/25" : "bg-white/5"
                      }`}
                    >
                      <Upload
                        className={`w-5 h-5 transition-colors ${
                          isDragging ? "text-violet-300" : "text-white/60"
                        }`}
                      />
                    </div>
                    <p className="text-sm font-medium">
                      {isDragging
                        ? "Drop your image to upload"
                        : "Drag & drop an image"}
                    </p>
                    <p className="text-[11px] text-white/40">
                      or <span className="text-violet-300">browse files</span> ·
                      JPEG, PNG, GIF, WebP · max 5 MB
                    </p>
                  </motion.div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/30">
                  <span className="flex-1 h-px bg-white/10" />
                  or paste a link
                  <span className="flex-1 h-px bg-white/10" />
                </div>

                {/* Paste a URL */}
                <div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => {
                          setImageUrlInput(e.target.value);
                          setImageUrlPreviewError(false);
                        }}
                        placeholder="https://…/photo.jpg"
                        className="w-full pl-10 pr-[4.5rem] py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-violet-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handlePasteImageUrl}
                        title="Paste from clipboard"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium flex items-center gap-1 transition-colors"
                      >
                        <ClipboardPaste className="w-3.5 h-3.5" />
                        Paste
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleImageUrlSave}
                      disabled={
                        !imageUrlInput.trim() ||
                        imageUrlPreviewError ||
                        imageUrlSaving
                      }
                      className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap transition-colors"
                    >
                      {imageUrlSaving ? "Saving…" : "Use image"}
                    </button>
                  </div>
                  {imageUrlInput.trim() && (
                    <div className="mt-2 flex items-center gap-3">
                      {imageUrlPreviewError ? (
                        <p className="text-[11px] text-red-400">
                          That link doesn’t look like a viewable image.
                        </p>
                      ) : (
                        <>
                          <img
                            src={imageUrlInput.trim()}
                            alt="Preview"
                            onError={() => setImageUrlPreviewError(true)}
                            className="w-12 h-12 rounded-xl object-cover border border-white/10"
                          />
                          <p className="text-[11px] text-white/40">
                            Live preview — click “Use image” to save it.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Remove */}
                {userData.profileImage && (
                  <button
                    type="button"
                    onClick={handleDeleteImage}
                    className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-sm font-medium text-red-300 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove current picture
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ARTIST MODAL ===== */}
      <AnimatePresence>
        {artistModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={() => {
              setArtistModalOpen(false);
              setArtistInsights(null);
              setActiveArtist(null);
            }}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-full max-w-lg max-h-[85vh] overflow-y-auto bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeArtist?.image_url ? (
                    <img
                      src={activeArtist.image_url}
                      alt={activeArtist?.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <User className="w-6 h-6 text-white/80" />
                    </div>
                  )}
                  <div>
                    <h2 className="font-bold text-lg">{activeArtist?.name}</h2>
                    <p className="text-xs text-white/50">Your listening stats</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setArtistModalOpen(false);
                    setArtistInsights(null);
                    setActiveArtist(null);
                  }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4">
                {artistLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="text-white/50">Loading insights…</div>
                  </div>
                ) : artistInsights ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 gap-2">
                      <StatTile
                        icon={Headphones}
                        value={`${artistInsights.total_minutes || 0}m`}
                        label="Time"
                      />
                      <StatTile
                        icon={Music}
                        value={artistInsights.song_count || 0}
                        label="Songs"
                        accent="text-fuchsia-400"
                      />
                      <StatTile
                        icon={Users}
                        value={artistInsights.session_count || 0}
                        label="Sessions"
                        accent="text-cyan-400"
                      />
                      <StatTile
                        icon={Repeat}
                        value={artistInsights.avg_minutes_per_song || 0}
                        label="Avg/song"
                        accent="text-emerald-400"
                      />
                    </div>

                    {artistInsights.top_songs?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Most played</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {artistInsights.top_songs.slice(0, 5).map((song, i) => (
                            <div
                              key={song.queue_item_id || i}
                              className="p-2 rounded-xl bg-white/5"
                            >
                              <div className="flex justify-between items-center text-sm mb-1">
                                <span className="truncate flex-1 font-medium">
                                  <span className="text-white/40 mr-2">
                                    #{i + 1}
                                  </span>
                                  {song.title}
                                </span>
                                <span className="text-white/50 text-xs shrink-0 ml-2 tabular-nums">
                                  {formatDuration(song.total_seconds)}
                                </span>
                              </div>
                              {formatLastListened(song.last_listened) && (
                                <p className="text-[10px] text-white/30 mb-1">
                                  Last heard{" "}
                                  {formatLastListened(song.last_listened)}
                                </p>
                              )}
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500"
                                  style={{
                                    width: `${
                                      artistInsights.max_song_seconds
                                        ? (song.total_seconds /
                                            artistInsights.max_song_seconds) *
                                          100
                                        : 0
                                    }%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {artistInsights.daily_listens?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Last 30 days</h3>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                          <ListeningTrendChart
                            dailyListens={artistInsights.daily_listens}
                            dailySessions={artistInsights.daily_sessions || []}
                            maxDailySeconds={artistInsights.max_daily_seconds}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        When you listened
                      </h3>
                      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                        <ArtistListenCalendar
                          events={artistInsights.listen_events || []}
                        />
                      </div>
                    </div>

                    <Link
                      to={`/artist/${activeArtist?.artist_id}`}
                      className="block w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-sm text-center hover:shadow-lg hover:shadow-violet-500/25 transition-all"
                    >
                      View full artist page →
                    </Link>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
