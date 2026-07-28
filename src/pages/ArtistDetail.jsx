import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Music,
  Clock,
  User,
  X,
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Trash2,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  Users,
  Send,
  Headphones,
  TrendingUp,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
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

// YouTube-style relative time, e.g. "6 months ago", "2 hours ago".
const timeAgo = (date) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return formatDistanceToNow(d, { addSuffix: true });
};

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

export default function ArtistDetail() {
  const { artistId } = useParams();
  const navigate = useNavigate();

  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [users, setUsers] = useState([]);
  const [daily, setDaily] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  const [shouts, setShouts] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyToId, setReplyToId] = useState(null);
  const [posting, setPosting] = useState(false);

  const token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  /* ---------------- API ---------------- */

  const fetchShouts = async () => {
    try {
      const res = await axios.get(`${API_URL}/artist/${artistId}/shouts`);
      setShouts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendReply = async (message, parentId) => {
    if (!message.trim()) return;
    await axios.post(
      `${API_URL}/artist/${artistId}/shouts`,
      { message, parent_id: parentId },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    fetchShouts();
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;
    try {
      setPosting(true);
      await axios.post(
        `${API_URL}/artist/${artistId}/shouts`,
        { message: newMessage },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNewMessage("");
      fetchShouts();
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (shoutId, value) => {
    if (!token) return;
    await axios.post(
      `${API_URL}/shouts/${shoutId}/react`,
      { value },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    fetchShouts();
  };

  const handleEdit = async (shoutId, message) => {
    if (!message.trim()) return;
    await axios.patch(
      `${API_URL}/shouts/${shoutId}`,
      { message },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    fetchShouts();
  };

  const handleDeleteShout = async (shoutId) => {
    if (!confirm("Delete this comment?")) return;
    await axios.delete(`${API_URL}/shouts/${shoutId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchShouts();
  };

  /* ---------------- THREAD BUILDER ---------------- */

  const buildThread = (list, parentId = null) =>
    list
      .filter((s) => s.parent_id === parentId)
      .map((s) => ({ ...s, replies: buildThread(list, s.id) }));

  const threadedShouts = buildThread(shouts);
  const totalShouts = shouts.length;

  /* ---------------- SHOUT COMPONENT ---------------- */

  function Shout({ shout, replies, depth = 0 }) {
    const [replyMessage, setReplyMessage] = useState("");
    const [showReplies, setShowReplies] = useState(false);
    const INITIAL_REPLIES = 2;
    const [visibleReplies, setVisibleReplies] = useState(INITIAL_REPLIES);
    const [editing, setEditing] = useState(false);
    const [editMessage, setEditMessage] = useState(shout.message);

    const isOwn = String(shout.user_id) === String(userId);

    const handleReplySend = async () => {
      if (!replyMessage.trim()) return;
      await sendReply(replyMessage, shout.id);
      setReplyMessage("");
      setReplyToId(null);
    };

    const saveEdit = async () => {
      if (!editMessage.trim()) return;
      await handleEdit(shout.id, editMessage);
      setEditing(false);
    };

    return (
      <div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-white/[0.04] border border-white/10 p-3.5"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Link
              to={`/user/${shout.author_public_id || shout.user_id}`}
              className="group/user flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity"
            >
              {shout.profileImage ? (
                <img
                  src={shout.profileImage}
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-violet-500/40"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white/90" />
                </div>
              )}
              <span className="font-medium text-sm truncate group-hover/user:text-violet-300 transition-colors">
                {shout.username}
              </span>
            </Link>
            <span className="text-white/30 text-[11px]">
              {timeAgo(shout.created_at)}
              {shout.is_edited ? " · edited" : ""}
            </span>
          </div>

          {editing ? (
            <div className="mb-2.5">
              <textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={2}
                autoFocus
                className="w-full resize-none p-2.5 rounded-xl bg-white/5 text-sm text-white border border-white/10 focus:border-violet-400 focus:outline-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditMessage(shout.message);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={!editMessage.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-violet-500 to-fuchsia-500 flex items-center gap-1 disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-white/90 text-sm leading-relaxed mb-2.5">
              {shout.message}
            </p>
          )}

          {!editing && (
            <div className="flex items-center gap-4 text-white/50 text-xs">
              <button
                onClick={() => handleReact(shout.id, 1)}
                disabled={!token}
                title="Like"
                className={`flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                  shout.my_reaction === 1
                    ? "text-violet-400"
                    : "hover:text-violet-400"
                }`}
              >
                <ThumbsUp
                  className="w-4 h-4"
                  fill={shout.my_reaction === 1 ? "currentColor" : "none"}
                />
                {shout.likes || 0}
              </button>

              <button
                onClick={() => handleReact(shout.id, -1)}
                disabled={!token}
                title="Dislike"
                className={`flex items-center gap-1.5 transition-colors disabled:opacity-40 ${
                  shout.my_reaction === -1
                    ? "text-rose-400"
                    : "hover:text-rose-400"
                }`}
              >
                <ThumbsDown
                  className="w-4 h-4"
                  fill={shout.my_reaction === -1 ? "currentColor" : "none"}
                />
                {shout.dislikes || 0}
              </button>

              {!shout.is_deleted && (
                <button
                  onClick={() =>
                    setReplyToId(replyToId === shout.id ? null : shout.id)
                  }
                  className="flex items-center gap-1.5 hover:text-violet-400 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Reply
                </button>
              )}

              {isOwn && !shout.is_deleted && (
                <div className="flex items-center gap-3 ml-auto">
                  <button
                    onClick={() => {
                      setEditMessage(shout.message);
                      setEditing(true);
                    }}
                    title="Edit"
                    className="hover:text-violet-400 transition-colors"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteShout(shout.id)}
                    title="Delete"
                    className="hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          <AnimatePresence>
            {replyToId === shout.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 flex items-end gap-2">
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={1}
                    placeholder="Write a reply…"
                    className="flex-1 resize-none p-2.5 rounded-xl bg-white/5 text-sm text-white border border-white/10 focus:border-violet-400 focus:outline-none"
                  />
                  <button
                    onClick={handleReplySend}
                    className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:shadow-lg hover:shadow-violet-500/25 transition-all shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {replies?.length > 0 && (
          <div className="mt-2 ml-4 pl-3 border-l border-white/10 space-y-2">
            {!showReplies ? (
              <button
                onClick={() => setShowReplies(true)}
                className="flex items-center gap-1 text-violet-400 text-xs hover:text-violet-300"
              >
                <ChevronDown className="w-4 h-4" />
                View {replies.length}{" "}
                {replies.length === 1 ? "reply" : "replies"}
              </button>
            ) : (
              <>
                {replies.slice(0, visibleReplies).map((r) => (
                  <Shout
                    key={r.id}
                    shout={r}
                    replies={r.replies}
                    depth={depth + 1}
                  />
                ))}

                {visibleReplies < replies.length && (
                  <button
                    onClick={() => setVisibleReplies((v) => v + INITIAL_REPLIES)}
                    className="text-violet-400 text-xs hover:text-violet-300"
                  >
                    Load more replies
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowReplies(false);
                    setVisibleReplies(INITIAL_REPLIES);
                  }}
                  className="flex items-center gap-1 text-white/40 text-xs"
                >
                  <ChevronUp className="w-4 h-4" />
                  Hide replies
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ---------------- INIT ---------------- */

  useEffect(() => {
    axios
      .get(`${API_URL}/artist/${artistId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        setArtist(res.data.artist);
        // Hide songs nobody has actually listened to (0 seconds played).
        setSongs(
          (res.data.topSongs || []).filter((s) => (s.total_seconds || 0) > 0),
        );
        setUsers(res.data.topUsers || []);
        setDaily(res.data.daily || []);
        setForecast(res.data.forecast || []);
      })
      .catch((err) => console.error("Artist load failed", err));

    fetchShouts();
  }, [artistId, token]);

  if (!artist) {
    return (
      <div className="min-h-screen bg-[#070312] flex items-center justify-center text-white/50">
        Loading artist…
      </div>
    );
  }

  const maxSong = Math.max(...songs.map((s) => s.total_seconds || 0), 1);

  /* ---------------- RENDER ---------------- */

  return (
    <div className="min-h-screen bg-[#070312] text-white">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden">
        {/* Blurred artist backdrop */}
        <div className="absolute inset-0 -z-10">
          {artist.image_url && (
            <img
              src={artist.image_url}
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
              {artist.image_url ? (
                <img
                  src={artist.image_url}
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl object-cover ring-1 ring-white/15 shadow-2xl shadow-violet-900/50"
                />
              ) : (
                <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-2xl">
                  <User className="w-14 h-14 text-white/80" />
                </div>
              )}
            </motion.div>

            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.25em] text-violet-300/70 mb-1.5">
                Artist
              </p>
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none mb-4 break-words">
                {artist.name}
              </h1>
              <div className="flex flex-wrap gap-2">
                <HeroStat
                  icon={Headphones}
                  label="listened"
                  value={formatDuration(artist.total_seconds)}
                />
                <HeroStat icon={Music} label="songs" value={songs.length} />
                <HeroStat
                  icon={Users}
                  label="listeners"
                  value={users.length}
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ===== BODY: bento grid ===== */}
      <div className="max-w-6xl mx-auto px-5 pb-16 grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT: songs + listeners */}
        <div className="lg:col-span-3 space-y-5">
          {/* Top Songs */}
          <Panel title="Top songs" icon={Music}>
            {songs.length === 0 ? (
              <Empty>No songs have been played yet.</Empty>
            ) : (
              <div className="space-y-1.5">
                {songs.map((song, i) => (
                  <motion.div
                    key={song.id ?? i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      to={`/song/${song.id}`}
                      className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="w-6 text-center text-sm font-bold text-white/30 group-hover:text-violet-300 transition-colors">
                        {i + 1}
                      </span>
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

          {/* Top Listeners */}
          <Panel title="Top listeners" icon={Users}>
            {users.length === 0 ? (
              <Empty>No listeners yet.</Empty>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {users.map((u, i) => (
                  <motion.button
                    key={u.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ y: -3 }}
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:border-violet-400/40 transition-colors text-left"
                  >
                    {u.profileImage ? (
                      <img
                        src={u.profileImage}
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
                        {formatDuration(u.total_seconds)}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </Panel>

          {/* Listening trend + forecast */}
          <Panel title="Listening trend" icon={TrendingUp}>
            {daily.length === 0 ? (
              <Empty>Not enough listening history yet to chart.</Empty>
            ) : (
              <>
                <div className="h-56 w-full">
                  <ArtistTrendChart daily={daily} forecast={forecast} />
                </div>
                <p className="mt-2 text-[11px] text-white/40">
                  Solid = last 30 days · dashed = projected next{" "}
                  {forecast.length} days
                </p>
              </>
            )}
          </Panel>
        </div>

        {/* RIGHT: the wall */}
        <div className="lg:col-span-2">
          <Panel
            title="The wall"
            icon={MessageCircle}
            badge={totalShouts || null}
            className="lg:sticky lg:top-5"
          >
            {/* Composer: textarea + Post on the right */}
            <div className="flex items-end gap-2 mb-4">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={2}
                placeholder={`Say something about ${artist.name}…`}
                className="flex-1 resize-none p-3 rounded-xl bg-white/5 text-sm text-white border border-white/10 focus:border-violet-400 focus:outline-none placeholder-white/30"
              />
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleSend}
                disabled={!newMessage.trim() || posting}
                className="h-[46px] px-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-violet-500/25 transition-all shrink-0"
              >
                <Send className="w-4 h-4" />
                Post
              </motion.button>
            </div>

            <div className="space-y-2.5 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1">
              {threadedShouts.length === 0 ? (
                <Empty>Be the first to leave a shout.</Empty>
              ) : (
                threadedShouts.map((s) => (
                  <Shout key={s.id} shout={s} replies={s.replies} />
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>

      {/* ===== USER MODAL ===== */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0.6 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0.6 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  {selectedUser.profileImage ? (
                    <img
                      src={selectedUser.profileImage}
                      className="w-16 h-16 rounded-2xl object-cover ring-1 ring-white/15"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <User className="w-8 h-8 text-white/80" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold">{selectedUser.username}</h3>
                    <p className="text-white/50 text-sm flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(selectedUser.total_seconds)} on {artist.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <Link
                to={`/user/${selectedUser.id}`}
                onClick={() => setSelectedUser(null)}
                className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-medium text-sm text-center block hover:shadow-lg hover:shadow-violet-500/25 transition-all"
              >
                View full profile →
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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

function Panel({ title, icon: Icon, badge, className = "", children }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-violet-400" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/80">
          {title}
        </h2>
        {badge != null && (
          <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/60">
            {badge}
          </span>
        )}
      </div>
      {children}
    </motion.section>
  );
}

function ArtistTrendChart({ daily, forecast }) {
  const labels = [
    ...daily.map((d) => d.date.slice(5)),
    ...forecast.map((d) => d.date.slice(5)),
  ];
  const histData = [...daily.map((d) => d.listens), ...forecast.map(() => null)];
  // Forecast line starts at the last real point so it connects seamlessly.
  const foreData = labels.map((_, i) => {
    if (daily.length && i === daily.length - 1)
      return daily[daily.length - 1].listens;
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
      x: { ticks: { color: "#ccc", maxTicksLimit: 8 }, grid: { display: false } },
    },
    plugins: {
      legend: { display: true, labels: { color: "#ccc", boxWidth: 12 } },
    },
  };
  return <Line data={data} options={options} />;
}

function Empty({ children }) {
  return <p className="text-sm text-white/40 py-4 text-center">{children}</p>;
}
