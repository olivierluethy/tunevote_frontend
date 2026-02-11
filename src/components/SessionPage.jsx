import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import unidecode from "unidecode";

const SOCKET_SERVER = "http://localhost:4000";

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
  const [pauseDescription, setPauseDescription] = useState("Short break");

  const [liveParticipants, setLiveParticipants] = useState([]); // <-- NEU
  // === ADD NEW STATES – direkt nach den anderen useState (z. B. nach liveParticipants) ===

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState(""); // "success" | "error" | ""

  const [acceptedInvites, setAcceptedInvites] = useState([]); // <-- neu
  const [removingUserId, setRemovingUserId] = useState(null); // für Ladeanimation

  // Voting
  const [votingRound, setVotingRound] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [votesCast, setVotesCast] = useState(0);
  // === NEUE STATES – direkt nach deinen bestehenden useState ===
  const [votingPhase, setVotingPhase] = useState(null); // { phase: "suggesting" | "voting", endsAt: timestamp, duration: seconds }
  const [timeRemaining, setTimeRemaining] = useState(0); // in Sekunden

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

  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username") || "User";

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

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
    let guestToken = localStorage.getItem("guestToken");

    // Sicherstellen: Quotes entfernen + trimmen
    if (guestToken) {
      guestToken = guestToken.trim().replace(/^["']|["']$/g, "");
      console.log("[getAuthHeaders DEBUG] Bereinigter guestToken:", guestToken);
    }

    return {
      "Content-Type": "application/json",
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : guestToken
          ? { "x-guest-token": guestToken }
          : {}),
    };
  };

  // === NEU: Aktuelle Phase beim Laden holen (Fallback, falls Socket noch nicht verbunden) ===
  const loadCurrentVotingPhase = useCallback(async () => {
    if (!sessionLive) return;

    try {
      const res = await axios.get(
        `http://localhost:4000/sessions/${sessionId}/current-phase`,
        { headers: getAuthHeaders() },
      );

      if (res.data && res.data.phase && res.data.endsAt) {
        console.log("[Phase] Gefetched from API:", res.data);
        setVotingPhase({
          phase: res.data.phase,
          endsAt: new Date(res.data.endsAt).getTime(),
          duration: res.data.duration || 90,
          roundId: res.data.roundId,
        });

        const remaining = Math.max(
          0,
          Math.floor((new Date(res.data.endsAt).getTime() - Date.now()) / 1000),
        );
        setTimeRemaining(remaining);
      }
    } catch (err) {
      console.warn(
        "Konnte aktuelle Phase nicht laden (normal, wenn noch keine aktiv)",
        err.response?.status,
      );
      // 404 oder kein offene Runde → nichts tun
    }
  }, [sessionId, sessionLive]);

  const saveSessionName = async () => {
    const newName = editingName.trim();
    if (!newName || newName === session.title) {
      setIsEditingName(false);
      return;
    }

    // 1. Optimistic Update – sofort sichtbar!
    setSession((prev) => ({ ...prev, title: newName }));
    setIsEditingName(false);

    setSavingName(true);
    try {
      await axios.patch(
        `http://localhost:4000/sessions/${sessionId}`,
        { title: newName },
        { headers: getAuthHeaders() },
      );

      // Optional: Falls Server einen anderen (z. B. getrimmten) Titel zurückgibt
      // → könntest du hier nochmal loadSessionData() machen
      // Aber in 99 % der Fälle ist es identisch → unnötig
    } catch (err) {
      console.error("Fehler beim Umbenennen:", err);
      alert("Fehler: Name konnte nicht gespeichert werden.");

      // 2. Rollback bei Fehler – ganz wichtig!
      await loadSessionData(); // Holt den alten (korrekten) Stand vom Server
    } finally {
      setSavingName(false);
    }
  };

  const removeSongFromSuggestions = async (proposalId) => {
    if (!window.confirm("Deinen Vorschlag wirklich entfernen?")) return;

    try {
      await axios.delete(
        `http://localhost:4000/sessions/${sessionId}/proposals/${proposalId}`,
        { headers: getAuthHeaders() },
      );

      // UI aktualisieren
      await loadProposals();
      await loadSessionData(); // falls sich die Queue ändert (bei Pausen etc.)
    } catch (err) {
      console.error("Fehler beim Entfernen des Vorschlags:", err);
      alert(
        err.response?.data?.message ||
          "Fehler: Du kannst nur deinen eigenen Vorschlag entfernen.",
      );
    }
  };

  const loadProposals = useCallback(async () => {
    try {
      const res = await axios.get(
        `http://localhost:4000/sessions/${sessionId}/proposals`,
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
        `http://localhost:4000/sessions/${sessionId}/proposals/${songId}/vote`,
        {},
        { headers: getAuthHeaders() },
      );
      await loadProposals(); // Voting-Bereich aktualisieren
      await loadSessionData(); // Queue aktualisieren
    } catch (err) {
      console.log("ERROR: with song id: " + songId);
      console.error("Voting error:", err);
      alert("Fehler beim Abstimmen");
    }
  };

  // === ADD NEW FUNCTION – direkt nach loadLiveParticipants() ===

  const sendInvite = async () => {
    console.log("Sending invite to:", inviteEmail);
    if (!inviteEmail.trim() || !/^\S+@\S+\.\S+$/.test(inviteEmail)) {
      setInviteStatus("error");
      setTimeout(() => setInviteStatus(""), 3000);
      return;
    }

    try {
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/invite`,
        { email: inviteEmail },
        { headers: getAuthHeaders() },
      );
      setInviteStatus("success");
      setInviteEmail("");
      setTimeout(() => setInviteStatus(""), 3000);
      await loadSessionData(); // ← Das reicht völlig aus und ist sauberer!
    } catch (err) {
      console.error("Invite failed:", err);
      setInviteStatus("error");
      setTimeout(() => setInviteStatus(""), 4000);
    }
  };

  const ensureGuestToken = async () => {
    let guestToken = localStorage.getItem("guestToken");
    const nickname = localStorage.getItem("guestName") || "Gast";

    if (!guestToken) {
      try {
        const { data } = await axios.post("http://localhost:4000/guest/join", {
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
        axios.get(`http://localhost:4000/sessions/${sessionId}`, {
          headers: getAuthHeaders(),
        }),
        axios.get(`http://localhost:4000/sessions/${sessionId}/queue`, {
          headers: getAuthHeaders(),
        }),
      ]);

      setSession(sessRes.data);
      setQueue(queueRes.data || []);
      setIsHost(isLoggedIn && sessRes.data.hostId === Number(userId));
      setSessionLive(!!sessRes.data.is_live);

      // ADD BELOW – Teilnehmer direkt beim ersten Laden holen
      if (sessRes.data.is_private) {
        loadLiveParticipants();
      }

      // === NEU: Direkt nach Session-Live-Status Phase laden ===
      if (sessRes.data.is_live) {
        loadCurrentVotingPhase();
      }

      // Lade akzeptierte Einladungen (nur bei privaten Sessions)
      if (sessRes.data.is_private === 1) {
        try {
          const invitesRes = await axios.get(
            `http://localhost:4000/sessions/${sessionId}/invites/accepted`,
            { headers: getAuthHeaders() },
          );
          setAcceptedInvites(invitesRes.data || []);
        } catch (err) {
          console.error("Fehler beim Laden der akzeptierten Einladungen:", err);
          setAcceptedInvites([]); // fallback
        }
      }

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

  const loadLiveParticipants = useCallback(async () => {
    if (!session?.is_private) return; // Nur bei privaten Sessions

    try {
      const res = await axios.get(
        `http://localhost:4000/sessions/${sessionId}/participants`,
        { headers: getAuthHeaders() },
      );
      setLiveParticipants(res.data || []);
    } catch (err) {
      console.error("Failed to load live participants:", err);
    }
  }, [sessionId, session?.is_private]);

  // === NEU: Socket-Event für Phasenwechsel ===
  // 1. Voting Phase Listener – Dependency auf socketRef.current!
  useEffect(() => {
    if (!socketRef.current) return;

    const handler = (data) => {
      console.log("[Voting Phase] Update vom Server:", data);
      setVotingPhase({
        phase: data.phase,
        endsAt: data.endsAt,
        duration: data.duration || (data.phase === "suggestion" ? 90 : 60),
        roundId: data.roundId,
      });
      const remaining = Math.max(
        0,
        Math.floor((data.endsAt - Date.now()) / 1000),
      );
      setTimeRemaining(remaining);
    };

    socketRef.current.on("voting_phase_changed", handler);

    return () => {
      socketRef.current?.off("voting_phase_changed", handler);
    };
  }, [socketRef.current]); // ← Das ist der entscheidende Fix!

  // 2. Beim Verbindungsaufbau immer die aktuelle Phase laden (Safety Net)
  useEffect(() => {
    if (!socketRef.current) return;

    const onConnect = () => {
      console.log("Socket connected → lade aktuelle Voting-Phase");
      loadCurrentVotingPhase(); // ← Das ist deine bereits existierende Funktion!
    };

    socketRef.current.on("connect", onConnect);

    return () => {
      socketRef.current?.off("connect", onConnect);
    };
  }, [socketRef.current, loadCurrentVotingPhase]);

  // === NEU: Countdown-Timer (läuft jede Sekunde) ===
  useEffect(() => {
    if (!votingPhase) {
      setTimeRemaining(0);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        const now = Date.now();
        const remaining = Math.max(
          0,
          Math.floor((votingPhase.endsAt - now) / 1000),
        );

        if (remaining <= 0) {
          clearInterval(timer);
          // Optional: Phase automatisch zurücksetzen nach "closed" setzen (falls Server verspätet)
          if (
            votingPhase.phase === "suggestion" ||
            votingPhase.phase === "voting"
          ) {
            setVotingPhase(null);
          }
          return 0;
        }
        return remaining;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [votingPhase]);

  // === Hilfsfunktion für schöne Zeitformatierung ===
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (token || guestToken) {
      loadSessionData();
      loadProposals(); // ← NEU: Proposals laden

      const interval = setInterval(() => {
        loadSessionData();
        loadProposals(); // ← NEU: Alle 10s aktualisieren
        loadLiveParticipants();
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

    // BESTEHENDE EVENTS (bleiben unverändert)
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
      loadCurrentVotingPhase();
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

    socketRef.current.on("live_participants_updated", (participants) => {
      setLiveParticipants(participants);
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
      loadSessionData();
    });

    socketRef.current.on("pause_started", ({ title, duration, startTime }) => {
      console.log("Pause started:", title, duration);
      setIsPaused(true);
      setPauseTitle(title);
      setPauseRemaining(duration);

      if (playerRef.current) {
        playerRef.current.pauseVideo();
      }

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
      if (playerRef.current) {
        playerRef.current.playVideo();
      }
    });

    // NEU: Host tritt dem speziellen Raum bei
    if (isHost && sessionId) {
      socketRef.current.emit("join-session-host", sessionId);
      console.log("[Socket] Host joined room: session-host-" + sessionId);
    }

    // NEU: Auf neue akzeptierte Einladung hören
    const handleInviteAccepted = (newInvite) => {
      console.log("[Realtime] Neue akzeptierte Einladung:", newInvite);
      setAcceptedInvites((prev) => {
        if (prev.some((i) => i.id === newInvite.id)) return prev;
        return [...prev, newInvite].sort(
          (a, b) => new Date(b.accepted_at) - new Date(a.accepted_at),
        );
      });
    };
    socketRef.current.on("invite:accepted", handleInviteAccepted);

    return () => {
      // Beim Verlassen Raum verlassen + Listener entfernen
      if (isHost && sessionId) {
        socketRef.current.emit("leave-session-host", sessionId);
      }
      socketRef.current.off("invite:accepted", handleInviteAccepted);
      socketRef.current.disconnect();
    };
  }, [sessionId, token, guestToken, isHost, loadSessionData, isLiveJoined]);

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
      const res = await axios.get("http://localhost:4000/youtube-cache");
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

  // === KI-EMPFEHLUNGEN NUR Beim Start einer neuen Vorschlagsphase laden ===
  // === KI-EMPFEHLUNGEN ===
  // === KI-EMPFEHLUNGEN ===
  useEffect(() => {
    if (!isLiveJoined || !socketRef.current || !sessionLive) {
      console.log(
        "[KI Frontend] Nicht live beigetreten oder Socket nicht bereit",
      );
      setRecommendations([]);
      setRecLoading(false);
      return;
    }

    // Funktion zum Laden der Empfehlungen (wiederverwendbar)
    const loadRecommendations = async (reason = "unbekannt") => {
      console.log(`[KI Frontend] Lade Empfehlungen wegen: ${reason}`);

      const headers = getAuthHeaders();
      console.log("[KI Frontend DEBUG] Gesendete Headers:", headers);

      if (isGuest) {
        const rawToken = localStorage.getItem("guestToken");
        const cleanToken = rawToken?.trim().replace(/^["']|["']$/g, "") || "";
        console.log(
          "[KI Frontend DEBUG] Guest-Token raw:",
          JSON.stringify(rawToken),
          "| cleaned:",
          cleanToken,
          "| Länge:",
          cleanToken.length, // sollte 36 sein!
        );
      }

      setRecLoading(true);
      try {
        const res = await axios.get(
          `http://localhost:4000/sessions/${sessionId}/recommendations`,
          { headers },
        );
        console.log("[KI Frontend] Erfolg – Anzahl:", res.data?.length || 0);
        setRecommendations(res.data || []);
      } catch (e) {
        console.error(
          "[KI Frontend] Fehler:",
          e.response?.status,
          e.response?.data || e.message,
        );
        setRecommendations([]);
      } finally {
        setRecLoading(false);
      }
    };

    // 1. Sofort laden (Safety-Net für Guests)
    loadRecommendations("initial / useEffect-Trigger");

    // 2. Bei jedem neuen Start einer Suggestion-Phase laden
    const handleSuggestingPhaseStarted = (data) => {
      console.log(
        "[KI Frontend] Event: suggesting_phase_started (Round " +
          (data?.roundId || "unbekannt") +
          ") → lade Empfehlungen",
      );
      loadRecommendations("suggesting_phase_started Event");
    };

    socketRef.current.on(
      "suggesting_phase_started",
      handleSuggestingPhaseStarted,
    );

    // Cleanup
    return () => {
      socketRef.current?.off(
        "suggesting_phase_started",
        handleSuggestingPhaseStarted,
      );
    };
  }, [isLiveJoined, sessionLive, sessionId, socketRef.current]);

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
            `http://localhost:4000/youtube-info/${youtubeId}`,
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
          // 1. Cache-Suche
          const matches = videoCache
            .map((item) => {
              const normalizedCacheTitle = normalize(item.title_norm); // 🔑 FIX: Jetzt wird der Cache-Titel auch bereinigt!
              const ratio = levenshteinRatio(normalizedCacheTitle, normQuery);
              const includes = normalizedCacheTitle.includes(normQuery);
              return { ...item, ratio, includes };
            })
            .filter((item) => item.ratio > 85 || item.includes)
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
                "http://localhost:4000/youtube-cache",
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
                `http://localhost:4000/sessions/${sessionId}/ai-suggestions`,
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
        autoplay: 0, // Always start with autoplay off; control manually in onReady to avoid sound issues
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
      },
      events: {
        onReady: () => {
          // Apply mute/volume FIRST
          if (isMutedForMe) {
            playerRef.current.mute();
          } else {
            playerRef.current.unMute();
            playerRef.current.setVolume(volume);
          }

          // Then seek
          playerRef.current.seekTo(startSeconds, true);

          // Then play (if needed)
          if (shouldPlay) {
            playerRef.current.playVideo();
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
    loadLiveParticipants(); // <-- NEU: Sofort aktualisieren

    try {
      // NUR FÜR GÄSTE: Stelle sicher, dass ein gültiger Gast-Token existiert
      if (isGuest) {
        await ensureGuestToken();
      }

      // Join Live Session mit korrekten Auth-Headers (User ODER Gast)
      await axios.post(
        `http://localhost:4000/sessions/${sessionId}/join-live`,
        {},
        { headers: getAuthHeaders() },
      );

      // Playback-Sync-Daten abrufen
      const { data } = await axios.get(
        `http://localhost:4000/sessions/${sessionId}/playback-sync`,
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
        `http://localhost:4000/sessions/${sessionId}/leave-live`,
        {},
        { headers: getAuthHeaders() },
      );
    } catch (err) {
      console.error("Leave failed", err);
    } finally {
      loadLiveParticipants(); // <-- NEU: Auch wenn man selbst verlässt
      await loadSessionData();
    }
  };

  // === Start Session (Host) ===
  const startSession = async () => {
    // Player stoppen, falls vorhanden
    if (playerRef.current) {
      playerRef.current.stopVideo();
      playerRef.current.destroy();
      playerRef.current = null;
    }

    try {
      await axios.post(`http://localhost:4000/sessions/${sessionId}/start`);
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
  const normalize = (str) => {
    if (!str) return "";

    // Schritt 1: Akzente entfernen (entspricht der Python-Version)
    // 'Mylène Farmer' wird zu 'Mylene Farmer'
    let normalized = unidecode(str);

    // Schritt 2: Kleinbuchstaben, Satzzeichen entfernen und Leerzeichen konsolidieren
    normalized = normalized.toLowerCase();

    // Entfernt alles, was kein Buchstabe (a-z), keine Ziffer (0-9) oder Leerzeichen/Bindestrich ist
    // WICHTIG: Das `\s-` in deinem ursprünglichen Regex war etwas ungenau.
    // Ein sauberer Regex für diesen Schritt ist `[^a-z0-9\s]` wie in Python.
    normalized = normalized.replace(/[^a-z0-9\s]/g, "");

    // Konsolidiert mehrfache Leerzeichen und trimmt Ränder
    normalized = normalized.replace(/\s+/g, " ").trim();

    return normalized;
  };

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
          `http://localhost:4000/sessions/${sessionId}/proposals`,
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

  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <h2 className="text-2xl font-bold text-blue-700 mb-4">Welcome!</h2>
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
            Join
          </button>
        </div>
      </div>
    );
  }

  if (!session) return <div>Lade…</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-700 flex items-center gap-3 mb-6">
          Session: {session.title}
          {/* Nur Host darf bearbeiten */}
          {isHost && (
            <button
              onClick={() => {
                setEditingName(session.title);
                setIsEditingName(true);
              }}
              className="text-blue-600 hover:text-blue-800 transition opacity-70 hover:opacity-100"
              title="Edit session names"
            >
              <PencilSquareIcon className="w-6 h-6" />
            </button>
          )}
        </h1>

        <div className="flex items-center gap-4">
          {sessionLive ? (
            <div className="px-3 py-2 bg-green-100 text-green-800 rounded">
              Live
            </div>
          ) : (
            <div className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded">
              Waiting for host
            </div>
          )}

          {isHost && !sessionLive && (
            <div className="relative inline-block group">
              <button
                onClick={startSession}
                disabled={queue.length === 0}
                aria-disabled={queue.length === 0}
                className={`
        relative overflow-hidden
        px-8 py-3.5 rounded-2xl font-bold text-lg tracking-wide
        flex items-center gap-3
        transition-all duration-300 transform active:scale-[0.97]
        shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400
        ${
          queue.length === 0
            ? "bg-slate-600/60 text-slate-300 cursor-not-allowed shadow-none opacity-70"
            : `
              bg-gradient-to-r from-indigo-500 via-purple-600 to-fuchsia-600
              hover:from-indigo-600 hover:via-purple-700 hover:to-fuchsia-700
              hover:shadow-2xl hover:shadow-purple-700/40
              hover:scale-[1.04]
              text-white
            `
        }
      `}
              >
                {/* Shine effect */}
                {queue.length > 0 && (
                  <span className="absolute inset-0 bg-gradient-to-r from-white/15 via-white/5 to-transparent -translate-x-full animate-shine pointer-events-none" />
                )}

                <span>Start session</span>

                {queue.length > 0 ? (
                  <span className="text-xl transition-transform group-hover:translate-x-1">
                    🚀
                  </span>
                ) : (
                  <span className="text-xl opacity-70">🔒</span>
                )}
              </button>

              {/* Improved tooltip – only when disabled */}
              {queue.length === 0 && (
                <div
                  className="
        pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-5
        px-5 py-3.5 text-sm bg-neutral-900/95 backdrop-blur-lg
        border border-neutral-700/60 rounded-2xl shadow-2xl
        opacity-0 group-hover:opacity-100 transition-opacity duration-200
        whitespace-nowrap
        before:content-[''] before:absolute before:top-full before:left-1/2
        before:-translate-x-1/2 before:border-10 before:border-transparent
        before:border-t-neutral-900/95
      "
                >
                  <div className="font-semibold text-amber-300 mb-1.5">
                    Not ready yet!
                  </div>
                  <div className="text-neutral-300">
                    At least{" "}
                    <span className="font-medium text-white">one Song</span> in
                    the Queue
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => navigate("/dashboard")}
            className="text-gray-600"
          >
            ← Back
          </button>
          {isGuest && (
            <div className="text-sm text-gray-500">Gast: {displayName}</div>
          )}
        </div>

        {/* -------------------- MODAL ZUM BEARBEITEN -------------------- */}
        {isEditingName && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in duration-200">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">
                Edit session name
              </h2>

              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSessionName()}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
                placeholder="New name..."
              />

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveSessionName}
                  disabled={savingName || !editingName.trim()}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition shadow-md"
                >
                  {savingName ? "Saves..." : "Save"}
                </button>

                <button
                  onClick={() => setIsEditingName(false)}
                  disabled={savingName}
                  className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
            <span className="share-text">Share link</span>
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

        {/* === NEUE RESTZEIT-ANZEIGE – direkt nach dem QR-Code/Join-Live-Bereich === */}
        {sessionLive && votingPhase && timeRemaining > 0 && (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-5 rounded-xl shadow-lg mb-8 text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-2">
              {votingPhase.phase === "suggestion" ? (
                <>Submit song suggestions</>
              ) : (
                <>Voting is underway</>
              )}
            </h2>
            <div className="text-5xl font-mono font-bold tracking-wider mb-3">
              {formatTime(timeRemaining)}
            </div>
            <div className="bg-white/20 h-3 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ease-linear ${
                  votingPhase.phase === "suggestion"
                    ? "bg-green-400"
                    : "bg-orange-400"
                }`}
                style={{
                  width: `${
                    ((votingPhase.duration - timeRemaining) /
                      votingPhase.duration) *
                    100
                  }%`,
                }}
              />
            </div>
            <p className="mt-3 text-sm opacity-90">
              {votingPhase.phase === "suggestion"
                ? "Submit your song now!"
                : "Vote for your favorite!"}
            </p>
          </div>
        )}

        {/* Optional: Hinweis, wenn gerade keine Phase aktiv ist */}
        {sessionLive && !votingPhase && isLiveJoined && (
          <div className="bg-gray-100 text-gray-700 p-4 rounded-lg text-center mb-6">
            <p>Waiting for the next round of voting...</p>
          </div>
        )}

        {/* EINLADUNG PER E-MAIL – nur Host + private Session */}
        {isHost && session?.is_private === 1 && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-3">Invitation by email</h3>
            <div className="flex gap-3 items-center">
              <input
                type="email"
                placeholder="email@beispiel.de"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                className="flex-1 border rounded-lg px-3 py-2"
              />
              <button
                onClick={sendInvite}
                disabled={!inviteEmail.trim()}
                className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Invite
              </button>
            </div>
            {inviteStatus === "success" && (
              <p className="text-green-600 text-sm mt-2">Invitation sent!</p>
            )}
            {inviteStatus === "error" && (
              <p className="text-red-600 text-sm mt-2">
                Invalid email or error sending.
              </p>
            )}
          </div>
        )}

        {/* TEILNEHMER VERWALTEN – nur Host + private Session */}
        {isHost && session?.is_private === 1 && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                Manage participants
              </span>
              <span className="text-sm font-normal text-gray-500">
                {acceptedInvites.length} accepted
              </span>
            </h3>

            {acceptedInvites.length === 0 ? (
              <p className="text-gray-500 text-center py-6">
                No one has accepted the invitation yet.
              </p>
            ) : (
              <div className="space-y-3">
                {acceptedInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20 shadow bg-black/30">
                        {invite.imageData &&
                        typeof invite.imageData === "string" &&
                        invite.imageData.startsWith("data:") ? (
                          <img
                            src={invite.imageData}
                            alt="Profilbild"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                            {invite.invitee_name?.[0]?.toUpperCase() ||
                              invite.invitee_email?.[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="font-semibold text-gray-800">
                          {invite.invitee_name || "Unbenannt"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {invite.invitee_email}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (
                          !confirm(
                            `"${invite.invitee_name || invite.invitee_email}" wirklich entfernen?`,
                          )
                        )
                          return;

                        setRemovingUserId(invite.id);
                        try {
                          await axios.delete(
                            `http://localhost:4000/sessions/${sessionId}/invites/${invite.id}`,
                            { headers: getAuthHeaders() },
                          );
                          setAcceptedInvites((prev) =>
                            prev.filter((i) => i.id !== invite.id),
                          );
                        } catch (err) {
                          console.error(err);
                          alert("Fehler beim Entfernen des Teilnehmers");
                        } finally {
                          setRemovingUserId(null);
                        }
                      }}
                      disabled={removingUserId === invite.id}
                      className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50 transition font-medium flex items-center gap-2"
                    >
                      {removingUserId === invite.id ? (
                        <>Will be removed...</>
                      ) : (
                        <>
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Entfernen
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {sessionLive && isLiveJoined && (
          <>
            {isPaused ? (
              <div className="bg-yellow-100 border-2 border-yellow-500 p-4 rounded-lg shadow mb-6">
                <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                  ⏸ Break is in progress
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
                  🎵 Now running
                </h3>
                <div className="flex items-center gap-3 mt-2">
                  <img
                    src={currentSong.thumbnail}
                    alt=""
                    className="w-16 h-16 rounded"
                  />
                  <div>
                    <p className="font-semibold">{currentSong.title}</p>
                    <p className="text-sm text-green-700">Live with everyone</p>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* LIVE-TEILNEHMER (nur private Sessions) */}
        {session?.is_private === 1 && liveParticipants.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Live there ({liveParticipants.length})
            </h3>

            <div className="space-y-2">
              {liveParticipants.map((p, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {/* Live-Indikator */}
                  <span className="text-green-600">●</span>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-black/30 border border-white/30">
                    {p.profileImage &&
                    typeof p.profileImage === "string" &&
                    p.profileImage.startsWith("data:") ? (
                      <img
                        src={p.profileImage}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                        {p.name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  {/* Name + Host-Krone */}
                  <span className="flex items-center gap-1 text-gray-800 font-medium">
                    {p.name}
                    {p.isHost && (
                      <span title="Host" className="text-yellow-500">
                        👑
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
              {isMutedForMe ? "Mute" : "Sound"}
            </button>
          </div>
        )}

        {/* YouTube Suche + KI-Vorschläge */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">YouTube search</h2>
          <input
            type="text"
            placeholder="Search for song..."
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
                    disabled={
                      sessionLive && votingPhase?.phase !== "suggestion"
                    }
                    className={`
            min-w-[110px] px-5 py-2.5 rounded-full font-medium text-sm
            transition-all duration-300 transform active:scale-95
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
            ${
              sessionLive && votingPhase?.phase !== "suggestion"
                ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                : "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 " +
                  "text-white shadow-lg shadow-indigo-500/30 " +
                  "hover:shadow-xl hover:shadow-indigo-500/40 " +
                  "hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 " +
                  "group-hover:scale-105"
            }
          `}
                  >
                    {sessionLive && votingPhase?.phase !== "suggestion" ? (
                      <span className="flex items-center justify-center gap-1.5">
                        <span className="text-base">⏳</span>
                        <span className="text-xs">Suggestion phase only</span>
                      </span>
                    ) : (
                      "Suggest Song 🔥"
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">Add a pause</h2>
          <div className="flex gap-3 items-center">
            <input
              type="number"
              min="5"
              value={pauseDuration}
              onChange={(e) => setPauseDuration(Number(e.target.value))}
              className="border rounded p-2 w-20"
              disabled={sessionLive && votingPhase?.phase !== "suggestion"}
            />
            <span className="text-sm text-gray-600">seconds</span>
            <input
              type="text"
              value={pauseDescription}
              onChange={(e) => setPauseDescription(e.target.value)}
              className="flex-1 border rounded p-2"
              placeholder="Beschreibung (optional)"
              disabled={sessionLive && votingPhase?.phase !== "suggestion"}
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
              disabled={sessionLive && votingPhase?.phase !== "suggestion"}
              className={`
    relative overflow-hidden
    px-6 py-3 rounded-full font-semibold text-base
    transition-all duration-300 transform active:scale-95
    shadow-lg shadow-amber-600/30
    focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2
    ${
      sessionLive && votingPhase?.phase !== "suggestion"
        ? "bg-gray-500/60 text-gray-300 cursor-not-allowed shadow-none"
        : `
          bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600
          text-white
          hover:shadow-xl hover:shadow-amber-500/50
          hover:scale-105
          hover:from-amber-600 hover:via-yellow-600 hover:to-amber-700
        `
    }
  `}
            >
              {/* Shine animation */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shine pointer-events-none" />

              {sessionLive && votingPhase?.phase !== "suggestion"
                ? "Only possible in the proposal phase"
                : "Add break ⏸️"}
            </button>
          </div>

          {/* Optional: kleiner Hinweis, wenn deaktiviert – macht die UX noch klarer */}
          {sessionLive && votingPhase?.phase !== "suggestion" && (
            <p className="text-sm text-gray-500 mt-2 italic">
              Breaks can only be added during the proposal phase.
            </p>
          )}
        </div>

        {/* === Voting Round (Songs mit status = suggested) === */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-3">
            🗳 Vote ({proposals.filter((p) => p.status === "suggested").length}{" "}
            / 5)
          </h2>

          {proposals.length === 0 ? (
            <p className="text-gray-500">No songs suggested at this time.</p>
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
                          Proposed by{" "}
                          <span className="font-semibold">
                            {song.itemSource === "ai" ? "🤖 KI" : song.addedBy}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Vote Button with Animations */}
                    {/* Vote Button – NUR in der Voting-Phase anzeigen! */}
                    {votingPhase?.phase === "voting" ? (
                      <button
                        onClick={() => voteSong(song.id)}
                        disabled={song.userHasVoted && song.votes === 0} // optional: deaktivieren wenn schon abgestimmt
                        className={`
      min-w-[60px] px-4 py-2 rounded-lg font-bold transition-all transform active:scale-95
      ${
        song.userHasVoted
          ? "bg-green-600 text-white shadow-lg"
          : "bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700"
      }
    `}
                      >
                        {song.userHasVoted ? "Voted" : "Vote"} ({song.votes})
                      </button>
                    ) : (
                      <div className="text-gray-500 text-sm italic">
                        {votingPhase?.phase === "suggestion" ? (
                          <>
                            Proposal phase – Voting will begin shortly!
                            {/* Nur der Ersteller darf löschen – KI-Vorschläge ausgeschlossen */}
                            {song.itemSource !== "ai" &&
                              song.addedBy === displayName && (
                                <button
                                  onClick={() =>
                                    removeSongFromSuggestions(song.id)
                                  }
                                  className="ml-4 px-3 py-1 text-sm bg-red-100 text-red-700 rounded-full hover:bg-red-200 transition font-medium"
                                  title="Your suggestion – click to remove"
                                >
                                  ✕ Remove
                                </button>
                              )}
                          </>
                        ) : (
                          "Waiting for the next round"
                        )}
                      </div>
                    )}
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
            <p className="text-gray-500">Empty</p>
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
