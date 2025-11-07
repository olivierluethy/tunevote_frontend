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

  // 🔽 NEU
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);

  const [pauseDuration, setPauseDuration] = useState(30); // default 30 Sekunden
  const [pauseDescription, setPauseDescription] = useState("Kurze Pause");

  const [isPaused, setIsPaused] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseTitle, setPauseTitle] = useState("");
  const pauseTimerRef = useRef(null);

  const [isHost, setIsHost] = useState(false);
  const [nickname, setNickname] = useState(
    () => localStorage.getItem("guestName") || "Gast",
  );
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMutedForMe, setIsMutedForMe] = useState(
    () => localStorage.getItem(`mute_${sessionId}`) === "true",
  );
  const [isLiveJoined, setIsLiveJoined] = useState(false);
  const [sessionLive, setSessionLive] = useState(false);

  // === AI RECOMMENDATIONS ===
  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);
  const [addingId, setAddingId] = useState(null); // <-- NEU: für Button-Feedback

  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const userId = localStorage.getItem("userId");

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    const guestToken = localStorage.getItem("guestToken");

    return {
      "Content-Type": "application/json",
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : guestToken
          ? { "x-guest-token": guestToken }
          : {}),
    };
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

      // Gast: Kein userId → isHost = false → korrekt
    } catch (err) {
      console.error(err);
      // WICHTIG: Kein navigate() hier!
      // Nur State setzen → useEffect übernimmt Navigation
      if (err.response?.status === 404) {
        setSession(null); // Trigger useEffect
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setShowGuestModal(true);
      }
    }
  }, [sessionId, userId, navigate]);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!token && !guestToken) {
        setShowGuestModal(true);
        return;
      }

      try {
        const [sessRes, queueRes] = await Promise.all([
          axios.get(`http://localhost:4000/sessions/${sessionId}`, {
            headers: getAuthHeaders(),
          }),
          axios.get(`http://localhost:4000/sessions/${sessionId}/queue`, {
            headers: getAuthHeaders(),
          }),
        ]);

        if (!isMounted) return;

        setSession(sessRes.data);
        setQueue(queueRes.data || []);
        setIsHost(sessRes.data.hostId === Number(userId));
        setSessionLive(!!sessRes.data.is_live);
      } catch (err) {
        if (!isMounted) return;

        if (err.response?.status === 404) {
          navigate("/dashboard"); // Jetzt SICHER in useEffect!
        } else if (
          err.response?.status === 401 ||
          err.response?.status === 403
        ) {
          setShowGuestModal(true);
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, token, guestToken, navigate, userId]);

  // === AI RECOMMENDATIONS FETCH ===
  useEffect(() => {
    if (
      !isLiveJoined ||
      queue.filter((i) => i.item_type === "music" && !i.played).length < 2
    ) {
      setRecommendations([]);
      return;
    }

    const controller = new AbortController();
    const fetchRec = async () => {
      setRecLoading(true);
      try {
        const res = await axios.get(
          `http://localhost:4000/sessions/${sessionId}/recommendations`,
          { headers: getAuthHeaders(), signal: controller.signal },
        );
        setRecommendations(res.data);
      } catch (e) {
        if (!axios.isCancel(e)) console.warn("rec fetch error", e);
      } finally {
        setRecLoading(false);
      }
    };

    const timer = setTimeout(fetchRec, 800); // debounce
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isLiveJoined, queue, sessionId]);

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
    socketRef.current.on("session_started", (data) => {
      console.log("Session started broadcast:", data);
      setSessionLive(true);
      loadSessionData();

      // WICHTIG: Auch für Gäste syncen!
      if (isLiveJoined && data.firstVideoId) {
        syncPlayback({
          current_video_id: data.firstVideoId,
          video_start_time: data.video_start_time,
          is_playing: true,
        });
      }
    });

    socketRef.current.on("playback_sync", (data) => {
      if (!isLiveJoined) return;
      syncPlayback(data);
    });

    socketRef.current.on("session_ended", ({ message }) => {
      alert(message);
      setIsLiveJoined(false);
      setCurrentSong(null);
      setSessionLive(false);
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      if (playerRef.current) {
        playerRef.current.stopVideo();
        playerRef.current.destroy();
        playerRef.current = null;
      }
      loadSessionData(); // Reload to restore UI
    });

    socketRef.current.on("pause_started", ({ title, duration, startTime }) => {
      console.log("Pause started:", title, duration);
      setIsPaused(true);
      setPauseTitle(title);
      setPauseRemaining(duration);

      // YouTube-Player pausieren
      if (playerRef.current) {
        playerRef.current.pauseVideo();
      }

      // Timer-Countdown im Frontend starten
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = setInterval(() => {
        setPauseRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(pauseTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socketRef.current.on("pause_ended", ({ title }) => {
      console.log("Pause ended:", title);
      setIsPaused(false);
      setPauseRemaining(0);
      setPauseTitle("");

      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);

      // Nach der Pause wieder Musik starten
      if (playerRef.current) {
        playerRef.current.playVideo();
      }
    });

    return () => socketRef.current.disconnect();
  }, [sessionId, token, guestToken, loadSessionData, isLiveJoined, isHost]);

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
    console.log(
      `[createPlayer] Lade Song: videoId=${videoId}, Startzeit=${startSeconds}s, Autoplay=${shouldPlay}`,
    );

    if (playerRef.current) {
      playerRef.current.loadVideoById({ videoId, startSeconds });
      if (shouldPlay) {
        playerRef.current.playVideo();
        console.log(
          `[createPlayer] Bestehender Player spielt Song ab: videoId=${videoId}`,
        );
      }
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
          if (shouldPlay) {
            playerRef.current.playVideo();
            console.log(
              `[createPlayer] Neuer Player spielt Song ab: videoId=${videoId}, Startzeit=${startSeconds}s`,
            );
          }
          playerRef.current.setVolume(isMutedForMe ? 0 : volume);
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

    console.log(
      `[Playback] Neuer Song wird abgespielt: videoId=${current_video_id}, Titel=${queue.find((i) => i.video_id === current_video_id)?.title || "Unbekannt"}`,
    );

    createPlayer(current_video_id, progress, is_playing);
  };

  // === Join Live ===
  const joinLive = async () => {
    if (!sessionLive || isLiveJoined) return;
    setIsLiveJoined(true);

    try {
      // Join mit Auth (Gast oder eingeloggt)
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/join-live`,
        {},
        { headers: getAuthHeaders() },
      );

      // Sync-Daten holen
      const { data } = await axios.get(
        `http://localhost:4000/sessions/${sessionId}/playback-sync`,
        { headers: getAuthHeaders() }, // WICHTIG: Auch hier!
      );

      if (data.current_video_id && data.video_start_time) {
        syncPlayback(data);
      }
    } catch (err) {
      console.error("Join Live failed", err);
      setIsLiveJoined(false);
      alert("Fehler beim Beitreten zur Live-Session");
    }

    // Regelmäßiger Sync
    syncIntervalRef.current = setInterval(async () => {
      if (!isLiveJoined) return;
      try {
        const { data } = await axios.get(
          `http://localhost:4000/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() },
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
        `http://localhost:4000/sessions/${sessionId}/leave-live`,
        {},
        { headers: getAuthHeaders() },
      );
      await loadSessionData(); // Reload to restore UI state
    } catch (err) {
      console.error("Leave failed", err);
      await loadSessionData(); // Reload even on error to ensure UI consistency
    }
  };

  // === Start Session (Host) ===
  const startSession = async () => {
    if (!isHost) return;

    if (playerRef.current) {
      playerRef.current.stopVideo();
      playerRef.current.destroy();
      playerRef.current = null;
    }

    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/start`,
        {},
        { headers: getAuthHeaders() },
      );
      loadSessionData();
    } catch (err) {
      console.error("Start session failed", err);
      alert("Fehler beim Starten der Session");
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
    if (!searchQuery.trim()) return;
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

      // 🔽 NEU: Wenn Live → auch AI-Suggestions abrufen
      if (sessionLive && isLiveJoined) {
        fetchAiSuggestions(searchQuery);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 🔽 NEU: KI-Songvorschläge abrufen
  const fetchAiSuggestions = async (query) => {
    setAiLoading(true);
    try {
      const res = await axios.post(
        `http://localhost:4000/sessions/${sessionId}/ai-suggestions`,
        { query },
        { headers: getAuthHeaders() },
      );
      setAiSuggestions(res.data || []);
    } catch (err) {
      console.warn("AI suggestion fetch failed", err);
    } finally {
      setAiLoading(false);
    }
  };

  const proposeSong = async (video) => {
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

      // WICHTIG: Erst speichern, DANN Modal schließen!
      localStorage.setItem("guestToken", res.data.guestToken);
      localStorage.setItem("guestName", nickname);

      setShowGuestModal(false); // Jetzt schließen
      await loadSessionData(); // Jetzt mit Token laden
    } catch (err) {
      console.error(err);
      alert("Fehler beim Beitreten als Gast");
    }
  };

  // === ADD RECOMMENDED SONG ===
  // === ADD RECOMMENDED SONG (mit Feedback + Stabilität) ===
  const addRecommendation = async (rec) => {
    if (addingId === rec.youtubeId) return;
    setAddingId(rec.youtubeId);
    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/recommendations/add`,
        { youtubeId: rec.youtubeId, title: rec.title },
        { headers: getAuthHeaders() },
      );
      loadSessionData();
      setRecommendations((prev) =>
        prev.filter((r) => r.youtubeId !== rec.youtubeId),
      );
    } catch (e) {
      alert("Fehler beim Hinzufügen");
    } finally {
      setAddingId(null);
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
            {!isHost && (
              <div className="text-sm text-gray-500">Gast: {nickname}</div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <QRCodeCanvas value={window.location.href} size={100} />
          <button
            onClick={async () => {
              const url = window.location.href;
              const title = document.title || "Schau dir das an!";
              const text = "Hier ist ein interessanter Link:";

              if (navigator.share) {
                try {
                  await navigator.share({
                    title,
                    text,
                    url,
                  });
                  console.log("Link erfolgreich geteilt!");
                } catch (err) {
                  console.error("Teilen abgebrochen oder fehlgeschlagen:", err);
                }
              } else {
                // Fallback: Link kopieren
                await navigator.clipboard.writeText(url);
                alert("Link kopiert!");
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 transition-all duration-200"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="8.59" y1="10.49" x2="15.42" y2="6.51" />
            </svg>
            Link teilen
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

        {sessionLive && isLiveJoined && (
          <>
            {isPaused ? (
              <div className="bg-yellow-100 border-2 border-yellow-500 p-4 rounded-lg shadow mb-6">
                <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                  ⏸ Pause läuft
                </h3>
                <p className="mt-2 text-yellow-700">
                  {pauseTitle || "Pause"} – noch{" "}
                  <span className="font-semibold">{pauseRemaining}s</span>
                </p>
                <div className="w-full bg-yellow-200 h-2 rounded mt-2 overflow-hidden">
                  <div
                    className="bg-yellow-500 h-2 transition-all duration-1000"
                    style={{
                      width: `${Math.max(0, (pauseRemaining / (pauseRemaining + 1)) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            ) : currentSong ? (
              <div className="bg-green-100 border-2 border-green-500 p-4 rounded-lg shadow mb-6">
                <h3 className="font-bold text-green-800 flex items-center gap-2">
                  🎵 Jetzt läuft
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
            ) : null}
          </>
        )}

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

        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">YouTube Suche</h2>
          <div className="flex gap-3 mb-3">
            <input
              type="text"
              placeholder="Suchen"
              className="flex-1 border rounded p-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              onClick={searchYouTube}
              className="bg-green-600 text-white px-4 rounded"
            >
              Suchen
            </button>
          </div>
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
                className="bg-blue-600 text-white px-2 rounded text-xs disabled:opacity-50"
              >
                Vorschlagen
              </button>
            </div>
          ))}
        </div>

        {/* === NEU: KI-Vorschläge unter der Suche === */}
        {aiLoading && (
          <p className="text-sm text-gray-500 mt-2">
            KI-Vorschläge werden geladen…
          </p>
        )}

        {!aiLoading && aiSuggestions.length > 0 && (
          <div className="mt-4 bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-purple-700 mb-2 flex items-center gap-2">
              🎧 KI-Songvorschläge
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {aiSuggestions.map((sugg, index) => (
                <div
                  key={sugg.youtubeId}
                  className="flex items-center gap-3 bg-white rounded p-2 shadow-sm hover:shadow transition"
                >
                  <img
                    src={
                      sugg.thumbnail ||
                      `https://i.ytimg.com/vi/${sugg.youtubeId}/default.jpg`
                    }
                    alt={sugg.title}
                    className="w-12 h-12 rounded"
                  />
                  <div className="flex-1 text-sm font-medium truncate">
                    {sugg.title}
                  </div>
                  <button
                    onClick={() =>
                      addRecommendation({
                        youtubeId: sugg.youtubeId,
                        title: sugg.title,
                      })
                    }
                    className="bg-purple-600 text-white px-2 py-1 rounded text-xs hover:bg-purple-700 transition"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">Pause hinzufügen</h2>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              min="5"
              value={pauseDuration}
              onChange={(e) => setPauseDuration(Number(e.target.value))}
              className="border rounded p-2 w-20"
            />
            <span className="text-sm text-gray-600">Sekunden</span>
            <input
              type="text"
              value={pauseDescription}
              onChange={(e) => setPauseDescription(e.target.value)}
              className="flex-1 border rounded p-2"
              placeholder="Beschreibung (optional)"
            />
            <button
              onClick={async () => {
                try {
                  await axios.post(
                    `http://localhost:4000/sessions/${sessionId}/proposals`,
                    {
                      item_type: "pause",
                      duration: pauseDuration,
                      description: pauseDescription,
                    },
                    { headers: getAuthHeaders() },
                  );
                  loadSessionData(); // Queue neu laden
                } catch (err) {
                  console.error(err);
                  alert("Fehler beim Hinzufügen der Pause");
                }
              }}
              className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 transition"
            >
              Pause hinzufügen
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Queue</h2>
          {queue.length === 0 ? (
            <p className="text-gray-500">Leer</p>
          ) : (
            queue.map((item, index) => {
              const isCurrent =
                currentSong?.videoId === item.video_id && isLiveJoined;

              return (
                <div
                  key={item.id ?? `queue-${item.video_id}-${index}`}
                  className={`flex items-center gap-3 mb-2 p-2 rounded transition-all ${
                    isCurrent
                      ? "bg-green-100 border-2 border-green-500 shadow-md"
                      : item.item_type === "pause"
                        ? "bg-yellow-50 border-l-4 border-yellow-400"
                        : "bg-gray-50"
                  }`}
                >
                  {isCurrent && (
                    <span className="text-green-600 font-bold animate-pulse">
                      LIVE
                    </span>
                  )}
                  {item.item_type === "music" && (
                    <img
                      src={item.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded"
                    />
                  )}
                  <div className="flex-1 text-sm">
                    {item.item_type === "pause"
                      ? `${item.description || "Pause"} - ${item.duration}s`
                      : item.title}
                  </div>
                  <span className="text-xs text-gray-500">
                    {item.addedBy || "Gast"}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* === AI RECOMMENDATIONS UI (STABIL) === */}
        {isLiveJoined && (
          <div className="mt-6">
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                AI-Vorschläge
              </h2>

              {recLoading ? (
                <p className="text-sm text-gray-600">Lade Vorschläge…</p>
              ) : recommendations.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Keine Vorschläge verfügbar
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {recommendations
                    .filter((rec) => rec.youtubeId && rec.title)
                    .map((rec) => (
                      <div
                        key={rec.youtubeId}
                        className="flex items-center gap-2 p-2 bg-white rounded shadow-sm hover:shadow transition"
                      >
                        <img
                          src={`https://i.ytimg.com/vi/${rec.youtubeId}/default.jpg`}
                          alt={rec.title}
                          className="w-12 h-12 rounded"
                          onError={(e) => {
                            e.target.src = "/fallback-thumbnail.png";
                          }}
                        />
                        <div className="flex-1 text-sm">
                          <div className="font-medium truncate">
                            {rec.title}
                          </div>
                        </div>
                        <button
                          onClick={() => addRecommendation(rec)}
                          disabled={recLoading || addingId === rec.youtubeId}
                          className={`px-2 py-1 rounded text-xs text-white transition ${
                            recLoading || addingId === rec.youtubeId
                              ? "bg-gray-400 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700"
                          }`}
                        >
                          {addingId === rec.youtubeId ? "✓" : "+"}
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

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
