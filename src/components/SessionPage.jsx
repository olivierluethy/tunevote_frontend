// src/components/SessionPage.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

const SOCKET_SERVER = "http://localhost:4000";

const SessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const syncIntervalRef = useRef(null);

  const [session, setSession] = useState(null);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [nickname, setNickname] = useState("Gast");
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMutedForMe, setIsMutedForMe] = useState(
    () => localStorage.getItem(`mute_${sessionId}`) === "true",
  );
  const [isLiveJoined, setIsLiveJoined] = useState(false);
  const [sessionLive, setSessionLive] = useState(false);

  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const userId = localStorage.getItem("userId");

  const getAuthHeaders = () => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (guestToken) headers["x-guest-token"] = guestToken;
    return headers;
  };

  const loadSessionData = useCallback(async () => {
    try {
      const [sessRes, queueRes] = await Promise.all([
        axios.get(`http://localhost:4000/sessions/${sessionId}`, {
          headers: getAuthHeaders(),
        }),
        axios.get(`http://localhost:4000/sessions/${sessionId}/queue`, {
          headers: getAuthHeaders(),
        }),
      ]);

      setSession(sessRes.data);
      setQueue(queueRes.data || []);
      setIsHost(sessRes.data.hostId === Number(userId));
      setSessionLive(!!sessRes.data.is_live);
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403)
        setShowGuestModal(true);
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

  // === Socket.IO ===
  useEffect(() => {
    if (!token && !guestToken) return;

    socketRef.current = io(SOCKET_SERVER, {
      query: { sessionId },
      auth: token ? { token } : { guestToken },
    });

    socketRef.current.on("connect_error", (err) =>
      console.warn("Socket error", err),
    );
    socketRef.current.on("queue_updated", loadSessionData);
    socketRef.current.on("session_started", () => {
      loadSessionData();
      setIsLiveJoined(false);
    });

    socketRef.current.on("playback_sync", (data) => {
      if (!isLiveJoined) return;
      syncPlayback(data);
    });

    socketRef.current.on("session_ended", ({ message }) => {
      alert(message); // Or update UI to show session ended
      setIsLiveJoined(false); // Stop joining live session
      setCurrentSong(null); // Clear current song
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current); // Stop sync interval
      if (playerRef.current) {
        playerRef.current.stopVideo(); // Stop YouTube player
        playerRef.current.destroy(); // Destroy player instance
        playerRef.current = null; // Clear player reference
      }
      setSessionLive(false); // Update UI to reflect session ended
      loadSessionData(); // Refresh session data
    });

    return () => socketRef.current.disconnect();
  }, [sessionId, token, guestToken, loadSessionData, isLiveJoined]);

  // === YouTube Player API laden ===
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube API ready");
    };

    return () => {
      if (playerRef.current) playerRef.current.destroy();
    };
  }, []);

  // === Player erstellen (für alle Clients) ===
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
      playerVars: {
        start: Math.floor(startSeconds),
        autoplay: shouldPlay ? 1 : 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
      },
      events: {
        onReady: () => {
          playerRef.current.seekTo(startSeconds, true);
          if (shouldPlay) playerRef.current.playVideo();
          playerRef.current.setVolume(isMutedForMe ? 0 : volume);
        },
        onStateChange: (e) => {
          if (e.data === window.YT.PlayerState.ENDED && isHost) {
            playNextSong();
          }
        },
      },
    });
  };

  // === Sync Playback ===
  const syncPlayback = ({ current_video_id, video_start_time, is_playing }) => {
    if (!current_video_id || !video_start_time) return;

    const elapsed = (Date.now() - video_start_time) / 1000;
    const progress = Math.max(0, elapsed);

    setCurrentSong({
      videoId: current_video_id,
      title:
        queue.find((i) => i.video_id === current_video_id)?.title ||
        "Unbekannt",
      thumbnail:
        queue.find((i) => i.video_id === current_video_id)?.thumbnail || "",
    });

    createPlayer(current_video_id, progress, is_playing);
  };

  // === Join Live ===
  const joinLive = async () => {
    if (!sessionLive) return;
    setIsLiveJoined(true);

    try {
      const { data } = await axios.get(
        `http://localhost:4000/sessions/${sessionId}/playback-sync`,
        {
          headers: getAuthHeaders(),
        },
      );

      if (data.current_video_id && data.video_start_time) {
        syncPlayback(data);
      }
    } catch (err) {
      console.error("Sync failed", err);
    }

    // Alle 10s nachsync (Drift-Korrektur)
    syncIntervalRef.current = setInterval(async () => {
      if (!isLiveJoined) return;
      try {
        const { data } = await axios.get(
          `http://localhost:4000/sessions/${sessionId}/playback-sync`,
          {
            headers: getAuthHeaders(),
          },
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

  const leaveLive = () => {
    setIsLiveJoined(false);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (playerRef.current) {
      playerRef.current.pauseVideo();
    }
  };

  // === Host: Neuer Song ===
  const playNextSong = async () => {
    if (!isHost || queue.length === 0 || !sessionLive) return;

    const next = queue[0];
    setCurrentSong(next);

    // Server informieren
    socketRef.current.emit("host_song_start", { videoId: next.video_id });

    // Queue konsumieren
    await axios.post(
      `http://localhost:4000/sessions/${sessionId}/queue/consume`,
      {},
      { headers: getAuthHeaders() },
    );
    loadSessionData();
  };

  // === Start Session (Host) ===
  const startSession = async () => {
    if (!isHost) return;
    await axios.post(
      `http://localhost:4000/sessions/${sessionId}/start`,
      {},
      { headers: getAuthHeaders() },
    );
    loadSessionData();

    // Ersten Song starten
    if (queue.length > 0 && sessionLive) {
      setTimeout(playNextSong, 1000);
    }
  };

  // === Volume & Mute ===
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

  // === Suche & Vorschlag ===
  const searchYouTube = async () => {
    if (!searchQuery.trim() || sessionLive) return;
    const API_KEY = import.meta.env.VITE_YOUTUBE_KEY;
    if (!API_KEY) return;

    try {
      const res = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            type: "video",
            maxResults: 5,
            q: searchQuery,
            key: API_KEY,
          },
        },
      );
      setSearchResults(res.data.items);
    } catch (err) {
      console.error(err);
    }
  };

  const proposeSong = async (video) => {
    if (sessionLive) return;
    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/proposals`,
        {
          videoId: video.id.videoId,
          title: video.snippet.title,
          thumbnail: video.snippet.thumbnails.medium.url,
        },
        { headers: getAuthHeaders() },
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
      const res = await axios.post("http://localhost:4000/guest/join", {
        nickname,
      });
      localStorage.setItem("guestToken", res.data.guestToken);
      setShowGuestModal(false);
      loadSessionData();
    } catch (err) {
      console.error(err);
    }
  };

  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-blue-700 mb-4">Willkommen!</h2>
          <input
            type="text"
            placeholder="Name"
            className="w-full border rounded-lg p-3 mb-4"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleGuestJoin()}
          />
          <button
            onClick={handleGuestJoin}
            className="w-full bg-blue-600 text-white py-3 rounded-lg"
          >
            Beitreten
          </button>
        </div>
      </div>
    );
  }

  if (!session) return <div>Lade…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">
            Session: {session.title}
          </h1>
          <div className="flex items-center gap-4">
            {sessionLive ? (
              <div className="px-3 py-2 bg-green-100 text-green-800 rounded">
                Live
              </div>
            ) : (
              <div className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded">
                Warte auf Host
              </div>
            )}
            {isHost && !sessionLive && (
              <button
                onClick={startSession}
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Start Session
              </button>
            )}
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-600"
            >
              ← Zurück
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <QRCodeCanvas value={window.location.href} size={100} />
          <button
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("Link kopiert!");
            }}
            className="text-blue-600 hover:underline text-sm"
          >
            {window.location.href}
          </button>
          {sessionLive && (
            <button
              onClick={isLiveJoined ? leaveLive : joinLive}
              className={`px-4 py-2 rounded flex items-center gap-2 ${
                isLiveJoined
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              }`}
            >
              {isLiveJoined ? <FaPause /> : <FaPlay />}
              {isLiveJoined ? "Leave Live" : "Join Live"}
            </button>
          )}
        </div>

        {/* Jetzt läuft */}
        {sessionLive && currentSong && (
          <div className="bg-green-100 border-2 border-green-500 p-4 rounded-lg shadow mb-6">
            <h3 className="font-bold text-green-800 flex items-center gap-2">
              Jetzt läuft
            </h3>
            <div className="flex items-center gap-3 mt-2">
              <img
                src={currentSong.thumbnail}
                alt=""
                className="w-16 h-16 rounded"
              />
              <div>
                <p className="font-semibold">{currentSong.title}</p>
                <p className="text-sm text-green-700">Live mit allen</p>
              </div>
            </div>
          </div>
        )}

        {/* Volume Control */}
        {isLiveJoined && (
          <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 min-w-[150px]"
            />
            <span className="text-sm">{volume}%</span>
            <button
              onClick={togglePersonalMute}
              className={`px-3 py-1 rounded flex items-center gap-1 ${isMutedForMe ? "bg-red-600 text-white" : "bg-gray-200"}`}
            >
              {isMutedForMe ? <FaVolumeMute /> : <FaVolumeUp />}
              {isMutedForMe ? "Stumm" : "Ton"}
            </button>
          </div>
        )}

        {/* YouTube Suche */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">YouTube Suche</h2>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Suchen"
              className="flex-1 border rounded p-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={sessionLive}
            />
            <button
              onClick={searchYouTube}
              disabled={sessionLive}
              className="bg-green-600 text-white px-4 rounded disabled:opacity-50"
            >
              Suchen
            </button>
          </div>
          {sessionLive && (
            <p className="text-red-600 text-sm mb-3">
              Keine Vorschläge mehr möglich.
            </p>
          )}
          {searchResults.map((video) => (
            <div
              key={video.id.videoId}
              className="flex items-center gap-3 mb-2 p-2 bg-gray-50 rounded"
            >
              <img
                src={video.snippet.thumbnails.default.url}
                alt=""
                className="w-12 h-12 rounded"
              />
              <div className="flex-1 text-sm">{video.snippet.title}</div>
              <button
                onClick={() => proposeSong(video)}
                disabled={sessionLive}
                className="bg-blue-600 text-white px-2 rounded text-xs disabled:opacity-50"
              >
                Vorschlagen
              </button>
            </div>
          ))}
        </div>

        {/* Queue */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Queue</h2>
          {queue.length === 0 ? (
            <p className="text-gray-500">Leer</p>
          ) : (
            queue.map((item) => {
              const isCurrent = currentSong?.videoId === item.video_id;
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 mb-2 p-2 rounded transition-all ${
                    isCurrent
                      ? "bg-green-100 border-2 border-green-500 shadow-md"
                      : "bg-gray-50"
                  }`}
                >
                  {isCurrent && (
                    <span className="text-green-600 font-bold animate-pulse">
                      LIVE
                    </span>
                  )}
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-12 h-12 rounded"
                  />
                  <div className="flex-1 text-sm">{item.title}</div>
                  <span className="text-xs text-gray-500">
                    {item.addedBy || "Gast"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* YouTube Player (versteckt) */}
        {isLiveJoined && (
          <div
            id="youtube-player"
            style={{ width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          ></div>
        )}
      </div>
    </div>
  );
};

export default SessionPage;
