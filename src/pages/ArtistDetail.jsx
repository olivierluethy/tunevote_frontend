import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Music, Clock, User, X, Heart } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function ArtistDetail() {
  const { artistId } = useParams();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // Für Modal
  const [loggedUserData, setLoggedUserData] = useState(null);

  const [shouts, setShouts] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyTo, setReplyTo] = useState(null);

  const token = localStorage.getItem("token");
  const [replyToId, setReplyToId] = useState(null);

  const sendReply = async (message, parentId) => {
    if (!message.trim()) return;
    try {
      await axios.post(
        `${API_URL}/artist/${artistId}/shouts`,
        { message, parent_id: parentId },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      fetchShouts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteShout = async (shoutId) => {
    if (!confirm("Willst du diesen Kommentar wirklich löschen?")) return;
    try {
      await axios.delete(`${API_URL}/shouts/${shoutId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchShouts();
    } catch (err) {
      console.error(err);
    }
  };

  function Shout({
    shout,
    replies,
    onLikeClick,
    onReplyClick,
    replyToId,
    setReplyToId,
    sendReply,
  }) {
    const [replyMessage, setReplyMessage] = useState("");

    const handleReplySend = async () => {
      if (!replyMessage.trim()) return;
      if (replyMessage.length > 1000) {
        alert("Maximal 1000 Zeichen erlaubt");
        return;
      }
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
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-purple-400">
                <User className="w-4 h-4" />
              </div>
            )}
            <span className="text-white font-medium">{shout.username}</span>
            <span className="text-white/60 text-sm ml-auto">
              {new Date(shout.created_at).toLocaleString()}
            </span>
          </div>
          <p className="text-white mb-2">{shout.message}</p>
          <div className="flex items-center gap-4 text-white/70 text-sm">
            <button
              onClick={() => onLikeClick(shout.id)}
              className="flex items-center gap-1 hover:text-red-400 transition"
            >
              <Heart className="w-4 h-4" /> {shout.likes || 0}
            </button>
            {!shout.is_deleted && (
              <>
                <button
                  onClick={() =>
                    setReplyToId(replyToId === shout.id ? null : shout.id)
                  }
                  className="hover:text-purple-400 transition"
                >
                  Antworten
                </button>
                {shout.user_id === loggedUserData?.id && (
                  <button
                    onClick={() => handleDeleteShout(shout.id)}
                    className="hover:text-red-500 transition ml-2"
                  >
                    🗑️
                  </button>
                )}
              </>
            )}
          </div>

          {/* Antwort-Input direkt unter dem Shout */}
          {replyToId === shout.id && (
            <div className="mt-2">
              <textarea
                value={replyMessage}
                onChange={(e) =>
                  e.target.value.length <= 1000 &&
                  setReplyMessage(e.target.value)
                }
                placeholder="Schreibe eine Antwort..."
                className="w-full p-2 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={2}
              />
              <div className="flex justify-end mt-1 gap-2">
                <button
                  onClick={() => setReplyToId(null)}
                  className="px-3 py-1 bg-red-500/70 hover:bg-red-600 rounded-xl text-white text-sm"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleReplySend}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded-xl text-white text-sm"
                >
                  Antworten
                </button>
              </div>
            </div>
          )}
        </div>

        {replies && replies.length > 0 && (
          <div className="pl-4 border-l border-white/10">
            {replies.map((r) => (
              <Shout
                key={r.id}
                shout={r}
                replies={r.replies}
                onLikeClick={onLikeClick}
                onReplyClick={onReplyClick}
                replyToId={replyToId}
                setReplyToId={setReplyToId}
                sendReply={sendReply}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const fetchShouts = async () => {
    try {
      const res = await axios.get(`${API_URL}/artist/${artistId}/shouts`);
      setShouts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    try {
      await axios.post(
        `${API_URL}/artist/${artistId}/shouts`,
        { message: newMessage, parent_id: replyTo },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      setNewMessage("");
      setReplyTo(null);
      fetchShouts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLike = async (shoutId) => {
    try {
      await axios.post(
        `${API_URL}/shouts/${shoutId}/like`,
        {},
        {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      fetchShouts();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReply = (shoutId) => {
    setReplyTo(shoutId);
  };

  // Hilfsfunktion: verschachtelte Struktur aus flacher Liste bauen
  const buildThread = (list, parentId = null) =>
    list
      .filter((s) => s.parent_id === parentId)
      .map((s) => ({ ...s, replies: buildThread(list, s.id) }));

  const threadedShouts = buildThread(shouts);

  useEffect(() => {
    axios
      .get(`${API_URL}/artist/${artistId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      .then((res) => {
        setArtist(res.data.artist);
        setSongs(res.data.topSongs);
        setUsers(res.data.topUsers || []);
        setLoggedUserData(res.data.loggedUser || null); // optional
      })
      .catch((err) => console.error(err));
    fetchShouts(); // <-- Shouts laden
  }, [artistId, token]);

  if (!artist) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 pt-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Zurück */}
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Zurück zum Profil
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
              {Math.floor(artist.total_seconds / 60)} Minuten gehört
            </p>
          </div>
        </div>

        {/* Top Songs */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" /> Top Titel
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
                {Math.floor(song.total_seconds / 60)} Minuten
              </p>
            </div>
          ))}
        </div>

        {/* Top Users */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" /> Top Hörer
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
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-purple-400">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-white font-medium">{user.username}</p>
                <p className="text-white/60 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {Math.floor(user.total_seconds / 60)} Minuten gehört
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Modal für User-Details */}
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
                  <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-purple-400">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white">
                  {selectedUser.username}
                </h3>
              </div>

              <div className="space-y-3">
                <p className="text-white/60">
                  Insgesamt {Math.floor(selectedUser.total_seconds / 60)}{" "}
                  Minuten von {artist.name} gehört
                </p>
                {loggedUserData && selectedUser.id === loggedUserData.id && (
                  <p className="text-white/60 font-medium">
                    Du hast {Math.floor(loggedUserData.total_seconds / 60)}{" "}
                    Minuten gehört – dein Ranking berücksichtigt dies
                  </p>
                )}
                {loggedUserData && selectedUser.id !== loggedUserData.id && (
                  <p className="text-white/60 font-medium">
                    Du hast {Math.floor(loggedUserData.total_seconds / 60)}{" "}
                    Minuten gehört – Vergleich zu diesem User
                  </p>
                )}
              </div>

              <Link
                to={`/user/${selectedUser.id}`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-purple-500/70 text-white rounded-xl hover:bg-purple-600/80"
                onClick={() => setSelectedUser(null)}
              >
                Zur Userübersicht
              </Link>
            </div>
          </div>
        )}

        {/* Shoutbox */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" /> Shoutbox
        </h2>

        <div className="mb-4">
          {replyTo && (
            <p className="text-white/60 mb-1">
              Antwort auf Shout #{replyTo}{" "}
              <button
                onClick={() => setReplyTo(null)}
                className="text-red-400 ml-2"
              >
                Abbrechen
              </button>
            </p>
          )}
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Schreibe einen Shout..."
            className="w-full p-3 rounded-xl bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            rows={3}
          />
          <button
            onClick={handleSend}
            className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition"
          >
            Absenden
          </button>
        </div>

        <div className="space-y-2">
          {threadedShouts.map((s) => (
            <Shout
              key={s.id}
              shout={s}
              replies={s.replies}
              onLikeClick={handleLike}
              replyToId={replyToId}
              setReplyToId={setReplyToId}
              sendReply={sendReply}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
