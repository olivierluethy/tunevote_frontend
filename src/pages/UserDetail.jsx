import { useParams, Link } from "react-router-dom";
import { act, useEffect, useState } from "react";
import { ArrowLeft, Music, Clock, User } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function UserDetail() {
  const { userId } = useParams();

  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [users, setUsers] = useState([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionWithoutVote, setSessionWithoutVote] = useState(0);
  const [votesOnOwnSuggestions, setVotesOnOwnSuggestions] = useState(0);
  const [liveSessions, setLiveSessions] = useState(0);
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_URL}/user/${userId}`)
      .then((res) => {
        setUser(res.data.user);
        setSongs(res.data.topSongs);
        setUsers(res.data.topUsers || []);
        setSessionCount(res.data.sessionCount || 0);
        setSessionWithoutVote(
          res.data.sessionWithoutVote?.[0]?.session_count || 0,
        );
        setVotesOnOwnSuggestions(
          res.data.votesOnOwnSuggestions?.[0]?.count || 0,
        );
        setLiveSessions(res.data.liveSessions?.[0]?.count || 0);
        setActiveSession(res.data.activeSession || 0);
      })
      .catch(console.error);
  }, [userId]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 pt-20 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          to="/profile"
          className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          Zurück zum Profil
        </Link>

        <div className="flex items-center gap-6 mb-10">
          {user.image_url ? (
            <img
              src={user.image_url}
              className="w-32 h-32 rounded-full object-cover border-4 border-purple-500/50"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center">
              <User className="w-10 h-10 text-purple-400" />
            </div>
          )}

          <div>
            <h1 className="text-4xl font-bold text-white">{user.username}</h1>
            <p className="text-white/60">
              {Math.floor(user.total_seconds / 60)} Minuten gehört
            </p>
          </div>
        </div>

        {/* Top Hörer */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          Stats
        </h2>

        {/* Numbers of sessions joined */}
        <p>{sessionCount} Sessions beigetreten</p>

        <p>Has joined so many sessions</p>
        <p>Gewinne gegen Queue</p>
        <p>Längster Gewinn Streak</p>
        <p>Votes auf eigene Songs {votesOnOwnSuggestions}</p>
        <p>Gesamtvotes (fremd)</p>
        <p>Erfolgreiche Fremd-Votes</p>
        <p>Verlorene Fremd-Votes</p>
        <p>Sessions ohne Vote {sessionWithoutVote}</p>
        <p>Eigene Songs mit Votes</p>
        <p>Global User Ranking</p>
        <p>Global Weekly Ranking</p>
        <p>Global Daily Ranking</p>

        <p>Hörzeit gesamt</p>
        <p>Songs gehört</p>
        <p>Sessions aktiv {liveSessions}</p>
        <p>Ø Songs / Session</p>

        <p>Currently listening in this session:</p>
        {activeSession?.live && (
          <div className="mb-6">
            {activeSession.is_private ? (
              <div className="p-4 rounded-xl bg-red-500/20 border border-red-400/30 text-white">
                🔴 Gerade live in einer privaten Session
              </div>
            ) : (
              <Link
                to={activeSession.join_url}
                className="block p-4 rounded-xl bg-green-500/20 border border-green-400/30 hover:bg-green-500/30 transition"
              >
                <p className="text-white font-semibold">
                  🔴 Live in: {activeSession.name}
                </p>
                <p className="text-white/70 text-sm">
                  👥 {activeSession.participant_count} Zuhörer gerade dabei
                </p>
                <p className="text-white/50 text-xs mt-1">
                  Klicken um beizutreten
                </p>
              </Link>
            )}
          </div>
        )}

        {/* Anzeigen ab wann diese Person verhältnissmässig zu dir in keinen sessions drin ist, um diese Zeit zu nutzen, um dein allgemeines Ranking zu erhöhen. */}

        {/* Top Hörer */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          Top Artists
        </h2>

        <div className="space-y-3 mb-10">
          {users.map((u) => (
            <div
              key={u.id}
              className="p-4 rounded-xl bg-white/10 border border-white/20 flex items-center gap-4"
            >
              {u.profileImage ? (
                <img
                  src={`data:image/jpeg;base64,${u.profileImage}`}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5 text-purple-400" />
              )}
              <div>
                <p className="text-white font-medium">{u.username}</p>
                <p className="text-white/60 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {Math.floor(u.total_seconds / 60)} Minuten gehört
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Top Hörer */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-6 h-6 text-purple-400" />
          Top Similar Users
        </h2>

        {/* Shoutbox */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" />
          Shoutbox
        </h2>
        <p className="text-white/60">Hinterlasse einen Shout für diesen User</p>
      </div>
    </div>
  );
}
