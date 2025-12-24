// src/pages/Profile.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Camera, Trash2 } from "lucide-react"; // <-- neu für Upload-Button
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
} from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
  }); // <-- profileImage hinzugefügt
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const [topSongs, setTopSongs] = useState([]);
  const [recentListens, setRecentListens] = useState([]);
  const [maxSongSeconds, setMaxSongSeconds] = useState(1); // Für Balken-Länge

  const [listeningStats, setListeningStats] = useState(null);
  const [topArtists, setTopArtists] = useState([]);

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
    api.get("/profile/listening-summary", { headers: getAuthHeaders() }),
    api.get("/profile/recent-listens", { headers: getAuthHeaders() }),
  ]);


        setListeningStats(listeningRes.data.stats);

        setTopSongs(listeningRes.data.topSongs);
        setMaxSongSeconds(
          Math.max(...listeningRes.data.topSongs.map((s) => s.total_seconds), 1),
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
        console.error("Fehler beim Laden der Daten:", err);
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          localStorage.clear();
          navigate("/login");
          return;
        }
        setError(
          "Konnte Profil oder Statistiken nicht laden – bitte versuche es später erneut",
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token, navigate]);

  // Neue Funktion: Profilbild hochladen
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Optional: Dateigröße und Typ prüfen
    if (file.size > 5 * 1024 * 1024) {
      // max 5 MB
      setError("Bild darf maximal 5 MB groß sein");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Nur Bilddateien erlaubt");
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
    } catch (err) {
      console.error("Fehler beim Hochladen des Bildes:", err);
      setError(
        err.response?.data?.error || "Bild konnte nicht hochgeladen werden",
      );
    }
  };

  // Neue Funktion: Profilbild löschen
  const handleDeleteImage = async () => {
    if (!confirm("Bist du sicher, dass du dein Profilbild löschen möchtest?")) {
      return;
    }

    try {
      setError("");
      await api.delete("/profile/image", {
        headers: getAuthHeaders(),
      });

      // Direkt im State auf null setzen → Fallback-Bild wird angezeigt
      setUserData((prev) => ({ ...prev, profileImage: null }));
      setSuccess(true);
    } catch (err) {
      console.error("Fehler beim Löschen des Profilbilds:", err);
      setError(
        err.response?.data?.error || "Profilbild konnte nicht gelöscht werden",
      );
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

      setUserData({ username: updatedUsername, email: updatedEmail });
      syncUserToLocalStorage(updatedUsername, updatedEmail);
      setSuccess(true);
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      if (err.response?.status === 401) {
        localStorage.clear();
        navigate("/login");
        return;
      }
      setError(
        err.response?.data?.error ||
          "Fehler beim Speichern – bitte überprüfe deine Eingaben",
      );
    }
  };

  // Direkt in Profile.jsx über oder unter den Imports einfügen
  function StatCard({ icon: Icon, value, label, gradientFrom, gradientTo }) {
    return (
      <div
        className={`backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 text-center hover:bg-white/15 transition-all`}
        style={{
          background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})`,
        }}
      >
        {Icon && <Icon className="w-10 h-10 mx-auto mb-3 text-white" />}
        <p className="text-3xl font-bold text-white">{value}</p>
        <p className="text-white/70 text-sm">{label}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 flex items-center justify-center">
        <div className="text-white text-2xl">
          Lade Profil und Statistiken...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 pt-20 pb-12">
      <div className="max-w-6xl mx-auto px-6">
        {/* Zurück-Button und Titel */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            to="/dashboard"
            className="p-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </Link>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Mein Profil
            </h1>
            <p className="text-white/70">Deine Daten und Voting-Statistiken</p>
          </div>
        </div>

        {/* Meldungen */}
        {success && (
          <div className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/50 text-green-300 text-center font-medium animate-pulse">
            Profil erfolgreich gespeichert!
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/50 text-red-300 text-center font-medium">
            {error}
          </div>
        )}

        {/* Profil-Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Links: Avatar + Name */}
          <div className="flex flex-col items-center lg:items-start">
            <div className="relative group">
              <div className="w-48 h-48 rounded-full overflow-hidden border-4 border-purple-500/50 shadow-2xl bg-black/50">
                {userData.profileImage &&
                typeof userData.profileImage === "string" &&
                userData.profileImage.startsWith("data:") ? (
                  <img
                    src={userData.profileImage}
                    alt="Profilbild"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-pink-600">
                    <User className="w-24 h-24 text-white/80" />
                  </div>
                )}
              </div>

              {/* Upload-Button (immer sichtbar beim Hover) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-14 p-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 transition-all opacity-0 group-hover:opacity-100"
                title="Profilbild hochladen"
              >
                <Camera className="w-5 h-5 text-white" />
              </button>

              {/* Lösch-Button (nur wenn Bild existiert) */}
              {userData.profileImage && (
                <button
                  type="button"
                  onClick={handleDeleteImage}
                  className="absolute bottom-2 right-2 p-3 rounded-full bg-red-600/80 backdrop-blur-md border border-red-500/50 hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                  title="Profilbild löschen"
                >
                  <Trash2 className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Versteckter File-Input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>

            <h2 className="mt-6 text-3xl font-bold text-white">
              {userData.username || "Unbekannt"}
            </h2>
            <p className="text-white/70">{userData.email}</p>
          </div>

          {/* Rechts: Statistiken */}
          <div className="lg:col-span-2 space-y-8">
            {/* Erste Reihe: Kern-Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 text-center hover:bg-white/15 transition-all">
                <Trophy className="w-10 h-10 text-yellow-400 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">
                  {stats?.winsAgainstQueue || 0}
                </p>
                <p className="text-white/70 text-sm">Gewinne gegen Queue</p>
              </div>

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 text-center hover:bg-white/15 transition-all">
                <Flame className="w-10 h-10 text-orange-400 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">
                  {stats?.maxStreakWinsAgainstQueue || 0}
                </p>
                <p className="text-white/70 text-sm">Längster Gewinn-Streak</p>
              </div>

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 text-center hover:bg-white/15 transition-all">
                <ThumbsUp className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">
                  {stats?.votesOnOwnSuggestions || 0}
                </p>
                <p className="text-white/70 text-sm">Votes auf eigene Songs</p>
              </div>

              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6 text-center hover:bg-white/15 transition-all">
                <Vote className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <p className="text-3xl font-bold text-white">
                  {stats?.votesOnOthersAndWon + stats?.votesOnOthersAndLost ||
                    0}
                </p>
                <p className="text-white/70 text-sm">Gesamtvotes (fremd)</p>
              </div>
            </div>

            {/* Zweite Reihe: Trends & Streaks mit Mini-Balken */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Erfolgreiche fremde Votes */}
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-8 h-8 text-green-400" />
                  <div>
                    <p className="text-white font-semibold">
                      Erfolgreiche Fremd-Votes
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.votesOnOthersAndWon || 0}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-white/70 mb-2">
                  Längster Streak: {stats?.maxStreakVotesOnWinningOthers || 0}{" "}
                  in Folge
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.min((stats?.maxStreakVotesOnWinningOthers || 0) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Verlorene fremde Votes */}
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-8 h-8 text-red-400" />
                  <div>
                    <p className="text-white font-semibold">
                      Verlorene Fremd-Votes
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.votesOnOthersAndLost || 0}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-white/70 mb-2">
                  Längster Streak: {stats?.maxStreakVotesOnLosingOthers || 0} in
                  Folge
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-700"
                    style={{
                      width: `${Math.min((stats?.maxStreakVotesOnLosingOthers || 0) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Passive Sessions */}
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Eye className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="text-white font-semibold">
                      Sessions ohne Vote
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.sessionsWithoutVote || 0}
                    </p>
                  </div>
                </div>
                <div className="text-sm text-white/70 mb-2">
                  Längster Passiv-Streak:{" "}
                  {stats?.maxStreakSessionsWithoutVote || 0}
                </div>
                <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-700"
                    style={{
                      width: `${Math.min((stats?.maxStreakSessionsWithoutVote || 0) * 8, 100)}%`,
                    }}
                  />
                </div>
              </div>

              {/* Eigene Vorschläge, die Votes bekamen aber verloren */}
              <div className="backdrop-blur-xl bg-white/10 rounded-2xl border border-white/20 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="text-white font-semibold">
                      Eigene Songs mit Votes
                    </p>
                    <p className="text-sm text-white/70">aber nicht gewonnen</p>
                    <p className="text-2xl font-bold text-white">
                      {stats?.votesOnOwnButLost || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          <StatCard
            icon={Headphones}
            value={`${listeningStats?.total_minutes || 0} min`}
            label="Hörzeit gesamt"
          />

          <StatCard
            icon={Music}
            value={listeningStats?.song_listens || 0}
            label="Songs gehört"
          />

          <StatCard
            icon={Users}
            value={listeningStats?.sessions_count || 0}
            label="Sessions aktiv"
          />

          <StatCard
            icon={Repeat}
            value={
              listeningStats
                ? Math.round(
                    listeningStats.song_listens /
                      Math.max(listeningStats.sessions_count, 1),
                  )
                : 0
            }
            label="Ø Songs / Session"
          />
        </div>

        {topArtists.length > 0 && (
          <div className="mt-10">
            <h3 className="text-2xl font-bold text-white mb-6">Top Artists</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topArtists.map((artist, i) => (
                <div
  key={artist.artist_id}
  onClick={() => navigate(`/artist/${artist.artist_id}`)}
  className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/20
             cursor-pointer hover:bg-white/20 transition-all"
>

                  {artist.image_url ? (
                    <img
                      src={artist.image_url}
                      alt={artist.name}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center">
                      <User className="w-7 h-7 text-white" />
                    </div>
                  )}

                  <div className="flex-1">
                    <p className="text-white font-medium">{artist.name}</p>
                    <p className="text-white/60 text-sm">
                      {Math.floor(artist.total_seconds / 60)} Minuten gehört
                    </p>
                  </div>

                  <span className="text-white/40 text-sm font-semibold">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {topSongs.map((song, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-4 rounded-xl bg-white/10 border border-white/20"
          >
            <img
              src={song.thumbnail}
              className="w-14 h-14 rounded-lg object-cover"
            />

            <div className="flex-1">
              <p className="text-white font-medium">{song.title}</p>
              <p className="text-white/60 text-sm">
                {Math.floor(song.total_seconds / 60)} Minuten
              </p>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  style={{
                    width: `${Math.min(
                      (song.total_seconds / maxSongSeconds) * 100,
                      100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}

        <ul className="space-y-3">
          {recentListens.map((l, i) => (
            <li
              key={i}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5"
            >
              <img src={l.thumbnail} className="w-12 h-12 rounded-md" />
              <div className="flex-1">
                <p className="text-white">{l.title}</p>
                <p className="text-white/60 text-sm">
                  {l.completed ? "Komplett gehört" : "Teilweise gehört"} ·{" "}
                  {Math.floor(l.listen_seconds / 60)} min
                </p>
              </div>
             <span className="text-white/40 text-xs flex items-center gap-1">
  <Clock className="w-4 h-4" />

  {(() => {
    const date = new Date(l.listened_from);

    const datePart = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const timePart = date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${datePart} · ${timePart}`;
  })()}
</span>

            </li>
          ))}
        </ul>

        {/* Bearbeitungsformular */}
        <form
          onSubmit={handleSubmit}
          className="max-w-2xl mx-auto backdrop-blur-xl bg-black/40 rounded-3xl border border-white/20 p-8 shadow-2xl space-y-6"
        >
          <div>
            <label className="flex items-center gap-3 text-white/90 font-medium mb-3">
              <User className="w-5 h-5 text-purple-400" />
              Benutzername
            </label>
            <input
              type="text"
              name="username"
              defaultValue={userData.username}
              required
              minLength={3}
              maxLength={50}
              className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-3 text-white/90 font-medium mb-3">
              <Mail className="w-5 h-5 text-purple-400" />
              E-Mail-Adresse
            </label>
            <input
              type="email"
              name="email"
              defaultValue={userData.email}
              required
              className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
            />
          </div>

          <div className="pt-6 border-t border-white/10">
            <h3 className="text-xl font-semibold text-white mb-4">
              Passwort ändern (optional)
            </h3>
            <div className="space-y-4">
              <input
                type="password"
                name="currentPassword"
                placeholder="Aktuelles Passwort"
                className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="password"
                  name="newPassword"
                  placeholder="Neues Passwort (min. 8 Zeichen)"
                  className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
                />
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Wiederholen"
                  className="w-full px-5 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-purple-400 transition-colors"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full mt-8 py-5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-purple-500/25"
          >
            <Save className="w-6 h-6" />
            Änderungen speichern
          </button>
        </form>
      </div>
    </div>
  );
}
