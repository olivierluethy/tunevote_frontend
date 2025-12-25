import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Music, Clock, User } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function ArtistDetail() {
  const { artistId } = useParams();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_URL}/user/${userId}`)
      .then((res) => {
        setArtist(res.data.user);
        setSongs(res.data.topSongs);
        setUsers(res.data.topUsers || []);
      })
      .catch((err) => console.error(err));
  }, [artistId]);

  if (!artist) return null;

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

        {/* Top Songs Listened */}
<h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
  <User className="w-6 h-6 text-purple-400" />
  Top Hörer
</h2>
<div className="space-y-3 mb-10">
  {users.map((user) => (
    <div
      key={user.id}
      className="p-4 rounded-xl bg-white/10 border border-white/20 flex items-center gap-4"
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


        {/* Shoutbox */}
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" />
          Shoutbox
        </h2>
        <p className="text-white/60">Hinterlasse einen Shout für User</p>

      </div>
    </div>
  );
}
