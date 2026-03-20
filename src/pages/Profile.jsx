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
} from "lucide-react";
import axios from "axios";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
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

  // UI State for collapsible sections
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showTopSongs, setShowTopSongs] = useState(false);
  const [showRecentListens, setShowRecentListens] = useState(false);
  const [showArtists, setShowArtists] = useState(false);

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

  const openArtistModal = async (artist) => {
    setActiveArtist(artist);
    setArtistModalOpen(true);
    setArtistInsights(null);
    setArtistLoading(true);

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
        const [profileRes, statsRes, listeningRes, recentListensRes] =
          await Promise.all([
            api.get("/profile", { headers: getAuthHeaders() }),
            api.get("/profile/user-stats", { headers: getAuthHeaders() }),
            api.get("/profile/listening-summary", {
              headers: getAuthHeaders(),
            }),
            api.get("/profile/recent-listens", { headers: getAuthHeaders() }),
          ]);

        setListeningStats(listeningRes.data.stats);

        setTopSongs(listeningRes.data.topSongs);
        setMaxSongSeconds(
          Math.max(
            ...listeningRes.data.topSongs.map((s) => s.total_seconds),
            1
          )
        );
        setRecentListens(recentListensRes.data.recentListens);
        setTopArtists(listeningRes.data.topArtists);

        const {
          username = "",
          email = "",
          imageType,
          imageData,
        } = profileRes.data;
        setUserData((prev) => ({
          ...prev,
          username,
          email,
          profileImage:
            imageData && imageType
              ? `data:${imageType};base64,${imageData}`
              : prev.profileImage,
        }));

        setStats(statsRes.data);

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

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
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
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Error uploading image:", err);
      setError(err.response?.data?.error || "Image could not be uploaded");
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

  // Compact Stat Card
  const StatCard = ({ icon: Icon, value, label, color = "purple" }) => {
    const colors = {
      purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20",
      pink: "from-pink-500/20 to-pink-600/10 border-pink-500/20",
      green: "from-green-500/20 to-green-600/10 border-green-500/20",
      orange: "from-orange-500/20 to-orange-600/10 border-orange-500/20",
      cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/20",
      yellow: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/20",
    };

    const iconColors = {
      purple: "text-purple-400",
      pink: "text-pink-400",
      green: "text-green-400",
      orange: "text-orange-400",
      cyan: "text-cyan-400",
      yellow: "text-yellow-400",
    };

    return (
      <div
        className={`bg-gradient-to-br ${colors[color]} rounded-xl border p-3 text-center`}
      >
        {Icon && <Icon className={`w-5 h-5 mx-auto mb-1 ${iconColors[color]}`} />}
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-white/50 text-[10px] leading-tight">{label}</p>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full filter blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-pink-600/10 rounded-full filter blur-[80px]"></div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/90 border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="font-bold text-lg">My Profile</h1>
          </div>
          <button
            onClick={() => setShowEditProfile(!showEditProfile)}
            className={`p-2 rounded-lg transition-colors ${
              showEditProfile ? "bg-purple-500 text-white" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Toast Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-300 text-sm text-center flex items-center justify-center gap-2"
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
            className="fixed top-16 left-4 right-4 z-50 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm text-center flex items-center justify-center gap-2"
          >
            <AlertCircle className="w-4 h-4" />
            {error}
            <button onClick={() => setError("")} className="ml-2">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative z-10 pb-8">
        {/* Profile Header - Compact */}
        <div className="px-4 py-6">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-purple-500/30 bg-slate-800">
                {userData.profileImage ? (
                  <img
                    src={userData.profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500">
                    <User className="w-10 h-10 text-white/80" />
                  </div>
                )}
              </div>
              {/* Upload/Delete buttons */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-purple-500 border-2 border-slate-950 hover:bg-purple-400 transition-colors"
              >
                <Camera className="w-3.5 h-3.5 text-white" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            {/* Name & Email */}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{userData.username || "Unknown"}</h2>
              <p className="text-white/50 text-sm truncate">{userData.email}</p>
              {userData.profileImage && (
                <button
                  onClick={handleDeleteImage}
                  className="mt-1 text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Remove photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-2">
            <StatCard
              icon={Headphones}
              value={`${listeningStats?.total_minutes || 0}m`}
              label="Listening"
              color="purple"
            />
            <StatCard
              icon={Music}
              value={listeningStats?.song_listens || 0}
              label="Songs"
              color="pink"
            />
            <StatCard
              icon={Users}
              value={listeningStats?.sessions_count || 0}
              label="Sessions"
              color="cyan"
            />
            <StatCard
              icon={Trophy}
              value={stats?.winsAgainstQueue || 0}
              label="Wins"
              color="yellow"
            />
          </div>
        </div>

        {/* Edit Profile Section - Collapsible */}
        <AnimatePresence>
          {showEditProfile && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">
                <form
                  onSubmit={handleSubmit}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2 mb-3">
                    <Edit3 className="w-4 h-4 text-purple-400" />
                    Edit Profile
                  </h3>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Username</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="text"
                        name="username"
                        defaultValue={userData.username}
                        required
                        minLength={3}
                        maxLength={50}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-white/50 mb-1 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="email"
                        name="email"
                        defaultValue={userData.email}
                        required
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-xs text-white/50 mb-3 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Change Password (optional)
                    </p>
                    <div className="space-y-2">
                      <input
                        type="password"
                        name="currentPassword"
                        placeholder="Current password"
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="password"
                          name="newPassword"
                          placeholder="New password"
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none"
                        />
                        <input
                          type="password"
                          name="confirmPassword"
                          placeholder="Confirm"
                          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Changes
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats Section - Collapsible */}
        <div className="px-4 py-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-sm">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              Voting Statistics
            </span>
            {showStats ? (
              <ChevronUp className="w-5 h-5 text-white/50" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/50" />
            )}
          </button>

          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {/* Core Stats Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-4 h-4 text-yellow-400" />
                        <span className="text-lg font-bold">{stats?.winsAgainstQueue || 0}</span>
                      </div>
                      <p className="text-xs text-white/50">Wins vs Queue</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Flame className="w-4 h-4 text-orange-400" />
                        <span className="text-lg font-bold">{stats?.maxStreakWinsAgainstQueue || 0}</span>
                      </div>
                      <p className="text-xs text-white/50">Win Streak</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <ThumbsUp className="w-4 h-4 text-cyan-400" />
                        <span className="text-lg font-bold">{stats?.votesOnOwnSuggestions || 0}</span>
                      </div>
                      <p className="text-xs text-white/50">Votes on Own</p>
                    </div>
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Vote className="w-4 h-4 text-purple-400" />
                        <span className="text-lg font-bold">
                          {(stats?.votesOnOthersAndWon || 0) + (stats?.votesOnOthersAndLost || 0)}
                        </span>
                      </div>
                      <p className="text-xs text-white/50">Total Votes</p>
                    </div>
                  </div>

                  {/* Trend Stats */}
                  <div className="space-y-2">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium">Successful Votes</span>
                        </div>
                        <span className="font-bold">{stats?.votesOnOthersAndWon || 0}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
                          style={{
                            width: `${Math.min((stats?.maxStreakVotesOnWinningOthers || 0) * 10, 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-[10px] text-white/40 mt-1">
                        Streak: {stats?.maxStreakVotesOnWinningOthers || 0}
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-medium">Lost Votes</span>
                        </div>
                        <span className="font-bold">{stats?.votesOnOthersAndLost || 0}</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-pink-500"
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Top Artists - Collapsible */}
        {topArtists.length > 0 && (
          <div className="px-4 py-2">
            <button
              onClick={() => setShowArtists(!showArtists)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                <Star className="w-5 h-5 text-purple-400" />
                Top Artists ({topArtists.length})
              </span>
              {showArtists ? (
                <ChevronUp className="w-5 h-5 text-white/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-white/50" />
              )}
            </button>

            <AnimatePresence>
              {showArtists && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
                    {topArtists.map((artist, i) => (
                      <motion.div
                        key={artist.artist_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => openArtistModal(artist)}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/[0.07] cursor-pointer transition-colors"
                      >
                        <span className="text-xs text-white/30 w-5 text-center font-medium">
                          #{i + 1}
                        </span>
                        {artist.image_url ? (
                          <img
                            src={artist.image_url}
                            alt={artist.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                            <User className="w-5 h-5 text-white/80" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{artist.name}</p>
                          <p className="text-xs text-white/40">
                            {Math.floor(artist.total_seconds / 60)} min
                          </p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-white/30 rotate-[-90deg]" />
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Top Songs - Collapsible */}
        {topSongs.length > 0 && (
          <div className="px-4 py-2">
            <button
              onClick={() => setShowTopSongs(!showTopSongs)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                <Music className="w-5 h-5 text-purple-400" />
                Top Songs ({topSongs.length})
              </span>
              {showTopSongs ? (
                <ChevronUp className="w-5 h-5 text-white/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-white/50" />
              )}
            </button>

            <AnimatePresence>
              {showTopSongs && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
                    {topSongs.map((song, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                      >
                        <img
                          src={song.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{song.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                style={{
                                  width: `${Math.min(
                                    (song.total_seconds / maxSongSeconds) * 100,
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                            <span className="text-[10px] text-white/40 shrink-0">
                              {Math.floor(song.total_seconds / 60)}m
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Recent Listens - Collapsible with Inner Scroll */}
        {recentListens.length > 0 && (
          <div className="px-4 py-2">
            <button
              onClick={() => setShowRecentListens(!showRecentListens)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                <History className="w-5 h-5 text-purple-400" />
                Recent Listens ({recentListens.length})
              </span>
              {showRecentListens ? (
                <ChevronUp className="w-5 h-5 text-white/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-white/50" />
              )}
            </button>

            <AnimatePresence>
              {showRecentListens && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 max-h-72 overflow-y-auto space-y-2 pr-1">
                    {recentListens.map((l, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                      >
                        <img
                          src={l.thumbnail}
                          alt=""
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{l.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-white/40">
                            <span className={l.completed ? "text-green-400" : "text-yellow-400"}>
                              {l.completed ? "✓ Complete" : "Partial"}
                            </span>
                            <span>•</span>
                            <span>{Math.floor(l.listen_seconds / 60)}m</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-white/30 text-right shrink-0">
                          <Clock className="w-3 h-3 inline mr-0.5" />
                          {new Date(l.listened_from).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* Artist Modal */}
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
              {/* Modal Header */}
              <div className="sticky top-0 bg-slate-900/95 backdrop-blur-sm border-b border-white/10 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {activeArtist?.image_url ? (
                    <img
                      src={activeArtist.image_url}
                      alt={activeArtist?.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
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

              {/* Modal Content */}
              <div className="p-4">
                {artistLoading ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="text-white/50">Loading insights...</div>
                  </div>
                ) : artistInsights ? (
                  <div className="space-y-4">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2">
                      <StatCard
                        icon={Headphones}
                        value={`${artistInsights.total_minutes || 0}m`}
                        label="Time"
                        color="purple"
                      />
                      <StatCard
                        icon={Music}
                        value={artistInsights.song_count || 0}
                        label="Songs"
                        color="pink"
                      />
                      <StatCard
                        icon={Users}
                        value={artistInsights.session_count || 0}
                        label="Sessions"
                        color="cyan"
                      />
                      <StatCard
                        icon={Repeat}
                        value={artistInsights.avg_minutes_per_song || 0}
                        label="Avg/Song"
                        color="green"
                      />
                    </div>

                    {/* Top Songs */}
                    {artistInsights.top_songs?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Most Played</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {artistInsights.top_songs.slice(0, 5).map((song, i) => (
                            <div
                              key={song.queue_item_id || i}
                              className="p-2 rounded-xl bg-white/5"
                            >
                              <div className="flex justify-between items-center text-sm mb-1">
                                <span className="truncate flex-1 font-medium">
                                  <span className="text-white/40 mr-2">#{i + 1}</span>
                                  {song.title}
                                </span>
                                <span className="text-white/50 text-xs shrink-0 ml-2">
                                  {Math.floor(song.total_seconds / 60)}m
                                </span>
                              </div>
                              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                                  style={{
                                    width: `${
                                      artistInsights.max_song_seconds
                                        ? (song.total_seconds / artistInsights.max_song_seconds) * 100
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

                    {/* Listening Trend */}
                    {artistInsights.daily_listens?.length > 0 && (
                      <div>
                        <h3 className="text-sm font-semibold mb-2">Last 30 Days</h3>
                        <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                          <ListeningTrendChart
                            dailyListens={artistInsights.daily_listens}
                            dailySessions={artistInsights.daily_sessions || []}
                            maxDailySeconds={artistInsights.max_daily_seconds}
                          />
                        </div>
                      </div>
                    )}

                    {/* Link to full artist page */}
                    <Link
                      to={`/artist/${activeArtist?.artist_id}`}
                      className="block w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-medium text-sm text-center hover:shadow-lg hover:shadow-purple-500/25 transition-all"
                    >
                      View Full Artist Page →
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