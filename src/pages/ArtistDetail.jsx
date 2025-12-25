import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Music,
  Clock,
  User,
  X,
  Heart,
  MessageCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function ArtistDetail() {
  const { artistId } = useParams();

  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loggedUserData, setLoggedUserData] = useState(null);

  const [shouts, setShouts] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyToId, setReplyToId] = useState(null);

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
    await axios.post(
      `${API_URL}/artist/${artistId}/shouts`,
      { message: newMessage },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setNewMessage("");
    fetchShouts();
  };

  const handleLike = async (shoutId) => {
    await axios.post(
      `${API_URL}/shouts/${shoutId}/like`,
      {},
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

  /* ---------------- SHOUT COMPONENT ---------------- */

  function Shout({ shout, replies }) {
    const [replyMessage, setReplyMessage] = useState("");
    const [showReplies, setShowReplies] = useState(false);
    const INITIAL_REPLIES = 2;
    const [visibleReplies, setVisibleReplies] = useState(INITIAL_REPLIES);

    const handleReplySend = async () => {
      if (!replyMessage.trim()) return;
      await sendReply(replyMessage, shout.id);
      setReplyMessage("");
      setReplyToId(null);
    };

    return (
      <div className="pl-0 md:pl-4">
        <div className="p-4 rounded-xl bg-white/10 border border-white/20 mb-2">
          <div className="flex items-center gap-2 mb-2">
            {shout.profileImage ? (
              <img
                src={shout.profileImage}
                className="w-8 h-8 rounded-full object-cover border-2 border-purple-500/50"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <User className="w-4 h-4 text-purple-400" />
              </div>
            )}

            <span className="text-white font-medium">{shout.username}</span>

            <span className="text-white/50 text-sm ml-auto">
              {new Date(shout.created_at).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </div>

          <p className="text-white mb-3">{shout.message}</p>

          <div className="flex items-center gap-5 text-white/60 text-sm">
            <button
              onClick={() => handleLike(shout.id)}
              className="flex items-center gap-1 hover:text-red-400 transition"
            >
              <Heart className="w-4 h-4" />
              {shout.likes || 0}
            </button>

            {!shout.is_deleted && (
              <button
                onClick={() =>
                  setReplyToId(replyToId === shout.id ? null : shout.id)
                }
                className="hover:text-purple-400 transition"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            )}

            {String(shout.user_id) === String(userId) && !shout.is_deleted && (
              <button
                onClick={() => handleDeleteShout(shout.id)}
                className="hover:text-red-500 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>

          {replyToId === shout.id && (
            <div className="mt-3">
              <textarea
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                rows={2}
                placeholder="Write a reply…"
                className="w-full p-2 rounded-xl bg-white/10 text-white border border-white/20 focus:ring-2 focus:ring-purple-500"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={() => setReplyToId(null)}
                  className="text-white/50 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReplySend}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
                >
                  Reply
                </button>
              </div>
            </div>
          )}
        </div>

        {replies?.length > 0 && (
          <div className="mt-2 pl-4 border-l border-white/10">
            {!showReplies ? (
              <button
                onClick={() => setShowReplies(true)}
                className="flex items-center gap-1 text-purple-400 text-sm hover:underline"
              >
                <ChevronDown className="w-4 h-4" />
                View {replies.length} replies
              </button>
            ) : (
              <>
                {replies.slice(0, visibleReplies).map((r) => (
                  <div key={r.id} className="animate-fade-in">
                    <Shout shout={r} replies={r.replies} />
                  </div>
                ))}

                {visibleReplies < replies.length && (
                  <button
                    onClick={() =>
                      setVisibleReplies((v) => v + INITIAL_REPLIES)
                    }
                    className="text-purple-400 text-sm hover:underline mt-1"
                  >
                    Load more replies
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowReplies(false);
                    setVisibleReplies(INITIAL_REPLIES);
                  }}
                  className="flex items-center gap-1 text-white/40 text-sm mt-1"
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
        setSongs(res.data.topSongs);
        setUsers(res.data.topUsers || []);
        setLoggedUserData(res.data.loggedUser || null);
      });

    fetchShouts();
  }, [artistId, token]);

  if (!artist) return null;

  /* ---------------- RENDER ---------------- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 pt-20 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </Link>

        {/* Artist Header */}
        <div className="flex items-center gap-6 mb-10">
          <img
            src={artist.image_url}
            className="w-32 h-32 rounded-full object-cover border-4 border-purple-500/50"
          />
          <div>
            <h1 className="text-4xl font-bold text-white">{artist.name}</h1>
            <p className="text-white/60">
              {Math.floor(artist.total_seconds / 60)} minutes listened
            </p>
          </div>
        </div>

        {/* Top Songs */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" /> Top Songs
        </h2>
        <div className="space-y-3 mb-10">
          {songs.map((song) => (
            <div
              key={song.id}
              className="p-4 rounded-xl bg-white/10 border border-white/20"
            >
              <p className="text-white font-medium">{song.title}</p>
              <p className="text-white/60 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {Math.floor(song.total_seconds / 60)} minutes
              </p>
            </div>
          ))}
        </div>

        {/* Top Users */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" /> Top Listeners
        </h2>
        <div className="space-y-3 mb-10">
          {users.map((user) => (
            <div
              key={user.id}
              className="p-4 rounded-xl bg-white/10 border border-white/20 flex items-center gap-4 cursor-pointer hover:bg-white/20"
              onClick={() => setSelectedUser(user)}
            >
              {user.profileImage ? (
                <img
                  src={user.profileImage}
                  className="w-10 h-10 rounded-full object-cover border-2 border-purple-500/50"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-400" />
                </div>
              )}
              <div>
                <p className="text-white font-medium">{user.username}</p>
                <p className="text-white/60 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {Math.floor(user.total_seconds / 60)} minutes
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* User Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-purple-900 via-black to-pink-900 p-6 rounded-2xl w-full max-w-lg relative">
              <button
                className="absolute top-4 right-4 text-white"
                onClick={() => setSelectedUser(null)}
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 mb-4">
                {selectedUser.profileImage ? (
                  <img
                    src={selectedUser.profileImage}
                    className="w-16 h-16 rounded-full object-cover border-2 border-purple-500/50"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-8 h-8 text-purple-400" />
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white">
                  {selectedUser.username}
                </h3>
              </div>

              <p className="text-white/60">
                {Math.floor(selectedUser.total_seconds / 60)} minutes listened
                to {artist.name}
              </p>

              <Link
                to={`/user/${selectedUser.id}`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-500/70 text-white rounded-xl hover:bg-purple-600/80"
                onClick={() => setSelectedUser(null)}
              >
                View profile
              </Link>
            </div>
          </div>
        )}

        {/* Shoutbox */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" /> Shoutbox
        </h2>

        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Write a shout…"
          className="w-full p-3 rounded-xl bg-white/10 text-white border border-white/20 focus:ring-2 focus:ring-purple-500"
        />
        <button
          onClick={handleSend}
          className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
        >
          Post
        </button>

        <div className="mt-6 space-y-2">
          {threadedShouts.map((s) => (
            <Shout key={s.id} shout={s} replies={s.replies} />
          ))}
        </div>
      </div>
    </div>
  );
}
