// src/pages/SessionLive.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Search,
  Plus,
  Share2,
  ArrowLeft,
  Radio,
  Clock,
  User,
  Music,
  Zap,
  Timer,
  Mic,
  Sparkles,
  Copy,
  Check,
  X,
} from "lucide-react";

const SOCKET_SERVER = "https://api.tunevote.com/";

export default function SessionLive() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const pauseTimerRef = useRef(null);

  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [pauseDuration, setPauseDuration] = useState(30);
  const [pauseDescription, setPauseDescription] = useState("Kurze Pause");

  const [isPaused, setIsPaused] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseTitle, setPauseTitle] = useState("");

  const [isHost, setIsHost] = useState(false);
  const [nickname, setNickname] = useState(() => localStorage.getItem("guestName") || "Gast");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMutedForMe, setIsMutedForMe] = useState(() => localStorage.getItem(`mute_${sessionId}`) === "true");
  const [isLiveJoined, setIsLiveJoined] = useState(false);
  const [sessionLive, setSessionLive] = useState(false);
  const [copied, setCopied] = useState(false);

  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const userId = localStorage.getItem("userId");

  const getAuthHeaders = () => {
    const headers = {};
    if (token && !guestToken) headers.Authorization = `Bearer ${token}`;
    else if (guestToken && !token) headers["x-guest-token"] = guestToken;
    return headers;
  };

  const loadSessionData = useCallback(async () => {
    try {
      const [sessRes, queueRes] = await Promise.all([
        axios.get(`https://api.tunevote.com/sessions/${sessionId}`, { headers: getAuthHeaders() }),
        axios.get(`https://api.tunevote.com/sessions/${sessionId}/queue`, { headers: getAuthHeaders() }),
      ]);
      setSession(sessRes.data);
      setQueue(queueRes.data || []);
      setIsHost(sessRes.data.hostId === Number(userId));
      setSessionLive(!!sessRes.data.is_live);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) setShowGuestModal(true);
      else if (err.response?.status === 404) navigate("/dashboard");
    }
  }, [sessionId, userId, navigate]);

  useEffect(() => {
    if (token || guestToken) {
      loadSessionData();
      const interval = setInterval(loadSessionData, 10000);
      return () => clearInterval(interval);
    } else {
      setShowGuestModal(true);
    }
  }, [loadSessionData, token, guestToken]);

  // Socket.IO
  useEffect(() => {
    if (!token && !guestToken) return;

    socketRef.current = io(SOCKET_SERVER, {
      query: { sessionId },
      auth: token ? { token } : { guestToken },
    });

    socketRef.current.on("queue_updated", loadSessionData);
    socketRef.current.on("session_started", (data) => {
      loadSessionData();
      setSessionLive(true);
      if (isLiveJoined && data.firstVideoId) {
        syncPlayback({ current_video_id: data.firstVideoId, video_start_time: data.video_start_time, is_playing: true });
      }
    });

    socketRef.current.on("playback_sync", (data) => isLiveJoined && syncPlayback(data));

    socketRef.current.on("session_ended", () => {
      setIsLiveJoined(false);
      setCurrentSong(null);
      setSessionLive(false);
      if (playerRef.current) playerRef.current.destroy();
      loadSessionData();
    });

    socketRef.current.on("pause_started", ({ title, duration }) => {
      setIsPaused(true);
      setPauseTitle(title);
      setPauseRemaining(duration);
      playerRef.current?.pauseVideo();

      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = setInterval(() => {
        setPauseRemaining((prev) => (prev <= 1 ? (clearInterval(pauseTimerRef.current), 0) : prev - 1));
      }, 1000);
    });

    socketRef.current.on("pause_ended", () => {
      setIsPaused(false);
      setPauseRemaining(0);
      setPauseTitle("");
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
      playerRef.current?.playVideo();
    });

    return () => socketRef.current.disconnect();
  }, [sessionId, token, guestToken, loadSessionData, isLiveJoined]);

  // YouTube API
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = () => {};
    return () => playerRef.current?.destroy();
  }, []);

  const createPlayer = (videoId, startSeconds = 0, shouldPlay = false) => {
    if (playerRef.current) {
      playerRef.current.loadVideoById({ videoId, startSeconds });
      if (shouldPlay) playerRef.current.playVideo();
      return;
    }

    playerRef.current = new window.YT.Player("youtube-player", {
      height: 0,
      width: 0,
      videoId,
      playerVars: { start: Math.floor(startSeconds), autoplay: shouldPlay ? 1 : 0, controls: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          playerRef.current.seekTo(startSeconds, true);
          if (shouldPlay) playerRef.current.playVideo();
          playerRef.current.setVolume(isMutedForMe ? 0 : volume);
        },
      },
    });
  };

  const syncPlayback = ({ current_video_id, video_start_time, is_playing }) => {
    if (!current_video_id || !video_start_time) return;
    const elapsed = Math.max(0, (Date.now() - video_start_time) / 1000);
    const song = queue.find((i) => i.video_id === current_video_id);

    setCurrentSong({
      videoId: current_video_id,
      title: song?.title || "Unbekannt",
      thumbnail: song?.thumbnail || "",
    });

    createPlayer(current_video_id, elapsed, is_playing);
  };

  // === Join Live ===
  const joinLive = async () => {
    if (!sessionLive) return;
    setIsLiveJoined(true);

    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/join-live`,
        {},
        { headers: getAuthHeaders() },
      );
      const { data } = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
      );

      if (data.current_video_id && data.video_start_time) {
        syncPlayback(data);
      }
    } catch (err) {
      console.error("Sync failed", err);
      setIsLiveJoined(false); // Revert on error
      loadSessionData(); // Reload to ensure UI consistency
    }

    syncIntervalRef.current = setInterval(async () => {
      if (!isLiveJoined) return;
      try {
        const { data } = await axios.get(
          `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
        );
        if (data.current_video_id && data.video_start_time) {
          const elapsed = (Date.now() - data.video_start_time) / 1000;
          const current = playerRef.current?.getCurrentTime() || 0;
          if (Math.abs(current - elapsed) > 2) {
            playerRef.current?.seekTo(elapsed, true);
          }
        }
      } catch {}
    }, 10000);
  };

  // === Leave Live ===
  const leaveLive = async () => {
    setIsLiveJoined(false);
    setCurrentSong(null); // Clear current song to hide "Now Playing" section
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (playerRef.current) {
      playerRef.current.pauseVideo();
      playerRef.current.destroy();
      playerRef.current = null;
    }
    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/leave-live`,
        {},
        { headers: getAuthHeaders() },
      );
      await loadSessionData(); // Reload to restore UI state
    } catch (err) {
      console.error("Leave failed", err);
      await loadSessionData(); // Reload even on error to ensure UI consistency
    }
  };

  const startSession = async () => {
    if (!isHost) return;
    if (playerRef.current) playerRef.current.destroy();
    try {
      await axios.post(`https://api.tunevote.com/sessions/${sessionId}/start`, {}, { headers: getAuthHeaders() });
      loadSessionData();
    } catch (err) {
      alert("Fehler beim Starten");
    }
  };

  const goBack = async () =>{
    setIsLiveJoined(false);
    setCurrentSong(null); // Clear current song to hide "Now Playing" section
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (playerRef.current) {
      playerRef.current.pauseVideo();
      playerRef.current.destroy();
      playerRef.current = null;
    }
    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/leave-live`,
        {},
        { headers: getAuthHeaders() },
      );
      await loadSessionData(); // Reload to restore UI state
    } catch (err) {
      console.error("Leave failed", err);
      await loadSessionData(); // Reload even on error to ensure UI consistency
    }
    navigate("/dashboard")
  }

  const handleVolumeChange = (e) => {
    const vol = parseInt(e.target.value);
    setVolume(vol);
    playerRef.current?.setVolume(isMutedForMe ? 0 : vol);
  };

  const togglePersonalMute = () => {
    const next = !isMutedForMe;
    setIsMutedForMe(next);
    localStorage.setItem(`mute_${sessionId}`, next);
    playerRef.current?.setVolume(next ? 0 : volume);
  };

  const searchYouTube = async () => {
    if (!searchQuery.trim()) return;
    const API_KEY = import.meta.env.VITE_YOUTUBE_KEY;
    if (!API_KEY) return;
    try {
      const res = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: { part: "snippet", type: "video", maxResults: 5, q: searchQuery, key: API_KEY },
      });
      setSearchResults(res.data.items);
    } catch (err) {
      console.error(err);
    }
  };

  const proposeSong = async (video) => {
    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/proposals`,
        { videoId: video.id.videoId, title: video.snippet.title, thumbnail: video.snippet.thumbnails.medium.url },
        { headers: getAuthHeaders() }
      );
      setSearchResults([]);
      setSearchQuery("");
      loadSessionData();
    } catch (err) {
      alert("Fehler beim Vorschlag");
    }
  };

  const handleGuestJoin = async () => {
    if (!nickname.trim()) return;
    try {
      const res = await axios.post("https://api.tunevote.com/guest/join", { nickname });
      localStorage.setItem("guestToken", res.data.guestToken);
      localStorage.setItem("guestName", nickname);
      setShowGuestModal(false);
      loadSessionData();
    } catch (err) {
      console.error(err);
    }
  };

  const shareLink = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: session.title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="backdrop-blur-2xl bg-white/10 rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
        >
          <div className="text-center mb-8">
            <Mic className="w-16 h-16 mx-auto mb-4 text-purple-400" />
            <h2 className="text-3xl font-bold text-white mb-2">Willkommen!</h2>
            <p className="text-gray-300">Gib deinen Namen ein, um beizutreten</p>
          </div>
          <input
            type="text"
            placeholder="Dein Name"
            className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none transition-all text-lg"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleGuestJoin()}
          />
          <button
            onClick={handleGuestJoin}
            className="mt-6 w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-lg flex items-center justify-center space-x-3 hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            <span>Beitreten</span>
          </button>
        </motion.div>
      </div>
    );
  }

  if (!session) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-white text-2xl">Lade Session...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-x-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-20">
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-pink-600 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="backdrop-blur-xl bg-black/30 rounded-3xl p-6 mb-8 border border-white/10"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                {session.title}
              </h1>
              <p className="text-gray-300 mt-1 flex items-center gap-2">
                <User className="w-4 h-4" />
                {nickname} {isHost && <span className="text-purple-400">(Host)</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {sessionLive ? (
                <div className="px-4 py-2 bg-green-600/20 border border-green-500/50 rounded-full flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></div>
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <span className="font-bold">LIVE</span>
                </div>
              ) : (
                <div className="px-4 py-2 bg-yellow-600/20 border border-yellow-500/50 rounded-full flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Warte auf Host</span>
                </div>
              )}
              {isHost && !sessionLive && (
                <button
                  onClick={startSession}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold flex items-center gap-2 hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
                >
                  <Zap className="w-5 h-5" />
                  Session starten
                </button>
              )}
              <button
                onClick={goBack}
                className="p-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Share & Join */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="backdrop-blur-2xl bg-white/10 rounded-3xl p-6 mb-8 border border-white/20"
        >
          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <div className="p-4 bg-white/10 rounded-2xl border border-white/20">
              <QRCodeCanvas value={window.location.href} size={100} />
            </div>
            <button
              onClick={shareLink}
              className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
            >
              {copied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5 group-hover:scale-110 transition-transform" />}
              <span>{copied ? "Kopiert!" : "Link teilen"}</span>
            </button>
            {sessionLive && (
              <button
                onClick={isLiveJoined ? leaveLive : joinLive}
                className={`px-8 py-3 rounded-2xl font-bold flex items-center gap-3 transition-all ${
                  isLiveJoined
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {isLiveJoined ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                <span>{isLiveJoined ? "Verlassen" : "Live beitreten"}</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Live Status */}
        <AnimatePresence>
          {sessionLive && isLiveJoined && (
            <>
              {isPaused ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="backdrop-blur-2xl bg-yellow-600/20 rounded-3xl p-6 mb-8 border border-yellow-500/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Timer className="w-8 h-8 text-yellow-400" />
                      <div>
                        <h3 className="text-xl font-bold">{pauseTitle || "Pause"}</h3>
                        <p className="text-3xl font-bold">{pauseRemaining}s</p>
                      </div>
                    </div>
                    <svg className="w-32 h-32">
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="rgba(255,255,255,0.2)"
                        strokeWidth="12"
                        fill="none"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="56"
                        stroke="#fbbf24"
                        strokeWidth="12"
                        fill="none"
                        strokeDasharray={`${(pauseRemaining / pauseDuration) * 352} 352`}
                        className="transition-all duration-1000"
                        transform="rotate(-90 64 64)"
                      />
                    </svg>
                  </div>
                </motion.div>
              ) : currentSong ? (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="backdrop-blur-2xl bg-green-600/20 rounded-3xl p-6 mb-8 border border-green-500/50"
                >
                  <div className="flex items-center gap-6">
                    <img src={currentSong.thumbnail} alt="" className="w-24 h-24 rounded-2xl shadow-2xl" />
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        <Music className="w-6 h-6 text-green-400" />
                        Jetzt läuft
                      </h3>
                      <p className="text-xl mt-1">{currentSong.title}</p>
                      <p className="text-sm text-gray-300 mt-2">Live mit allen Teilnehmern</p>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </>
          )}
        </AnimatePresence>

        {/* Volume */}
        {isLiveJoined && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="backdrop-blur-2xl bg-white/10 rounded-3xl p-6 mb-8 border border-white/20"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={togglePersonalMute}
                className={`p-3 rounded-xl transition-all ${isMutedForMe ? "bg-red-600" : "bg-white/20"}`}
              >
                {isMutedForMe ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="flex-1 h-2 bg-white/20 rounded-full appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #a855f7 0%, #a855f7 ${volume}%, rgba(255,255,255,0.2) ${volume}%, rgba(255,255,255,0.2) 100%)`,
                }}
              />
              <span className="w-12 text-right font-mono">{volume}%</span>
            </div>
          </motion.div>
        )}

        {/* Search */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="backdrop-blur-2xl bg-white/10 rounded-3xl p-6 mb-8 border border-white/20"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Search className="w-5 h-5" />
            YouTube Suche
          </h2>
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Song suchen..."
              className="flex-1 px-5 py-3 rounded-2xl bg-white/10 border border-white/20 placeholder-gray-400 focus:border-purple-400 focus:outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && searchYouTube()}
            />
            <button
              onClick={searchYouTube}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold hover:shadow-lg hover:shadow-purple-500/50 transition-all"
            >
              Suchen
            </button>
          </div>
          <AnimatePresence>
            {searchResults.map((video, i) => (
              <motion.div
                key={video.id.videoId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all group"
              >
                <img src={video.snippet.thumbnails.default.url} alt="" className="w-16 h-16 rounded-xl" />
                <div className="flex-1">
                  <p className="font-medium group-hover:text-purple-300 transition-colors">{video.snippet.title}</p>
                </div>
                <button
                  onClick={() => proposeSong(video)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 font-medium text-sm transition-all"
                >
                  Vorschlagen
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Add Pause */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="backdrop-blur-2xl bg-white/10 rounded-3xl p-6 mb-8 border border-white/20"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Timer className="w-5 h-5" />
            Pause hinzufügen
          </h2>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="number"
              min="5"
              value={pauseDuration}
              onChange={(e) => setPauseDuration(Number(e.target.value))}
              className="w-24 px-4 py-3 rounded-2xl bg-white/10 border border-white/20 focus:border-purple-400 focus:outline-none transition-all"
            />
            <span className="text-gray-300">Sekunden</span>
            <input
              type="text"
              value={pauseDescription}
              onChange={(e) => setPauseDescription(e.target.value)}
              placeholder="z.B. Getränke holen"
              className="flex-1 min-w-[200px] px-5 py-3 rounded-2xl bg-white/10 border border-white/20 placeholder-gray-400 focus:border-purple-400 focus:outline-none transition-all"
            />
            <button
              onClick={async () => {
                try {
                  await axios.post(
                    `https://api.tunevote.com/sessions/${sessionId}/proposals`,
                    { item_type: "pause", duration: pauseDuration, description: pauseDescription },
                    { headers: getAuthHeaders() }
                  );
                  loadSessionData();
                  setPauseDescription("Kurze Pause");
                } catch (err) {
                  alert("Fehler");
                }
              }}
              className="px-6 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-600 text-black font-bold transition-all"
            >
              Hinzufügen
            </button>
          </div>
        </motion.div>

        {/* Queue */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="backdrop-blur-2xl bg-white/10 rounded-3xl p-6 border border-white/20"
        >
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Radio className="w-5 h-5" />
            Warteschlange
          </h2>
          {queue.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Noch leer – schlage Songs vor!</p>
          ) : (
            <div className="space-y-3">
              {queue.map((item, i) => {
                const isCurrent = currentSong?.videoId === item.video_id && isLiveJoined;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                      isCurrent
                        ? "bg-green-600/20 border-2 border-green-500 shadow-lg shadow-green-500/20"
                        : item.item_type === "pause"
                        ? "bg-yellow-600/10 border-l-4 border-yellow-500"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {isCurrent && (
                      <div className="flex items-center gap-2 text-green-400 font-bold animate-pulse">
                        <div className="relative">
                          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></div>
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                        LIVE
                      </div>
                    )}
                    {item.item_type === "music" && (
                      <img src={item.thumbnail} alt="" className="w-12 h-12 rounded-xl" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">
                        {item.item_type === "pause"
                          ? `${item.description || "Pause"} – ${item.duration}s`
                          : item.title}
                      </p>
                      <p className="text-sm text-gray-400">von {item.addedBy || "Gast"}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {isLiveJoined && <div id="youtube-player" className="hidden"></div>}
    </div>
  );
}