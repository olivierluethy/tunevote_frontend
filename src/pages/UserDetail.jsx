// src/pages/UserDetail.jsx
import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  User,
  Music,
  Headphones,
  Clock,
  Users,
  Trophy,
  ThumbsUp,
  Flame,
  TrendingUp,
  TrendingDown,
  Zap,
  Eye,
  Vote,
  Heart,
  MessageSquare,
} from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

const StatCard = ({ icon: Icon, value, label, color = "purple", gradient = false }) => {
  const base = `backdrop-blur-xl bg-gradient-to-br from-${color}-900/40 to-black/40 border border-${color}-500/30 rounded-2xl p-5 text-center hover:scale-[1.03] transition-all duration-300 shadow-lg shadow-${color}-900/20`;

  return (
    <div className={base}>
      <Icon className={`w-8 h-8 mx-auto mb-3 text-${color}-400`} />
      <p className="text-3xl font-bold text-white tracking-tight">{value}</p>
      <p className="text-white/60 text-sm mt-1 font-medium">{label}</p>
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="p-2 rounded-lg bg-purple-500/20">
      <Icon className="w-6 h-6 text-purple-400" />
    </div>
    <h2 className="text-2xl font-bold text-white bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
      {title}
    </h2>
  </div>
);

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
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-pink-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Lade Profil...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-pink-950 flex flex-col items-center justify-center text-white">
        <h1 className="text-4xl font-bold mb-4">User nicht gefunden</h1>
        <Link to="/dashboard" className="text-purple-400 hover:underline">
          Zurück zum Dashboard
        </Link>
      </div>
    );
  }

  const { user, top_songs, top_co_listeners, session_count, stats, active_session } = data;

  const totalMinutes = Math.floor(user.total_listen_seconds / 60);
  const songsHeard = stats.totalSongsHeard || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-950 via-black to-pink-950 text-white pt-16 pb-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-purple-300 hover:text-purple-200 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Zurück</span>
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 mb-12">
          <div className="relative group">
            {user.image_url ? (
              <img
                src={user.image_url}
                alt={user.username}
                className="w-40 h-40 sm:w-48 sm:h-48 rounded-full object-cover border-4 border-purple-500/60 shadow-2xl shadow-purple-900/50"
              />
            ) : (
              <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-purple-700 to-pink-700 flex items-center justify-center border-4 border-purple-500/60 shadow-2xl shadow-purple-900/50">
                <User className="w-20 h-20 text-white/80" />
              </div>
            )}
            {/* Live Indicator */}
            {user.is_live_host && (
              <div className="absolute -bottom-2 -right-2 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border-2 border-white/50 animate-pulse">
                LIVE
              </div>
            )}
          </div>

          <div className="text-center sm:text-left">
            <h1 className="text-4xl sm:text-5xl font-extrabold bg-gradient-to-r from-purple-300 via-pink-300 to-purple-300 bg-clip-text text-transparent mb-2">
              {user.username}
            </h1>
            <p className="text-xl text-white/70 mb-4">
              {totalMinutes.toLocaleString()} Minuten gehört
            </p>

            {/* Active Session Badge */}
            {active_session && (
              <Link
                to={active_session.join_url || "#"}
                className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  active_session.is_private
                    ? "bg-red-600/30 text-red-300 border border-red-500/40"
                    : "bg-green-600/30 text-green-300 border border-green-500/40 hover:bg-green-600/50"
                }`}
              >
                <div className="w-3 h-3 rounded-full bg-current animate-pulse" />
                {active_session.is_private ? "Privater Live-Room" : "Live-Room beitreten"}
              </Link>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
          <StatCard icon={Headphones} value={totalMinutes.toLocaleString()} label="Minuten gehört" />
          <StatCard icon={Music} value={songsHeard} label="Songs gehört" />
          <StatCard icon={Users} value={session_count} label="Sessions" />
          <StatCard icon={Trophy} value={stats.winsOfOwnSuggestions} label="Song-Gewinne" color="yellow" />
          <StatCard icon={Flame} value={stats.maxWinStreakOwn} label="Bester Streak" color="orange" />
        </div>

        {/* Listening & Voting Highlights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Top Songs */}
          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <SectionHeader icon={Music} title="Top Songs" />
            <div className="space-y-4">
              {top_songs.length === 0 ? (
                <p className="text-white/50 text-center py-6">Noch keine Songs gehört</p>
              ) : (
                top_songs.map((song, i) => (
                  <div key={song.video_id} className="flex items-center gap-4">
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-14 h-14 rounded-lg object-cover shadow-md"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-white truncate">{song.title}</p>
                      <p className="text-sm text-white/60">
                        {Math.floor(song.total_seconds / 60)} min
                      </p>
                    </div>
                    <span className="text-xs text-white/50">#{i + 1}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Top Co-Listeners */}
          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8">
            <SectionHeader icon={Users} title="Top Mit-Hörer" />
            <div className="space-y-4">
              {top_co_listeners.length === 0 ? (
                <p className="text-white/50 text-center py-6">Noch keine gemeinsamen Sessions</p>
              ) : (
                top_co_listeners.map((u) => (
                  <Link
                    key={u.id}
                    to={`/user/${u.id}`}
                    className="flex items-center gap-4 hover:bg-white/5 p-2 rounded-xl transition-colors group"
                  >
                    {u.image_url ? (
  <img
    src={u.image_url}
    alt={u.username}
    className="w-12 h-12 rounded-full object-cover border-2 border-purple-500/30"
  />
) : (

                      <div className="w-12 h-12 rounded-full bg-purple-700/50 flex items-center justify-center">
                        <User className="w-6 h-6 text-white/70" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-white group-hover:text-purple-300 transition-colors">
                        {u.username}
                      </p>
                      <p className="text-sm text-white/60">
                        {Math.floor(u.total_seconds / 60)} min zusammen
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Voting Stats */}
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-12">
          <SectionHeader icon={Vote} title="Voting Highlights" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            <StatCard icon={ThumbsUp} value={stats.votesOnOwnSuggestions} label="Votes auf eigene" />
            <StatCard icon={TrendingUp} value={stats.votesOnOthersAndWon} label="Erfolgreiche Fremdvotes" color="green" />
            <StatCard icon={TrendingDown} value={stats.votesOnOthersAndLost} label="Verlorene Fremdvotes" color="red" />
            <StatCard icon={Eye} value={stats.sessionsWithoutAnyVote} label="Sessions ohne Vote" color="blue" />
            <StatCard icon={Zap} value={stats.ownSuggestionsLost} label="Eigene Songs verloren" color="amber" />
          </div>
        </div>
      </div>
    </div>
  );
}