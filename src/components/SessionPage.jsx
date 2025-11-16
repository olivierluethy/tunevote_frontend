import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp } from "react-icons/fa";

const SOCKET_SERVER = "https://api.tunevote.com";

const SessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const syncIntervalRef = useRef(null);

  const [session, setSession] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [pauseDuration, setPauseDuration] = useState(30); // default 30 Sekunden
  const [pauseDescription, setPauseDescription] = useState("Kurze Pause");

  // Voting
  const [votingRound, setVotingRound] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [votesCast, setVotesCast] = useState(0);

  const hasInteracted = useRef(false); // Wichtig: Autoplay nur nach Interaktion

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);

  const [videoCache, setVideoCache] = useState([]); // <-- NEU

  const searchDebounceRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseTitle, setPauseTitle] = useState("");
  const pauseTimerRef = useRef(null);

  const [isHost, setIsHost] = useState(false);
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
  const username = localStorage.getItem("username") || "User";

  // Klare Unterscheidung
  const isGuest = !token && guestToken;
  const isLoggedIn = !!token;
  const displayName = isGuest
    ? localStorage.getItem("guestName") || "Gast"
    : username;

  // nickname nur für Gäste
  const [nickname, setNickname] = useState(
    isGuest ? localStorage.getItem("guestName") || "Gast" : "",
  );

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

  const loadProposals = useCallback(async () => {
    try {
      const res = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/proposals`,
        { headers: getAuthHeaders() },
      );
      setProposals(res.data || []);
    } catch (err) {
      console.error("Failed to load proposals:", err);
    }
  }, [sessionId]);

  const voteSong = async (songId) => {
    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/proposals/${songId}/vote`,
        {},
        { headers: getAuthHeaders() },
      );
      await loadProposals(); // Voting-Bereich aktualisieren
      await loadSessionData(); // Queue aktualisieren
    } catch (err) {
      console.error("Voting error:", err);
      alert("Fehler beim Abstimmen");
    }
  };

  const ensureGuestToken = async () => {
    let guestToken = localStorage.getItem("guestToken");
    const nickname = localStorage.getItem("guestName") || "Gast";

    if (!guestToken) {
      try {
        const { data } = await axios.post("https://api.tunevote.com/guest/join", {
          nickname,
        });
        guestToken = data.guestToken;
        localStorage.setItem("guestToken", guestToken);
        localStorage.setItem("guestName", data.nickname);
        console.log("New guest created:", data);
      } catch (err) {
        console.error("Guest creation failed:", err);
      }
    }

    return guestToken;
  };

  const loadSessionData = useCallback(async () => {
    try {
      const [sessRes, queueRes] = await Promise.all([
        axios.get(`https://api.tunevote.com/sessions/${sessionId}`, {
          headers: getAuthHeaders(),
        }),
        axios.get(`https://api.tunevote.com/sessions/${sessionId}/queue`, {
          headers: getAuthHeaders(),
        }),
      ]);

      setSession(sessRes.data);
      setQueue(queueRes.data || []);
      setIsHost(isLoggedIn && sessRes.data.hostId === Number(userId));
      setSessionLive(!!sessRes.data.is_live);

      // Gast: Kein userId → isHost = false → korrekt
    } catch (err) {
      console.error(err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setShowGuestModal(true);
      } else if (err.response?.status === 404) {
        navigate("/dashboard");
      }
    }
  }, [sessionId, userId, navigate]);

  useEffect(() => {
    if (token || guestToken) {
      loadSessionData();
      loadProposals(); // ← NEU: Proposals laden

      const interval = setInterval(() => {
        loadSessionData();
        loadProposals(); // ← NEU: Alle 10s aktualisieren
      }, 10000);

      return () => clearInterval(interval);
    } else {
      setShowGuestModal(true);
    }
  }, [loadSessionData, loadProposals, token, guestToken]); // ← loadProposals hinzugefügt

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
    socketRef.current.on("proposals_updated", () => {
      loadProposals();
    });
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

  // === CACHE LADEN (außerhalb von useEffect!) ===
  const loadCache = useCallback(async () => {
    try {
      const res = await axios.get("https://api.tunevote.com/youtube-cache");
      const normalized = res.data.map((item) => ({
        ...item,
        youtubeId: item.youtube_id || item.youtubeId,
        youtube_id: undefined,
      }));
      setVideoCache(normalized);
      console.log(`[Cache] ${normalized.length} Einträge geladen`);
    } catch (err) {
      console.warn("[Cache] Laden fehlgeschlagen", err);
    }
  }, []);

  // === AI RECOMMENDATIONS FETCH NUR BEI SONGSTART ===
  useEffect(() => {
    if (!isLiveJoined || !currentSong?.videoId) {
      setRecommendations([]);
      return;
    }

    const controller = new AbortController();

    const fetchRec = async () => {
      setRecLoading(true);
      try {
        const res = await axios.get(
          `https://api.tunevote.com/sessions/${sessionId}/recommendations`,
          { headers: getAuthHeaders(), signal: controller.signal },
        );
        setRecommendations(res.data);
      } catch (e) {
        if (!axios.isCancel(e)) console.warn("rec fetch error", e);
      } finally {
        setRecLoading(false);
      }
    };

    fetchRec(); // direkt ausführen, kein setTimeout

    return () => {
      controller.abort();
    };
  }, [isLiveJoined, currentSong, sessionId]);

  const addRecommendation = async (rec) => {
    if (addingId === rec.youtubeId) return;
    setAddingId(rec.youtubeId);

    try {
      const { data: newItem } = await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/recommendations/add`,
        { youtubeId: rec.youtubeId },
        { headers: getAuthHeaders() },
      );

      // Direkt in die Queue einfügen
      setQueue((prev) => [...prev, newItem]);

      // Empfehlung entfernen
      setRecommendations((prev) =>
        prev.filter((r) => r.youtubeId !== rec.youtubeId),
      );
    } catch (e) {
      console.error("Add recommendation error (frontend):", e);
      alert("Fehler beim Hinzufügen");
    } finally {
      setAddingId(null);
    }
  };

  function extractYouTubeId(url) {
    try {
      const patterns = [
        /v=([a-zA-Z0-9_-]+)/, // https://www.youtube.com/watch?v=ID
        /youtu\.be\/([a-zA-Z0-9_-]+)/, // https://youtu.be/ID
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/, // Shorts
      ];

      for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
      }
    } catch (e) {}

    return null;
  }

  // ← NEU: Cache beim Mount laden
  useEffect(() => {
    loadCache();
    const interval = setInterval(loadCache, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadCache]);

  // === LIVE-SUCHE: Sofort beim Tippen ===
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      const normQuery = normalize(query);

      // 🔥 1. Prüfen ob der User einen YouTube Link eingegeben hat
      const youtubeId = extractYouTubeId(query);

      if (youtubeId) {
        try {
          const res = await axios.get(
            `https://api.tunevote.com/youtube-info/${youtubeId}`,
          );
          const info = res.data;

          // Sicherstellen: exakt gleiches Format wie YouTube Search API
          const result = {
            id: { videoId: youtubeId },
            snippet: {
              title: info.snippet?.title || "Unbekannter Titel",
              thumbnails: {
                default: {
                  url:
                    info.snippet?.thumbnails?.default?.url ||
                    info.snippet?.thumbnails?.[0]?.url ||
                    `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
                },
              },
            },
          };

          setSearchResults([result]);
          return;
        } catch (err) {
          console.error("YTDL fetch failed", err);
          // Optional: Fallback auf leeres Ergebnis
          setSearchResults([]);
        }
      } else {
        const API_KEY = import.meta.env.VITE_YOUTUBE_KEY;

        try {
          // 1. Cache-Suche
          const matches = videoCache
            .map((item) => {
              const ratio = levenshteinRatio(item.title_norm, normQuery);
              return { ...item, ratio };
            })
            .filter(
              (item) => item.ratio > 85 || item.title_norm.includes(normQuery),
            )
            .sort((a, b) => b.ratio - a.ratio)
            .slice(0, 5);

          let results = [];

          if (matches.length > 0) {
            results = matches.map((m) => ({
              id: { videoId: m.youtubeId }, // ← ÄNDERN!
              snippet: {
                title: m.title,
                thumbnails: { default: { url: m.thumbnail } },
              },
            }));
          } else if (API_KEY) {
            // 2. YouTube API
            const res = await axios.get(
              "https://www.googleapis.com/youtube/v3/search",
              {
                params: {
                  part: "snippet",
                  type: "video",
                  maxResults: 5,
                  q: query,
                  key: API_KEY,
                },
              },
            );
            results = res.data.items || [];

            // 3. Cache speichern
            for (const item of results) {
              const youtubeId = item.id.videoId;
              const title = item.snippet.title;
              const thumbnail =
                item.snippet.thumbnails.medium?.url ||
                `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
              const norm = normalize(title);

              await axios.post(
                "https://api.tunevote.com/youtube-cache",
                { title_norm: norm, title, youtube_id: youtubeId, thumbnail },
                { headers: getAuthHeaders() },
              );
            }
            await loadCache();
          }

          setSearchResults(results);

          // KI-Vorschläge
          if (sessionLive && isLiveJoined) {
            setAiLoading(true);
            try {
              const res = await axios.post(
                `https://api.tunevote.com/sessions/${sessionId}/ai-suggestions`,
                { query },
                { headers: getAuthHeaders() },
              );
              setAiSuggestions(res.data || []);
            } catch (err) {
              console.warn("AI suggestion failed", err);
            } finally {
              setAiLoading(false);
            }
          }
        } catch (err) {
          console.error("[Search Error]", err);
        }
      }
    }, 300);
  }, [
    searchQuery,
    videoCache,
    sessionLive,
    isLiveJoined,
    sessionId,
    loadCache,
  ]);

  // === Player erstellen (für alle Clients) ===
  const createPlayer = (videoId, startSeconds = 0, shouldPlay = false) => {
    console.log(
      `[createPlayer] Lade Song: videoId=${videoId}, Startzeit=${startSeconds}s, Autoplay=${shouldPlay}`,
    );

    // Always destroy old player first if it exists (safety net)
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
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
          if (isMutedForMe) {
            playerRef.current.mute();
          } else {
            playerRef.current.unMute();
            playerRef.current.setVolume(volume);
          }
        },
      },
    });
  };

  // === Sync Playback ===
  const syncPlayback = ({
    current_queue_item_id,
    current_video_id,
    video_start_time,
    is_playing,
  }) => {
    if (!current_video_id || !video_start_time) return;

    const item =
      queue.find((i) => i.id === current_queue_item_id) ||
      queue.find((i) => i.video_id === current_video_id);

    const elapsed = (Date.now() - video_start_time) / 1000;
    const progress = Math.max(0, elapsed);

    setCurrentSong({
      queueItemId: current_queue_item_id || item?.id,
      videoId: current_video_id,
      title: item?.title || "Unbekannt",
      thumbnail: item?.thumbnail || "",
    });

    console.log(
      `[Playback] Now playing queueItem=${current_queue_item_id || "fallback by video_id"}, videoId=${current_video_id}, title=${item?.title || "Unbekannt"}`,
    );

    createPlayer(current_video_id, progress, is_playing);
  };

  // === Join Live ===
  const joinLive = async () => {
    if (!sessionLive || isLiveJoined) return;
    setIsLiveJoined(true);

    try {
      // NUR FÜR GÄSTE: Stelle sicher, dass ein gültiger Gast-Token existiert
      if (isGuest) {
        await ensureGuestToken();
      }

      // Join Live Session mit korrekten Auth-Headers (User ODER Gast)
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/join-live`,
        {},
        { headers: getAuthHeaders() },
      );

      // Playback-Sync-Daten abrufen
      const { data } = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
        { headers: getAuthHeaders() },
      );

      if (data.current_video_id && data.video_start_time) {
        syncPlayback(data);
      }
    } catch (err) {
      console.error("Join Live failed", err);
      setIsLiveJoined(false);
      alert("Fehler beim Beitreten zur Live-Session");
      return;
    }

    // Regelmäßiger Sync
    syncIntervalRef.current = setInterval(async () => {
      if (!isLiveJoined) return;
      try {
        const { data } = await axios.get(
          `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() },
        );

        if (data.current_video_id && data.video_start_time) {
          const elapsed = (Date.now() - data.video_start_time) / 1000;
          const current = playerRef.current?.getCurrentTime() || 0;
          if (Math.abs(current - elapsed) > 2) {
            playerRef.current?.seekTo(elapsed, true);
          }
        }
      } catch (e) {
        console.warn("Sync failed:", e.message);
      }
    }, 10000);
  };

  // === Leave Live ===
  const leaveLive = async () => {
    // Sofort UI aktualisieren
    setIsLiveJoined(false);
    setCurrentSong(null);
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    if (playerRef.current) {
      playerRef.current.pauseVideo();
      playerRef.current.destroy(); // Uncomment and always destroy to prevent DOM errors
      playerRef.current = null;
    }

    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/leave-live`,
        {},
        { headers: getAuthHeaders() },
      );
    } catch (err) {
      console.error("Leave failed", err);
    } finally {
      await loadSessionData();
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
        `https://api.tunevote.com/sessions/${sessionId}/start`,
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
    if (next) {
      playerRef.current?.mute();
    } else {
      playerRef.current?.unMute();
      playerRef.current?.setVolume(volume);
    }
  };

  // === Suche & Vorschlag ===
  // === NORMALIZE + LEVENSHTEIN (JS) ===
  const normalize = (str) =>
    str
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  // Levenshtein-Distanz (JS-Version)
  const levenshteinDistance = (s1, s2) => {
    const track = Array(s2.length + 1)
      .fill(null)
      .map(() => Array(s1.length + 1).fill(null));
    for (let i = 0; i <= s1.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= s2.length; j += 1) track[j][0] = j;

    for (let j = 1; j <= s2.length; j += 1) {
      for (let i = 1; i <= s1.length; i += 1) {
        const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator,
        );
      }
    }
    return track[s2.length][s1.length];
  };

  // Levenshtein-Ratio (0–100)
  const levenshteinRatio = (s1, s2) => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 100;
    return Math.round(
      ((longer.length - levenshteinDistance(longer, shorter)) / longer.length) *
        100,
    );
  };

  // === Suche & Vorschlag ===
  const searchYouTube = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    const API_KEY = import.meta.env.VITE_YOUTUBE_KEY;
    if (!API_KEY) return;

    const normQuery = normalize(query);

    try {
      // ---- 1. Lokaler Cache: Ähnliche Titel suchen (JS Levenshtein) ----
      const matches = videoCache
        .map((item) => {
          const normTitle = item.title_norm;
          const ratio =
            normTitle === normQuery
              ? 100
              : levenshteinRatio(normTitle, normQuery);
          return { ...item, ratio, normTitle };
        })
        .filter((item) => item.ratio > 85 || item.normTitle.includes(normQuery))
        .sort((a, b) => b.ratio - a.ratio)
        .slice(0, 5);

      let results = [];

      if (matches.length > 0) {
        results = matches.map((m) => ({
          id: { videoId: m.youtubeId }, // ← RICHTIG!
          snippet: {
            title: m.title,
            thumbnails: { default: { url: m.thumbnail } },
          },
        }));
        console.log(`[Cache] Found ${matches.length} results for "${query}"`);
      } else {
        console.log(`[YouTube] Searching for "${query}"`);
        const res = await axios.get(
          "https://www.googleapis.com/youtube/v3/search",
          {
            params: {
              part: "snippet",
              type: "video",
              maxResults: 5,
              q: query,
              key: API_KEY,
            },
          },
        );

        results = res.data.items || [];

        // ---- 4. Ergebnisse in Cache speichern ----
        for (const item of results) {
          const title = item.snippet.title;
          const youtubeId = item.id.videoId;
          const thumbnail =
            item.snippet.thumbnails.medium?.url ||
            `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`;
          const norm = normalize(title);

          await axios.post(
            "https://api.tunevote.com/youtube-cache",
            {
              title_norm: norm,
              title,
              youtubeId: youtubeId, // ← ÄNDERN!
              thumbnail,
            },
            { headers: getAuthHeaders() },
          );
        }

        // Cache neu laden
        const cacheRes = await axios.get("https://api.tunevote.com/youtube-cache");
        setVideoCache(cacheRes.data);
      }

      setSearchResults(results);

      if (sessionLive && isLiveJoined) {
        fetchAiSuggestions(query);
      }
    } catch (err) {
      console.error("[Search Error]", err);
    }
  };

  // 🔽 NEU: KI-Songvorschläge abrufen
  const fetchAiSuggestions = async (query) => {
    setAiLoading(true);
    try {
      const res = await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/ai-suggestions`,
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
      const videoId = video.id?.videoId || video.youtubeId;
      const title = video.snippet?.title || video.title;
      const thumbnail =
        video.snippet?.thumbnails?.medium?.url ||
        video.snippet?.thumbnails?.default?.url ||
        video.thumbnail ||
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

      if (!videoId || !title) {
        alert("Fehler: Video-ID oder Titel fehlt");
        return;
      }

      await axios
        .post(
          `https://api.tunevote.com/sessions/${sessionId}/proposals`,
          { videoId, title, thumbnail },
          { headers: getAuthHeaders() },
        )
        .then((res) => {
          if (res.data.status === "suggested") {
            //alert("🎵 Song wurde zur Abstimmung vorgeschlagen!");
          } else {
            // alert("✅ Song wurde direkt zur Wiedergabeliste hinzugefügt!");
          }
        });

      // Danach wieder UI zurücksetzen
      setSearchQuery("");
      setSearchResults([]);
      setAiSuggestions([]);
      await loadProposals(); // ← NEU: Voting-Bereich aktualisieren
      await loadSessionData(); // ← Queue aktualisieren
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ===
        "Maximal 5 Songs pro Voting-Runde erlaubt."
          ? "🚫 Es können maximal 5 Songs pro Voting-Runde vorgeschlagen werden."
          : "Fehler beim Vorschlagen: " +
            (err.response?.data?.message || "Unbekannter Fehler");
      alert(msg);
    }
  };

  const handleGuestJoin = async () => {
    if (!nickname.trim()) return;
    try {
      const res = await axios.post("https://api.tunevote.com/guest/join", {
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
            {isGuest && (
              <div className="text-sm text-gray-500">Gast: {displayName}</div>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-col sm:flex-row items-center justify-center gap-4">
          <QRCodeCanvas value={window.location.href} size={100} />
          <button
            onClick={async (e) => {
              const btn = e.currentTarget; // <-- unbedingt VOR await speichern

              const url = window.location.href;
              const title = document.title || "Schau dir das an!";
              const text = "Hier ist ein interessanter Link:";

              if (navigator.share) {
                try {
                  await navigator.share({ title, text, url });
                  console.log("Link erfolgreich geteilt!");
                } catch (err) {
                  console.error("Teilen abgebrochen oder fehlgeschlagen:", err);
                }
              } else {
                // Fallback: Link kopieren
                await navigator.clipboard.writeText(url);

                const textSpan = btn.querySelector(".share-text");
                if (!textSpan) return;

                const originalText = textSpan.innerText;
                textSpan.innerText = "Link kopiert!";
                setTimeout(() => {
                  textSpan.innerText = originalText;
                }, 2000);
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
            <span className="share-text">Link teilen</span>
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

        {/* YouTube Suche + KI-Vorschläge */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">YouTube Suche</h2>
          <input
            type="text"
            placeholder="Song suchen..."
            className="w-full border rounded p-2 mb-3"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {/* Suchergebnisse */}
          {searchResults.length > 0 && (
            <div className="space-y-2 mb-4">
              {searchResults.map((video) => (
                <div
                  key={video.id.videoId}
                  className="flex items-center gap-3 p-2 bg-gray-50 rounded hover:bg-gray-100 transition"
                >
                  <img
                    src={video.snippet.thumbnails.default.url}
                    alt=""
                    className="w-12 h-12 rounded"
                  />
                  <div className="flex-1 text-sm truncate">
                    {video.snippet.title}
                  </div>
                  <button
                    onClick={() => proposeSong(video)}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-xs"
                  >
                    Vorschlagen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

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
                    `https://api.tunevote.com/sessions/${sessionId}/proposals`,
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

        {/* === Voting Round (Songs mit status = suggested) === */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">
            🗳 Abstimmung (
            {proposals.filter((p) => p.status === "suggested").length} / 5)
          </h2>

          {proposals.length === 0 ? (
            <p className="text-gray-500">
              Keine vorgeschlagenen Songs aktuell.
            </p>
          ) : (
            <div className="space-y-3">
              {proposals
                .filter((p) => p.status === "suggested")
                .map((song) => (
                  <div
                    key={song.id}
                    className={`flex items-center justify-between p-3 rounded-lg relative transition-all
              ${
                song.itemSource === "ai"
                  ? "bg-gradient-to-r from-purple-50 to-purple-100 border border-purple-300 animate-[pulse_4s_infinite]"
                  : "bg-gray-100"
              }
            `}
                  >
                    {/* Modern KI Badge */}
                    {song.itemSource === "ai" && (
                      <span className="absolute -top-2 right-2 text-[10px] font-bold text-white px-2 py-0.5 rounded-lg bg-purple-600 shadow-md animate-[bounce_3s_infinite]">
                        🤖 AI
                      </span>
                    )}

                    <div className="flex items-center gap-3">
                      {song.itemType === "music" && (
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-12 h-12 rounded-lg shadow-sm"
                        />
                      )}

                      <div>
                        <p className="font-semibold">
                          {song.itemType === "pause"
                            ? `${song.description || "Pause"} - ${song.duration}s`
                            : song.title}
                        </p>

                        <p className="text-sm text-gray-600">
                          Vorgeschlagen von{" "}
                          <span className="font-semibold">
                            {song.itemSource === "ai" ? "🤖 KI" : song.addedBy}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Vote Button with Animations */}
                    <button
                      onClick={() => voteSong(song.id)}
                      className={`
                min-w-[60px] px-3 py-1 rounded-lg font-semibold transition-all
                transform active:scale-90 
                ${
                  song.userHasVoted
                    ? "bg-green-600 text-white shadow-md scale-110 animate-[pop_0.3s_ease-out]"
                    : "bg-gray-300 text-gray-700 hover:bg-green-500 hover:text-white"
                }
              `}
                    >
                      👍 {song.votes}
                    </button>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">
            ⏯️ Queue ({queue.filter((p) => p.status === "queued").length})
          </h2>

          {queue.length === 0 ? (
            <p className="text-gray-500">Leer</p>
          ) : (
            queue.map((item) => {
              const isCurrent =
                currentSong?.queueItemId === item.id && isLiveJoined;

              return (
                <div
                  key={item.id}
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
