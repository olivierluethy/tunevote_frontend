import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Music, Clock } from "lucide-react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export default function ArtistDetail() {
  const { artistId } = useParams();
  const [artist, setArtist] = useState(null);
  const [songs, setSongs] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    axios
      .get(`${API_URL}/artist/${artistId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setArtist(res.data.artist);
        setSongs(res.data.topSongs);
      });
  }, [artistId]);

  if (!artist) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-black to-pink-900 pt-20 px-6">
      <div className="max-w-4xl mx-auto">

        <Link to="/profile" className="inline-flex items-center gap-2 text-white/70 hover:text-white mb-6">
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

        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <Music className="w-6 h-6 text-purple-400" />
          Top Songs von dir
        </h2>

        <div className="space-y-3">
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

      </div>
    </div>
  );
}
