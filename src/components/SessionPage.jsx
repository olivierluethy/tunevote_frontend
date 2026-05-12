import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import unidecode from "unidecode";
import { motion, AnimatePresence } from "framer-motion";
import {
  trackEvent,
  trackPageView,
  trackOnce,
  markTime,
  msSince,
  classifyYouTubeError,
  createIdleTracker,
  createScrollTracker,
  createTimeTracker,
} from "../utils/analytics";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Search,
  Plus,
  Users,
  Music,
  Share2,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  QrCode,
  ThumbsUp,
  ListMusic,
  Sparkles,
  Timer,
  Send,
  UserMinus,
  Crown,
  Rocket,
  Lock,
  Link2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

const SOCKET_SERVER = "https://api.tunevote.com/";

const SessionPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const playerRef = useRef(null);
  const socketRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const searchInputRef = useRef(null);

  // Refs that mirror state for use inside socket-driven callbacks.
  const queueRef = useRef([]);
  const mutedRef = useRef(false);
  const currentSongRef = useRef(null);

  const currentVideoIdRef = useRef(null);
  const metaCacheRef = useRef(new Map());

  const autoplayProbeRef = useRef(null);
  const pendingPlayRef = useRef(null);
  const MAX_PLAY_ATTEMPTS = 5;

  const togglePersonalMuteRef = useRef(null);

  const [session, setSession] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [pauseDuration, setPauseDuration] = useState(30);
  const [pauseDescription, setPauseDescription] = useState("Short break");

  const [liveParticipants, setLiveParticipants] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [acceptedInvites, setAcceptedInvites] = useState([]);
  const [removingUserId, setRemovingUserId] = useState(null);

  const [votingPhase, setVotingPhase] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [videoCache, setVideoCache] = useState([]);
  const searchDebounceRef = useRef(null);

  const [isPaused, setIsPaused] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseTitle, setPauseTitle] = useState("");
  const pauseTimerRef = useRef(null);

  const [isHost, setIsHost] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMutedForMe, setIsMutedForMe] = useState(() => {
    const initial = localStorage.getItem(`mute_${sessionId}`) === "true";
    mutedRef.current = initial;
    return initial;
  });
  const [isLiveJoined, setIsLiveJoined] = useState(false);
  const [sessionLive, setSessionLive] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // NEW: UI state for the state-driven hierarchy.
  //
  // showBreakModal — break creation is now a dedicated modal flow, separated
  //   from the search panel. Users no longer encounter "add a break" while
  //   trying to search for songs (a major source of confusion in the previous
  //   design where one user added three breaks expecting something to happen).
  //
  // showAllQueue — the queue now shows a compact preview (next 3) by default,
  //   with an explicit reveal for the full list. This keeps the page focused
  //   on the primary action at any moment rather than overwhelming with state.
  //
  // hasShownEmptyHint — used to fire empty_state_cta_clicked exactly once per
  //   session-mount, regardless of how many times the user re-enters empty.
  // ---------------------------------------------------------------------------
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [showAllQueue, setShowAllQueue] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const userId = localStorage.getItem("userId");
  const username = localStorage.getItem("username") || "User";

  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const isGuest = !token && guestToken;
  const isLoggedIn = !!token;
  const displayName = isGuest
    ? localStorage.getItem("guestName") || "Gast"
    : username;

  const [nickname, setNickname] = useState(
    isGuest ? localStorage.getItem("guestName") || "Gast" : ""
  );

  // Dynamic counts
  const queuedSongs = queue.filter((q) => q.status === "queued");
  const playedSongs = queue.filter((q) => q.status === "played");
  const suggestedSongs = proposals.filter((p) => p.status === "suggested");
  const totalSongsInSession = queue.length;

  // ---------------------------------------------------------------------------
  // CORE UX DECISION: derive a single "stage" from current state.
  //
  // The previous design rendered every section (search, queue, voting,
  // participants, etc.) at equal visual weight, leaving the user to figure
  // out what to do. The redesign uses this `stage` value to drive a single
  // hero action and a single supporting layout per moment, removing the
  // "what now?" question entirely.
  //
  // Stage progression for a host's happy path:
  //   empty → building → ready → live-suggesting → live-voting → live-playing
  //
  // For a guest:
  //   empty → building → waiting → live-suggesting → live-voting → live-playing
  //
  // 'paused' is overlaid on top of any live stage when a break is active.
  // ---------------------------------------------------------------------------
  const stage = (() => {
    if (isPaused) return "paused";
    if (sessionLive && isLiveJoined) {
      if (votingPhase?.phase === "voting" && timeRemaining > 0) return "live-voting";
      if (votingPhase?.phase === "suggestion" && timeRemaining > 0)
        return "live-suggesting";
      if (currentSong) return "live-playing";
      return "live-idle";
    }
    if (sessionLive && !isLiveJoined) return "live-not-joined";
    if (queuedSongs.length === 0 && proposals.length === 0) return "empty";
    if (isHost && queuedSongs.length > 0) return "ready";
    return "building";
  })();

  // Paste flow: still supported, but no longer behind a mystery icon. URL
  // detection happens automatically as the user types/pastes into the input.
  const handlePasteLink = async () => {
    trackEvent("paste_attempted", { session_id: sessionId });

    let text;
    try {
      text = await navigator.clipboard.readText();
    } catch (err) {
      console.error("Clipboard access failed:", err);
      trackEvent("paste_failed", {
        session_id: sessionId,
        reason: "permission_denied",
      });
      return;
    }

    if (!text) {
      trackEvent("paste_failed", {
        session_id: sessionId,
        reason: "parse_error",
      });
      return;
    }

    setSearchQuery(text);
    searchInputRef.current?.focus();

    const isYouTubeUrl = /youtu\.?be/.test(text);
    trackEvent(isYouTubeUrl ? "paste_success" : "paste_failed", {
      session_id: sessionId,
      is_youtube_url: isYouTubeUrl,
      ...(isYouTubeUrl ? {} : { reason: "invalid_url" }),
    });
  };

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    let guestToken = localStorage.getItem("guestToken");

    if (guestToken) {
      guestToken = guestToken.trim().replace(/^["']|["']$/g, "");
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

  const loadCurrentVotingPhase = useCallback(async () => {
    if (!sessionLive) return;

    try {
      const res = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/current-phase`,
        { headers: getAuthHeaders() }
      );

      if (res.data && res.data.phase && res.data.endsAt) {
        setVotingPhase({
          phase: res.data.phase,
          endsAt: new Date(res.data.endsAt).getTime(),
          duration: res.data.duration || 90,
          roundId: res.data.roundId,
        });

        const remaining = Math.max(
          0,
          Math.floor((new Date(res.data.endsAt).getTime() - Date.now()) / 1000)
        );
        setTimeRemaining(remaining);
      }
    } catch (err) {
      console.warn("Could not load current phase", err.response?.status);
    }
  }, [sessionId, sessionLive]);

  const saveSessionName = async () => {
    const newName = editingName.trim();
    if (!newName || newName === session.title) {
      setIsEditingName(false);
      return;
    }

    setSession((prev) => ({ ...prev, title: newName }));
    setIsEditingName(false);

    setSavingName(true);
    try {
      await axios.patch(
        `https://api.tunevote.com/sessions/${sessionId}`,
        { title: newName },
        { headers: getAuthHeaders() }
      );
    } catch (err) {
      console.error("Error renaming:", err);
      alert("Error: Name could not be saved.");
      await loadSessionData();
    } finally {
      setSavingName(false);
    }
  };

  const removeSongFromSuggestions = async (proposalId) => {
    if (!window.confirm("Remove your suggestion?")) return;

    try {
      await axios.delete(
        `https://api.tunevote.com/sessions/${sessionId}/proposals/${proposalId}`,
        { headers: getAuthHeaders() }
      );

      await loadProposals();
      await loadSessionData();
      trackEvent("song_removed", { session_id: sessionId, proposal_id: proposalId });
    } catch (err) {
      console.error("Error removing proposal:", err);
      alert(
        err.response?.data?.message ||
          "Error: You can only remove your own suggestion."
      );
    }
  };

  const loadProposals = useCallback(async () => {
    try {
      const res = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/proposals`,
        { headers: getAuthHeaders() }
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
        { headers: getAuthHeaders() }
      );
      await loadProposals();
      await loadSessionData();
      trackEvent("song_voted", { session_id: sessionId, song_id: songId });
    } catch (err) {
      console.error("Voting error:", err);
      alert("Error voting");
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !/^\S+@\S+\.\S+$/.test(inviteEmail)) {
      setInviteStatus("error");
      setTimeout(() => setInviteStatus(""), 3000);
      return;
    }

    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/invite`,
        { email: inviteEmail },
        { headers: getAuthHeaders() }
      );
      setInviteStatus("success");
      setInviteEmail("");
      setTimeout(() => setInviteStatus(""), 3000);
      await loadSessionData();
      trackEvent("invite_sent", { session_id: sessionId });
    } catch (err) {
      console.error("Invite failed:", err);
      setInviteStatus("error");
      setTimeout(() => setInviteStatus(""), 4000);
      trackEvent("invite_failed", { session_id: sessionId });
    }
  };

  const ensureGuestToken = async () => {
    let guestToken = localStorage.getItem("guestToken");
    const nickname = localStorage.getItem("guestName") || "Gast";

    if (!guestToken) {
      try {
        const { data } = await axios.post(
          "https://api.tunevote.com/guest/join",
          { nickname }
        );
        guestToken = data.guestToken;
        localStorage.setItem("guestToken", guestToken);
        localStorage.setItem("guestName", data.nickname);
      } catch (err) {
        console.error("Guest creation failed:", err);
      }
    }

    return guestToken;
  };

  // Mirror state into refs so socket-driven callbacks read fresh values.
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    mutedRef.current = isMutedForMe;
  }, [isMutedForMe]);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // ===========================================================================
  // Media Session API integration (unchanged from previous implementation —
  // see original file for the platform-by-platform behaviour notes).
  // ===========================================================================
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentSong || !currentSong.videoId) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        /* older browsers — ignore */
      }
      return;
    }
    if (PLACEHOLDER_TITLES.has(currentSong.title)) return;

    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title,
        artist: session?.title || "TuneVote",
        album: "TuneVote",
        artwork: currentSong.thumbnail
          ? [
              {
                src: currentSong.thumbnail,
                sizes: "512x512",
                type: "image/jpeg",
              },
            ]
          : [],
      });
    } catch (err) {
      console.warn("[mediaSession] metadata update failed:", err);
    }
  }, [currentSong, session?.title]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const inSilence = isMutedForMe || isPaused;
    navigator.mediaSession.playbackState = inSilence ? "paused" : "playing";
  }, [isMutedForMe, isPaused]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const handlePlay = () => {
      if (mutedRef.current) togglePersonalMuteRef.current?.();
    };
    const handlePause = () => {
      if (!mutedRef.current) togglePersonalMuteRef.current?.();
    };
    try {
      navigator.mediaSession.setActionHandler("play", handlePlay);
      navigator.mediaSession.setActionHandler("pause", handlePause);
    } catch (err) {
      console.warn("[mediaSession] setActionHandler failed:", err);
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
      } catch {
        /* older browsers — fine to ignore */
      }
    };
  }, []);

  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      if (!isLiveJoined) return;

      attemptPlay("visibility");
      await new Promise((r) => setTimeout(r, 150));

      try {
        const { data } = await axios.get(
          `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() }
        );
        if (data?.current_video_id && data.video_start_time) {
          const elapsed = (Date.now() - data.video_start_time) / 1000;
          const current = playerRef.current?.getCurrentTime?.() || 0;
          if (Math.abs(current - elapsed) > 2) {
            playerRef.current?.seekTo(elapsed, true);
          }
        }
      } catch (err) {
        console.warn("[visibility resync] failed:", err.message);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLiveJoined, sessionId]);

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

      if (sessRes.data.is_private) {
        loadLiveParticipants();
      }

      if (sessRes.data.is_live) {
        loadCurrentVotingPhase();
      }

      if (sessRes.data.is_private === 1) {
        try {
          const invitesRes = await axios.get(
            `https://api.tunevote.com/sessions/${sessionId}/invites/accepted`,
            { headers: getAuthHeaders() }
          );
          setAcceptedInvites(invitesRes.data || []);
        } catch (err) {
          console.error("Error loading accepted invites:", err);
          setAcceptedInvites([]);
        }
      }
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
    if (!session?.is_private) return;

    try {
      const res = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/participants`,
        { headers: getAuthHeaders() }
      );
      setLiveParticipants(res.data || []);
    } catch (err) {
      console.error("Failed to load live participants:", err);
    }
  }, [sessionId, session?.is_private]);

  useEffect(() => {
    if (!socketRef.current) return;

    const handler = (data) => {
      setVotingPhase({
        phase: data.phase,
        endsAt: data.endsAt,
        duration: data.duration || (data.phase === "suggestion" ? 90 : 60),
        roundId: data.roundId,
      });
      const remaining = Math.max(
        0,
        Math.floor((data.endsAt - Date.now()) / 1000)
      );
      setTimeRemaining(remaining);
    };

    socketRef.current.on("voting_phase_changed", handler);

    return () => {
      socketRef.current?.off("voting_phase_changed", handler);
    };
  }, [socketRef.current]);

  useEffect(() => {
    if (!socketRef.current) return;

    const onConnect = () => {
      loadCurrentVotingPhase();
    };

    socketRef.current.on("connect", onConnect);

    return () => {
      socketRef.current?.off("connect", onConnect);
    };
  }, [socketRef.current, loadCurrentVotingPhase]);

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
          Math.floor((votingPhase.endsAt - now) / 1000)
        );

        if (remaining <= 0) {
          clearInterval(timer);
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (token || guestToken) {
      loadSessionData();
      loadProposals();

      const interval = setInterval(() => {
        loadSessionData();
        loadProposals();
        loadLiveParticipants();
      }, 10000);

      return () => clearInterval(interval);
    } else {
      setShowGuestModal(true);
    }
  }, [loadSessionData, loadProposals, token, guestToken]);

  // === Analytics: page view, idle detection, scroll, time on page ===
  useEffect(() => {
    markTime(`session_page_${sessionId}`);
    trackPageView(`/session/${sessionId}`, "Session Page");
    trackEvent("session_page_viewed", {
      session_id: sessionId,
      user_type: isGuest ? "guest" : isLoggedIn ? "registered" : "anonymous",
      timestamp: Date.now(),
    });

    const idle = createIdleTracker("session_page", sessionId, 30000);
    const cleanupScroll = createScrollTracker("session_page");
    const sendTime = createTimeTracker("session_page");

    const resetIdle = () => idle.reset();
    window.addEventListener("click", resetIdle, { passive: true });
    window.addEventListener("keydown", resetIdle, { passive: true });

    return () => {
      idle.cleanup();
      cleanupScroll();
      sendTime();
      window.removeEventListener("click", resetIdle);
      window.removeEventListener("keydown", resetIdle);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!token && !guestToken) return;

    socketRef.current = io(SOCKET_SERVER, {
      query: { sessionId },
      auth: token ? { token } : { guestToken },
    });

    socketRef.current.on("connect_error", (err) =>
      console.warn("Socket error", err)
    );
    socketRef.current.on("queue_updated", loadSessionData);
    socketRef.current.on("proposals_updated", () => {
      loadProposals();
    });
    socketRef.current.on("session_started", (data) => {
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
      setIsPaused(false);
      setPauseRemaining(0);
      setPauseTitle("");

      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
      if (playerRef.current) {
        playerRef.current.playVideo();
      }
    });

    if (isHost && sessionId) {
      socketRef.current.emit("join-session-host", sessionId);
    }

    const handleInviteAccepted = (newInvite) => {
      setAcceptedInvites((prev) => {
        if (prev.some((i) => i.id === newInvite.id)) return prev;
        return [...prev, newInvite].sort(
          (a, b) => new Date(b.accepted_at) - new Date(a.accepted_at)
        );
      });
    };
    socketRef.current.on("invite:accepted", handleInviteAccepted);

    return () => {
      if (isHost && sessionId) {
        socketRef.current.emit("leave-session-host", sessionId);
      }
      socketRef.current.off("invite:accepted", handleInviteAccepted);
      socketRef.current.disconnect();
    };
  }, [sessionId, token, guestToken, isHost, loadSessionData, isLiveJoined]);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);

    window.onYouTubeIframeAPIReady = () => {
      console.log("YouTube API ready");
    };

    return () => {
      if (playerRef.current) playerRef.current.destroy();
      if (autoplayProbeRef.current) {
        clearTimeout(autoplayProbeRef.current);
        autoplayProbeRef.current = null;
      }
      pendingPlayRef.current = null;
    };
  }, []);

  const loadCache = useCallback(async () => {
    try {
      const res = await axios.get("https://api.tunevote.com/youtube-cache");
      const normalized = res.data.map((item) => ({
        ...item,
        youtubeId: item.youtube_id || item.youtubeId,
        youtube_id: undefined,
      }));
      setVideoCache(normalized);
    } catch (err) {
      console.warn("[Cache] Load failed", err);
    }
  }, []);

  useEffect(() => {
    if (!isLiveJoined || !socketRef.current || !sessionLive) {
      setRecommendations([]);
      setRecLoading(false);
      return;
    }

    const loadRecommendations = async (reason = "unknown") => {
      const headers = getAuthHeaders();

      setRecLoading(true);
      try {
        const res = await axios.get(
          `https://api.tunevote.com/sessions/${sessionId}/recommendations`,
          { headers }
        );
        setRecommendations(res.data || []);
      } catch (e) {
        console.error("[AI] Error:", e.response?.status, e.response?.data || e.message);
        setRecommendations([]);
      } finally {
        setRecLoading(false);
      }
    };

    loadRecommendations("initial");

    const handleSuggestingPhaseStarted = (data) => {
      loadRecommendations("suggesting_phase_started");
    };

    socketRef.current.on("suggesting_phase_started", handleSuggestingPhaseStarted);

    return () => {
      socketRef.current?.off("suggesting_phase_started", handleSuggestingPhaseStarted);
    };
  }, [isLiveJoined, sessionLive, sessionId, socketRef.current]);

  function extractYouTubeId(url) {
    try {
      const patterns = [
        /v=([a-zA-Z0-9_-]+)/,
        /youtu\.be\/([a-zA-Z0-9_-]+)/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
      ];

      for (const p of patterns) {
        const match = url.match(p);
        if (match) return match[1];
      }
    } catch (e) {}

    return null;
  }

  useEffect(() => {
    loadCache();
    const interval = setInterval(loadCache, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadCache]);

  useEffect(() => {
    if (!session) return;
    trackOnce(
      "session_initialized",
      {
        session_id: sessionId,
        user_type: isGuest ? "guest" : isLoggedIn ? "registered" : "anonymous",
        timestamp: Date.now(),
      },
      `session_initialized_${sessionId}`
    );
  }, [session, sessionId, isGuest, isLoggedIn]);

  useEffect(() => {
    if (!session) return;
    if (queue.length === 0 && proposals.length === 0) {
      trackOnce(
        "session_empty_state_seen",
        {
          session_id: sessionId,
          user_type: isGuest ? "guest" : isLoggedIn ? "registered" : "anonymous",
          timestamp: Date.now(),
        },
        `session_empty_state_seen_${sessionId}`
      );
    }
  }, [session, queue, proposals, sessionId, isGuest, isLoggedIn]);

  useEffect(() => {
    if (showGuestModal) {
      trackOnce(
        "guest_modal_shown",
        { session_id: sessionId },
        `guest_modal_shown_${sessionId}`
      );
    }
  }, [showGuestModal, sessionId]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      const youtubeId = extractYouTubeId(query);
      const isUrl = !!youtubeId;

      markTime(`search_${sessionId}`);

      trackEvent("search_performed", {
        session_id: sessionId,
        query_length: query.length,
        is_url: isUrl,
      });

      const normQuery = normalize(query);

      if (youtubeId) {
        const started = performance.now();
        try {
          const res = await axios.get(
            `https://api.tunevote.com/youtube-info/${youtubeId}`
          );
          const info = res.data;

          const result = {
            id: { videoId: youtubeId },
            snippet: {
              title: info.snippet?.title || "Unknown Title",
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
          trackEvent("search_results_returned", {
            session_id: sessionId,
            result_count: 1,
            source: "paste_url",
            response_time_ms: Math.round(performance.now() - started),
          });
          return;
        } catch (err) {
          console.error("YTDL fetch failed", err);
          setSearchResults([]);
          trackEvent("search_error", {
            session_id: sessionId,
            source: "paste_url",
            error_type: classifyYouTubeError(err),
          });
          trackEvent("search_no_results", {
            session_id: sessionId,
            query_length: query.length,
            is_url: true,
            source: "paste_url",
          });
          return;
        }
      }

      const API_KEY = import.meta.env.VITE_YOUTUBE_KEY;
      let source = "cache";
      let results = [];
      const started = performance.now();

      try {
        const matches = videoCache
          .map((item) => {
            const normalizedCacheTitle = normalize(item.title_norm);
            const ratio = levenshteinRatio(normalizedCacheTitle, normQuery);
            const includes = normalizedCacheTitle.includes(normQuery);
            return { ...item, ratio, includes };
          })
          .filter((item) => item.ratio > 85 || item.includes)
          .sort((a, b) => b.ratio - a.ratio)
          .slice(0, 5);

        if (matches.length > 0) {
          source = "cache";
          results = matches.map((m) => ({
            id: { videoId: m.youtubeId },
            snippet: {
              title: m.title,
              thumbnails: { default: { url: m.thumbnail } },
            },
          }));
        } else if (API_KEY) {
          source = "youtube";
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
            }
          );
          results = res.data.items || [];

          const cacheWrites = results.map((item) => {
            const ytId = item.id.videoId;
            const title = item.snippet.title;
            const thumbnail =
              item.snippet.thumbnails.medium?.url ||
              `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`;
            const norm = normalize(title);
            return axios
              .post(
                "https://api.tunevote.com/youtube-cache",
                { title_norm: norm, title, youtube_id: ytId, thumbnail },
                { headers: getAuthHeaders() }
              )
              .catch((cacheErr) => {
                console.warn("[Cache] Save failed", cacheErr);
              });
          });
          Promise.allSettled(cacheWrites).then(() => loadCache());
        } else {
          source = "youtube";
          trackEvent("search_error", {
            session_id: sessionId,
            source: "youtube",
            error_type: "invalid_key",
          });
        }

        setSearchResults(results);

        trackEvent("search_results_returned", {
          session_id: sessionId,
          result_count: results.length,
          source,
          response_time_ms: Math.round(performance.now() - started),
        });

        if (results.length === 0) {
          trackEvent("search_no_results", {
            session_id: sessionId,
            query_length: query.length,
            is_url: false,
            source,
          });
        }

        if (sessionLive && isLiveJoined) {
          setAiLoading(true);
          try {
            const aiRes = await axios.post(
              `https://api.tunevote.com/sessions/${sessionId}/ai-suggestions`,
              { query },
              { headers: getAuthHeaders() }
            );
            setAiSuggestions(aiRes.data || []);
          } catch (err) {
            console.warn("AI suggestion failed", err);
            setAiSuggestions([]);
          } finally {
            setAiLoading(false);
          }
        }
      } catch (err) {
        console.error("[Search Error]", err);
        trackEvent("search_error", {
          session_id: sessionId,
          source,
          error_type: classifyYouTubeError(err),
        });
        trackEvent("search_results_returned", {
          session_id: sessionId,
          result_count: 0,
          source,
          response_time_ms: Math.round(performance.now() - started),
        });
        trackEvent("search_no_results", {
          session_id: sessionId,
          query_length: query.length,
          is_url: false,
          source,
        });
        setSearchResults([]);
      }
    }, 300);
  }, [searchQuery, videoCache, sessionLive, isLiveJoined, sessionId, loadCache]);

  const attemptPlay = (trigger) => {
    const pending = pendingPlayRef.current;
    if (!pending) return false;
    if (pending.attempts >= MAX_PLAY_ATTEMPTS) return false;
    const player = playerRef.current;
    if (!player) return false;

    let currentVid = null;
    try {
      currentVid = player.getVideoData?.()?.video_id || null;
    } catch {
      /* getVideoData throws before player is fully ready — treat as unknown */
    }
    if (currentVid && currentVid !== pending.videoId) {
      pendingPlayRef.current = null;
      return false;
    }

    let state = null;
    try {
      state = player.getPlayerState?.();
    } catch {
      /* state may be unavailable pre-onReady */
    }
    if (state === 1 /* PLAYING */) {
      pendingPlayRef.current = null;
      return false;
    }

    pending.attempts += 1;
    pending.lastTrigger = trigger;
    if (pending.attempts > 1) {
      console.warn(
        `[autoplay] retry attempt ${pending.attempts}/${MAX_PLAY_ATTEMPTS} ` +
          `via ${trigger} (state=${state}, hidden=${document.hidden}, ` +
          `videoId=${pending.videoId})`
      );
    }
    try {
      player.playVideo();
    } catch (err) {
      console.warn(
        `[autoplay] playVideo() threw during ${trigger} attempt:`,
        err?.message || err
      );
    }
    return true;
  };

  const createPlayer = (videoId, startSeconds = 0, shouldPlay = false) => {
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    if (autoplayProbeRef.current) {
      clearTimeout(autoplayProbeRef.current);
      autoplayProbeRef.current = null;
    }

    pendingPlayRef.current = shouldPlay
      ? { videoId, attempts: 0, lastTrigger: null }
      : null;

    playerRef.current = new window.YT.Player("youtube-player", {
      height: 0,
      width: 0,
      videoId,
      playerVars: {
        start: Math.floor(startSeconds),
        autoplay: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
        playsinline: 1,
      },
      events: {
        onReady: () => {
          if (mutedRef.current) {
            playerRef.current.mute();
          } else {
            playerRef.current.unMute();
            playerRef.current.setVolume(volume);
          }

          playerRef.current.seekTo(startSeconds, true);

          if (shouldPlay) {
            attemptPlay("initial");

            const probeStart = Date.now();
            autoplayProbeRef.current = setTimeout(() => {
              autoplayProbeRef.current = null;
              const state = playerRef.current?.getPlayerState?.();
              if (state === 1 /* PLAYING */) return;
              console.warn(
                `[autoplay] probe: state=${state} after ` +
                  `${Date.now() - probeStart}ms (hidden=${document.hidden}). ` +
                  `Issuing one retry; further attempts will come from ` +
                  `onStateChange or visibility return.`
              );
              attemptPlay("probe");
            }, 2000);
          }
        },
        onStateChange: (e) => {
          if (e.data === 1 /* PLAYING */) {
            if (autoplayProbeRef.current) {
              clearTimeout(autoplayProbeRef.current);
              autoplayProbeRef.current = null;
            }
            const pending = pendingPlayRef.current;
            if (pending && pending.videoId === videoId) {
              if (pending.attempts > 1) {
                console.log(
                  `[autoplay] recovered after ${pending.attempts} attempts ` +
                    `(last trigger: ${pending.lastTrigger}), video ${pending.videoId}`
                );
              }
              pendingPlayRef.current = null;
            }
          }
        },
        onError: (e) => {
          console.warn(
            `[autoplay] YT player error (code=${e?.data}) for video ` +
              `${videoId}; abandoning retries.`
          );
          if (pendingPlayRef.current?.videoId === videoId) {
            pendingPlayRef.current = null;
          }
          if (autoplayProbeRef.current) {
            clearTimeout(autoplayProbeRef.current);
            autoplayProbeRef.current = null;
          }
        },
      },
    });
  };

  const PLACEHOLDER_TITLES = new Set(["", "Unknown", "Loading…"]);

  const fetchAndApplyMetadata = async (videoId) => {
    if (metaCacheRef.current.has(videoId)) {
      const cached = metaCacheRef.current.get(videoId);
      setCurrentSong((prev) =>
        prev && prev.videoId === videoId
          ? { ...prev, title: cached.title, thumbnail: cached.thumbnail }
          : prev
      );
      return;
    }
    try {
      const res = await axios.get(
        `https://api.tunevote.com/youtube-info/${videoId}`
      );
      const title = res.data?.snippet?.title;
      const thumbnail =
        res.data?.snippet?.thumbnails?.medium?.url ||
        res.data?.snippet?.thumbnails?.default?.url ||
        "";
      if (!title) return;

      metaCacheRef.current.set(videoId, { title, thumbnail });

      if (currentVideoIdRef.current !== videoId) return;
      const ytData = playerRef.current?.getVideoData?.();
      if (ytData?.video_id && ytData.video_id !== videoId) return;

      setCurrentSong((prev) =>
        prev && prev.videoId === videoId
          ? { ...prev, title, thumbnail }
          : prev
      );
    } catch (err) {
      console.warn(
        "[metadata fallback] /youtube-info failed for",
        videoId,
        err.message
      );
    }
  };

  const syncPlayback = ({
    current_queue_item_id,
    current_video_id,
    video_start_time,
    is_playing,
  }) => {
    if (!current_video_id || !video_start_time) return;

    currentVideoIdRef.current = current_video_id;

    const localQueue = queueRef.current;
    const item =
      localQueue.find((i) => i.id === current_queue_item_id) ||
      localQueue.find((i) => i.video_id === current_video_id);

    const elapsed = (Date.now() - video_start_time) / 1000;
    const progress = Math.max(0, elapsed);

    const cachedMeta = metaCacheRef.current.get(current_video_id);
    const prevSong = currentSongRef.current;
    const prevHasValidForSameVideo =
      prevSong?.videoId === current_video_id &&
      prevSong?.title &&
      !PLACEHOLDER_TITLES.has(prevSong.title);

    let resolvedTitle = item?.title || cachedMeta?.title || null;
    let resolvedThumb = item?.thumbnail || cachedMeta?.thumbnail || "";
    if (!resolvedTitle && prevHasValidForSameVideo) {
      resolvedTitle = prevSong.title;
      resolvedThumb = prevSong.thumbnail || resolvedThumb;
    }

    if (resolvedTitle && !cachedMeta) {
      metaCacheRef.current.set(current_video_id, {
        title: resolvedTitle,
        thumbnail: resolvedThumb,
      });
    }

    setCurrentSong({
      queueItemId: current_queue_item_id || item?.id,
      videoId: current_video_id,
      title: resolvedTitle || "Loading…",
      thumbnail: resolvedThumb,
    });

    createPlayer(current_video_id, progress, is_playing);

    if (!resolvedTitle) {
      fetchAndApplyMetadata(current_video_id);
    }
  };

  const joinLive = async () => {
    if (!sessionLive || isLiveJoined) return;
    trackEvent("join_live_clicked", { session_id: sessionId });
    setIsLiveJoined(true);
    loadLiveParticipants();

    try {
      if (isGuest) {
        await ensureGuestToken();
      }

      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/join-live`,
        {},
        { headers: getAuthHeaders() }
      );

      const { data } = await axios.get(
        `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
        { headers: getAuthHeaders() }
      );

      if (data.current_video_id && data.video_start_time) {
        syncPlayback(data);
      }
    } catch (err) {
      console.error("Join Live failed", err);
      setIsLiveJoined(false);
      alert("Error joining live session");
      return;
    }

    syncIntervalRef.current = setInterval(async () => {
      if (!isLiveJoined) return;
      try {
        const { data } = await axios.get(
          `https://api.tunevote.com/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() }
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

  const leaveLive = async () => {
    setIsLiveJoined(false);
    setCurrentSong(null);
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
        { headers: getAuthHeaders() }
      );
    } catch (err) {
      console.error("Leave failed", err);
    } finally {
      loadLiveParticipants();
      await loadSessionData();
    }
  };

  const startSession = async () => {
    if (playerRef.current) {
      playerRef.current.stopVideo();
      playerRef.current.destroy();
      playerRef.current = null;
    }

    try {
      await axios.post(`https://api.tunevote.com/sessions/${sessionId}/start`);
      loadSessionData();
      trackEvent("session_started", { session_id: sessionId });
    } catch (err) {
      console.error("Start session failed", err);
      alert("Error starting session");
      trackEvent("session_start_failed", { session_id: sessionId });
    }
  };

  const handleVolumeChange = (e) => {
    const vol = parseInt(e.target.value);
    setVolume(vol);
    playerRef.current?.setVolume(isMutedForMe ? 0 : vol);
  };

  const togglePersonalMute = () => {
    const next = !isMutedForMe;
    mutedRef.current = next;
    setIsMutedForMe(next);
    localStorage.setItem(`mute_${sessionId}`, next);
    if (next) {
      playerRef.current?.mute();
    } else {
      playerRef.current?.unMute();
      playerRef.current?.setVolume(volume);
    }
  };

  togglePersonalMuteRef.current = togglePersonalMute;

  const normalize = (str) => {
    if (!str) return "";
    let normalized = unidecode(str);
    normalized = normalized.toLowerCase();
    normalized = normalized.replace(/[^a-z0-9\s]/g, "");
    normalized = normalized.replace(/\s+/g, " ").trim();
    return normalized;
  };

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
          track[j - 1][i - 1] + indicator
        );
      }
    }
    return track[s2.length][s1.length];
  };

  const levenshteinRatio = (s1, s2) => {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0) return 100;
    return Math.round(
      ((longer.length - levenshteinDistance(longer, shorter)) / longer.length) *
        100
    );
  };

  const proposeSong = async (video, meta = {}) => {
    const source = meta.source || "search";
    const position = meta.position;
    try {
      const videoId = video.id?.videoId || video.youtubeId;
      const title = video.snippet?.title || video.title;
      const thumbnail =
        video.snippet?.thumbnails?.medium?.url ||
        video.snippet?.thumbnails?.default?.url ||
        video.thumbnail ||
        `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;

      if (!videoId || !title) {
        alert("Error: Video ID or title missing");
        return;
      }

      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/proposals`,
        { videoId, title, thumbnail },
        { headers: getAuthHeaders() }
      );

      setSearchQuery("");
      setSearchResults([]);
      setAiSuggestions([]);
      await loadProposals();
      await loadSessionData();
      trackEvent("song_added", {
        session_id: sessionId,
        video_id: videoId,
        song_title: title,
        source,
        position,
        time_since_search_ms: msSince(`search_${sessionId}`),
        time_since_session_start_ms: msSince(`session_page_${sessionId}`),
      });
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message === "Maximal 5 Songs pro Voting-Runde erlaubt."
          ? "🚫 Maximum 5 songs per voting round."
          : "Error suggesting: " + (err.response?.data?.message || "Unknown error");
      alert(msg);
      trackEvent("song_add_failed", {
        session_id: sessionId,
        error: err.response?.data?.message || "unknown",
        source,
      });
    }
  };

  const addBreak = async () => {
    try {
      await axios.post(
        `https://api.tunevote.com/sessions/${sessionId}/proposals`,
        {
          item_type: "pause",
          duration: pauseDuration,
          description: pauseDescription,
        },
        { headers: getAuthHeaders() }
      );
      setShowBreakModal(false);
      setPauseDescription("Short break");
      setPauseDuration(30);
      await loadSessionData();
      trackEvent("break_added", {
        session_id: sessionId,
        duration: pauseDuration,
      });
    } catch (err) {
      console.error(err);
      alert("Error adding break");
    }
  };

  const handleGuestJoin = async () => {
    if (!nickname.trim()) return;
    try {
      const res = await axios.post("https://api.tunevote.com/guest/join", {
        nickname,
      });

      localStorage.setItem("guestToken", res.data.guestToken);
      localStorage.setItem("guestName", nickname);

      setShowGuestModal(false);
      await loadSessionData();
      trackEvent("guest_joined_session", { session_id: sessionId });
      trackEvent("guest_modal_dismissed", {
        session_id: sessionId,
        reason: "joined",
      });
    } catch (err) {
      console.error(err);
      alert("Error joining as guest");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = `Join ${session?.title || "TuneVote Session"}`;
    trackEvent("session_shared", {
      session_id: sessionId,
      share_method: navigator.share ? "native_share" : "clipboard",
    });

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch (err) {
        console.error("Share cancelled:", err);
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert("Link copied!");
    }
  };

  // Whether the "add song" action is currently allowed. Used to disable the
  // search input + add buttons during the voting phase, but always paired
  // with an inline explanation so users don't think the UI is broken.
  const canAddSongs = !sessionLive || votingPhase?.phase === "suggestion";

  // Guest Modal
  if (showGuestModal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900 border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Music className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white">Join Session</h2>
          </div>
          <input
            type="text"
            placeholder="Your name"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:border-purple-400 focus:outline-none mb-4"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleGuestJoin()}
          />
          <button
            onClick={handleGuestJoin}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 transition-all"
          >
            Join
          </button>
        </motion.div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // SEARCH BLOCK — defined as a JSX expression (NOT a component function).
  //
  // Why this matters: a function component defined inside the parent renderer
  // is recreated on every parent render. React then sees a "different
  // component" each time and unmounts/remounts its DOM, which destroys input
  // focus, selection, and keystroke state — symptoms previously reported as
  // "search cuts off" and "can't delete what I'm typing".
  //
  // Storing the JSX directly in a `const` means the parent renders the same
  // <input> element (same position in the tree) on every render, so React
  // reconciles it as the SAME DOM node. Focus and caret position survive
  // exactly as they did in the original single-input implementation.
  //
  // Only one variant exists, with `large` derived from stage. We rely on a
  // single render of the input across the whole component — only one stage
  // is active at a time, so React only sees one input in the tree.
  // ---------------------------------------------------------------------------

  const isLargeSearch = stage === "empty";

  const searchBlock = (
    <div className="space-y-2">
      <div
        className={`relative flex items-center gap-2 ${
          isLargeSearch ? "p-1" : ""
        } rounded-2xl bg-white/5 border-2 border-white/10 focus-within:border-purple-400/60 transition-colors`}
      >
        <Search
          className={`absolute left-4 text-white/40 pointer-events-none ${
            isLargeSearch ? "w-5 h-5" : "w-4 h-4"
          }`}
        />
        <input
          ref={searchInputRef}
          type="text"
          placeholder={
            isLargeSearch
              ? "Type a song or paste a YouTube link…"
              : "Add another song…"
          }
          className={`w-full bg-transparent text-white placeholder-white/40 focus:outline-none ${
            isLargeSearch ? "pl-12 pr-24 py-4 text-base" : "pl-10 pr-20 py-3 text-sm"
          }`}
          value={searchQuery}
          disabled={!canAddSongs}
          onFocus={() =>
            trackEvent("search_input_focused", { session_id: sessionId })
          }
          onChange={(e) => {
            const value = e.target.value;
            setSearchQuery(value);
            trackEvent("search_query_changed", {
              session_id: sessionId,
              query_length: value.length,
            });
          }}
        />
        <button
          onClick={handlePasteLink}
          disabled={!canAddSongs}
          className="absolute right-2 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-medium text-white/70 hover:text-white transition-all disabled:opacity-40"
          title="Paste a YouTube link from your clipboard"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Paste link</span>
        </button>
      </div>

      {!canAddSongs && (
        <p className="text-xs text-amber-300/80 flex items-center gap-1.5 px-1">
          <Timer className="w-3.5 h-3.5" />
          Voting in progress — you can add new songs in the next round.
        </p>
      )}

      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-1.5 max-h-80 overflow-y-auto rounded-xl"
          >
            {searchResults.map((video, idx) => (
              <button
                key={video.id.videoId}
                onClick={() => {
                  trackEvent("search_result_clicked", {
                    session_id: sessionId,
                    position: idx,
                    total_results: searchResults.length,
                    video_id: video.id.videoId,
                  });
                  proposeSong(video, { source: "search", position: idx });
                }}
                disabled={!canAddSongs}
                className="w-full flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-[0.99] transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed group"
              >
                <img
                  src={video.snippet.thumbnails.default.url}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
                <p className="flex-1 text-sm truncate">{video.snippet.title}</p>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold shrink-0 group-hover:shadow-lg group-hover:shadow-purple-500/30 transition-shadow">
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      {/* Background atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full filter blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-pink-600/10 rounded-full filter blur-[80px]"></div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          HEADER — slim, persistent. Identity + navigation only.
          Stats and actions are pulled into the stage-aware body.
         ──────────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/90 border-b border-white/5">
        <div className="px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => navigate("/dashboard")}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base truncate">{session.title}</h1>
                {isHost && (
                  <button
                    onClick={() => {
                      setEditingName(session.title);
                      setIsEditingName(true);
                    }}
                    className="p-1 hover:bg-white/10 rounded transition-colors shrink-0"
                  >
                    <Edit3 className="w-4 h-4 text-white/50" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-white/50">
                {sessionLive ? (
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                    Live
                  </span>
                ) : (
                  <span className="text-yellow-400">Waiting to start</span>
                )}
                {session.is_private === 1 && (
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                )}
                <span className="text-white/30">·</span>
                <span>{queuedSongs.length} in queue</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {session.is_private === 1 && (
              <button
                onClick={() => setShowParticipantsModal(true)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors relative"
              >
                <Users className="w-5 h-5" />
                {liveParticipants.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-[10px] font-bold flex items-center justify-center">
                    {liveParticipants.length}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => setQrModalOpen(true)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={handleShare}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────────────────
          STAGE-AWARE BODY. The page reshapes itself based on `stage`.
          One hero, then context. No more competing sections.

          IMPORTANT: the search input is rendered exactly ONCE, from a stable
          position below the stage-specific hero content. Previously, each
          stage branch rendered its own copy of {searchBlock}, which meant
          React mounted a different <input> for each stage — destroying focus
          and selection state during stage transitions (most visibly when a
          successful "add song" pushed the user from `empty` to `building`).
          Keeping the input at one fixed JSX position lets React reconcile it
          as the same DOM node across stage transitions.
         ──────────────────────────────────────────────────────────────────── */}
      <main className="relative z-10 pb-32 max-w-2xl mx-auto">

        {/* HERO SECTION — varies by stage, sits ABOVE the stable search input */}

        {/* ─── STAGE: empty ─── */}
        {stage === "empty" && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="px-4 pt-8 pb-2"
          >
            <div className="text-center mb-8">
              <motion.div
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex p-4 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-400/30 mb-5"
              >
                <Music className="w-10 h-10 text-purple-300" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Add your first song</h2>
              <p className="text-white/60 text-sm max-w-sm mx-auto">
                Search for any track or paste a YouTube link. Once you've got a few songs,
                {isHost ? " you can start the session." : " the host will start the session."}
              </p>
            </div>
          </motion.section>
        )}

        {/* ─── STAGE: building (guest, has songs, not yet started) ─── */}
        {stage === "building" && !isHost && (
          <section className="px-4 pt-6 pb-2">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 border border-amber-500/30 flex items-center gap-4">
              <div className="p-2 rounded-xl bg-amber-500/20">
                <Timer className="w-5 h-5 text-amber-300" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-amber-100">Waiting for host to start</p>
                <p className="text-xs text-amber-200/70 mt-0.5">
                  Add more songs while you wait — they'll go to the first voting round.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* ─── STAGE: ready (host, has songs, not yet started) ─── */}
        {stage === "ready" && (
          <section className="px-4 pt-6 pb-2">
            <motion.button
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={startSession}
              className="w-full p-5 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 text-white font-semibold flex items-center justify-between shadow-xl shadow-purple-500/30 relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
              <div className="flex items-center gap-3 relative">
                <div className="p-2 rounded-xl bg-white/15">
                  <Rocket className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-base">Start the session</p>
                  <p className="text-xs text-white/80 font-normal">
                    {queuedSongs.length} song{queuedSongs.length !== 1 ? "s" : ""} ready to play
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 relative" />
            </motion.button>
          </section>
        )}

        {/* ─── STAGE: live but not joined ─── */}
        {stage === "live-not-joined" && (
          <section className="px-4 pt-6 pb-2">
            <motion.button
              initial={{ scale: 0.97, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={joinLive}
              className="w-full p-5 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 text-white font-semibold flex items-center justify-between shadow-xl shadow-green-500/30 relative overflow-hidden group"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></span>
              <div className="flex items-center gap-3 relative">
                <div className="p-2 rounded-xl bg-white/15">
                  <Play className="w-5 h-5" fill="currentColor" />
                </div>
                <div className="text-left">
                  <p className="text-base">Tap to join the music</p>
                  <p className="text-xs text-white/80 font-normal">
                    The session is live right now
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 relative" />
            </motion.button>
          </section>
        )}

        {/* ─── STAGE: paused (break) ─── */}
        {stage === "paused" && (
          <section className="px-4 pt-6 pb-2">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl bg-gradient-to-br from-yellow-500/15 to-amber-500/10 border border-yellow-500/30 text-center"
            >
              <div className="inline-flex p-3 rounded-2xl bg-yellow-500/20 mb-3">
                <Timer className="w-6 h-6 text-yellow-300" />
              </div>
              <p className="font-semibold text-yellow-100 text-lg">
                {pauseTitle || "Break"}
              </p>
              <p className="text-3xl font-mono font-bold text-yellow-300 mt-2">
                {pauseRemaining}s
              </p>
              <p className="text-xs text-yellow-200/60 mt-2">
                Music will resume automatically
              </p>
            </motion.div>
          </section>
        )}

        {/* ─── STAGE: live + joined ─── Now Playing card + voting banner */}
        {(stage === "live-playing" ||
          stage === "live-suggesting" ||
          stage === "live-voting" ||
          stage === "live-idle") && (
          <section className="px-4 pt-4 pb-2 space-y-4">
            {currentSong && (
              <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/15 to-emerald-500/10 border border-green-500/30">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={currentSong.thumbnail}
                      alt=""
                      className="w-14 h-14 rounded-xl object-cover"
                    />
                    <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center">
                      <motion.div
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 bg-green-400 rounded-full"
                      />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-green-400 font-medium uppercase tracking-wider mb-0.5">
                      Now playing
                    </p>
                    <p className="font-semibold truncate">{currentSong.title}</p>
                  </div>
                  <button
                    onClick={togglePersonalMute}
                    className={`p-2.5 rounded-xl transition-colors shrink-0 ${
                      isMutedForMe
                        ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                    title={isMutedForMe ? "Unmute for me" : "Mute for me"}
                  >
                    {isMutedForMe ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {!isMutedForMe && (
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={volume}
                      onChange={handleVolumeChange}
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                    />
                    <span className="text-xs text-white/50 w-8 text-right">{volume}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Voting phase banner */}
            {votingPhase && timeRemaining > 0 && (
              <div
                className={`p-4 rounded-2xl ${
                  votingPhase.phase === "suggestion"
                    ? "bg-gradient-to-r from-emerald-500/15 to-green-500/10 border border-emerald-500/30"
                    : "bg-gradient-to-r from-orange-500/15 to-amber-500/10 border border-orange-500/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wider font-medium opacity-70">
                      {votingPhase.phase === "suggestion"
                        ? "Suggesting phase"
                        : "Voting phase"}
                    </p>
                    <p className="font-semibold text-sm">
                      {votingPhase.phase === "suggestion"
                        ? "Add the songs you want to hear next"
                        : "Pick your favourites — top votes get played"}
                    </p>
                  </div>
                  <span className="text-2xl font-mono font-bold tabular-nums">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${
                      votingPhase.phase === "suggestion"
                        ? "bg-emerald-400"
                        : "bg-orange-400"
                    }`}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        ((votingPhase.duration - timeRemaining) /
                          votingPhase.duration) *
                        100
                      }%`,
                    }}
                    transition={{ duration: 1, ease: "linear" }}
                  />
                </div>
              </div>
            )}

            {/* Voting cards */}
            {suggestedSongs.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-white/80 px-1 flex items-center gap-2">
                  <ThumbsUp className="w-4 h-4 text-purple-400" />
                  {stage === "live-voting" ? "Cast your votes" : "Suggestions"}{" "}
                  <span className="text-white/40 font-normal">
                    ({suggestedSongs.length}/5)
                  </span>
                </h2>
                {suggestedSongs.map((song) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-2xl flex items-center gap-3 ${
                      song.itemSource === "ai"
                        ? "bg-purple-500/10 border border-purple-500/30"
                        : "bg-white/5 border border-white/10"
                    }`}
                  >
                    {song.itemType === "music" ? (
                      <img
                        src={song.thumbnail}
                        alt=""
                        className="w-12 h-12 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <Timer className="w-5 h-5 text-yellow-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {song.itemType === "pause"
                          ? `${song.description || "Pause"} · ${song.duration}s break`
                          : song.title}
                      </p>
                      <p className="text-xs text-white/40 flex items-center gap-1">
                        {song.itemSource === "ai" ? (
                          <>
                            <Sparkles className="w-3 h-3 text-purple-400" />
                            AI suggestion
                          </>
                        ) : (
                          song.addedBy
                        )}
                      </p>
                    </div>
                    {votingPhase?.phase === "voting" ? (
                      <button
                        onClick={() => voteSong(song.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all shrink-0 flex items-center gap-1.5 ${
                          song.userHasVoted
                            ? "bg-green-500 text-white"
                            : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/30"
                        }`}
                      >
                        {song.userHasVoted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <ThumbsUp className="w-4 h-4" />
                        )}
                        {song.votes}
                      </button>
                    ) : song.itemSource !== "ai" && song.addedBy === displayName ? (
                      <button
                        onClick={() => removeSongFromSuggestions(song.id)}
                        className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors shrink-0"
                        title="Remove your suggestion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-white/30 shrink-0">
                        {song.votes} {song.votes === 1 ? "vote" : "votes"}
                      </span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            STABLE SEARCH INPUT — rendered at a single, fixed position in
            the tree. Visibility controlled with CSS (`hidden`) rather than
            conditional rendering, so the <input> DOM node never unmounts.
            Hidden only when the stage genuinely shouldn't expose a search
            UI (paused break, host has no songs yet handled by the empty
            stage's hero which already includes a focus target above this).

            The empty-stage hero renders ABOVE this; the search itself lives
            here. This guarantees that typing → adding a song → stage
            transition does not destroy the input or its focus state.
           ──────────────────────────────────────────────────────────────── */}
        {stage !== "paused" && stage !== "live-voting" && (
          <section className="px-4 pt-2 pb-3">
            {searchBlock}
          </section>
        )}

        {/* Step indicator — only on empty stage, helps user see the whole arc */}
        {stage === "empty" && (
          <section className="px-4 pt-2 pb-3">
            <div className="flex items-center gap-3 text-xs text-white/40 px-2">
              <div className="flex items-center gap-2 text-purple-300">
                <div className="w-6 h-6 rounded-full bg-purple-500/30 border border-purple-400/50 flex items-center justify-center font-bold">
                  1
                </div>
                <span>Add songs</span>
              </div>
              <ArrowRight className="w-3 h-3" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold">
                  2
                </div>
                <span>{isHost ? "Start session" : "Wait for host"}</span>
              </div>
              <ArrowRight className="w-3 h-3" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 flex items-center justify-center font-bold">
                  3
                </div>
                <span>Vote & listen</span>
              </div>
            </div>
          </section>
        )}

        {/* Leave-live button — shown only in live + joined stages */}
        {(stage === "live-playing" ||
          stage === "live-suggesting" ||
          stage === "live-voting" ||
          stage === "live-idle") && (
          <section className="px-4 py-2">
            <button
              onClick={leaveLive}
              className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white/60 hover:bg-white/10 hover:text-white/80 transition-colors flex items-center justify-center gap-2"
            >
              <Pause className="w-4 h-4" />
              Leave live playback (music keeps going for others)
            </button>
          </section>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            QUEUE PREVIEW — shown across all non-empty stages.
            Compact: shows the next 3 unplayed items, with a tap-to-expand
            for the full list. The previous design's always-visible
            scrolling queue was attention-stealing.
           ──────────────────────────────────────────────────────────────── */}
        {stage !== "empty" && queuedSongs.length > 0 && (
          <section className="px-4 pt-2 pb-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                <ListMusic className="w-4 h-4 text-purple-400" />
                Up next{" "}
                <span className="text-white/40 font-normal">
                  ({queuedSongs.length})
                </span>
              </h2>
              {queuedSongs.length > 3 && (
                <button
                  onClick={() => setShowAllQueue(!showAllQueue)}
                  className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1"
                >
                  {showAllQueue ? "Show less" : `Show all ${queuedSongs.length}`}
                  {showAllQueue ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {(showAllQueue ? queuedSongs : queuedSongs.slice(0, 3)).map((item, index) => {
                const isCurrent =
                  currentSong?.queueItemId === item.id && isLiveJoined;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                      isCurrent
                        ? "bg-green-500/15 border border-green-500/30"
                        : item.item_type === "pause"
                          ? "bg-yellow-500/10 border border-yellow-500/20"
                          : "bg-white/5 border border-white/5"
                    }`}
                  >
                    <span className="w-6 text-center text-xs text-white/30 font-mono shrink-0">
                      {index + 1}
                    </span>
                    {item.item_type === "music" ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <Timer className="w-4 h-4 text-yellow-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">
                        {item.item_type === "pause"
                          ? `${item.description || "Pause"} · ${item.duration}s`
                          : item.title}
                      </p>
                      <p className="text-xs text-white/40 truncate">
                        {item.addedBy || "Guest"}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider font-bold text-green-400 shrink-0">
                        Playing
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Add a break — own button, no longer hidden in the search panel */}
            {(stage === "building" || stage === "ready" || stage === "live-suggesting") && (
              <button
                onClick={() => setShowBreakModal(true)}
                disabled={!canAddSongs}
                className="mt-2 w-full py-2.5 rounded-xl border border-dashed border-white/15 hover:border-amber-400/40 hover:bg-amber-500/5 text-xs text-white/50 hover:text-amber-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Timer className="w-3.5 h-3.5" />
                Add a break between songs
              </button>
            )}
          </section>
        )}

        {/* Hidden YouTube Player */}
        {isLiveJoined && (
          <div
            id="youtube-player"
            style={{ width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          ></div>
        )}
      </main>

      {/* ──────────────────────────────────────────────────────────────────────
          BREAK MODAL — extracted from the search panel.
         ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBreakModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowBreakModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-xl bg-amber-500/20">
                  <Timer className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="font-semibold">Add a break</h3>
                  <p className="text-xs text-white/50">
                    Pauses the music for a set time
                  </p>
                </div>
              </div>

              <label className="block text-xs text-white/60 mb-1">Label</label>
              <input
                type="text"
                value={pauseDescription}
                onChange={(e) => setPauseDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none mb-3"
                placeholder="e.g. Short break, Toast, Speech"
              />

              <label className="block text-xs text-white/60 mb-1">
                Duration (seconds)
              </label>
              <div className="flex gap-2 mb-5">
                {[15, 30, 60, 120].map((d) => (
                  <button
                    key={d}
                    onClick={() => setPauseDuration(d)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      pauseDuration === d
                        ? "bg-amber-500/20 border border-amber-400/50 text-amber-200"
                        : "bg-white/5 border border-white/10 text-white/60"
                    }`}
                  >
                    {d}s
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBreakModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={addBreak}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm"
                >
                  Add break
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────────────────
          PARTICIPANTS MODAL — moved out of the inline section so the main
          flow doesn't get cluttered.
         ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showParticipantsModal && session?.is_private === 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowParticipantsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              className="bg-slate-900 rounded-3xl p-6 max-w-md w-full border border-white/10 shadow-2xl max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold">Participants</h3>
                  <span className="text-xs text-white/50">
                    ({liveParticipants.length} live)
                  </span>
                </div>
                <button
                  onClick={() => setShowParticipantsModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {liveParticipants.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {liveParticipants.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                    >
                      <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                        {p.profileImage ? (
                          <img
                            src={p.profileImage}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          p.name?.[0]?.toUpperCase() || "?"
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium">{p.name}</span>
                      {p.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
                    </div>
                  ))}
                </div>
              )}

              {isHost && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 mb-3">
                  <p className="text-xs text-white/60 mb-2 font-medium">
                    Invite someone
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder="email@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendInvite()}
                      className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-white/30"
                    />
                    <button
                      onClick={sendInvite}
                      disabled={!inviteEmail.trim()}
                      className="px-4 py-2 rounded-lg bg-purple-500 text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {inviteStatus === "success" && (
                    <p className="text-xs text-green-400 mt-2">
                      Invitation sent!
                    </p>
                  )}
                  {inviteStatus === "error" && (
                    <p className="text-xs text-red-400 mt-2">
                      Invalid email or error.
                    </p>
                  )}
                </div>
              )}

              {isHost && acceptedInvites.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-white/50 px-1">Members</p>
                  {acceptedInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 p-2 rounded-xl bg-white/5"
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">
                        {invite.imageData ? (
                          <img
                            src={invite.imageData}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          invite.invitee_name?.[0]?.toUpperCase() ||
                          invite.invitee_email?.[0]?.toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {invite.invitee_name || "Unknown"}
                        </p>
                        <p className="text-xs text-white/40 truncate">
                          {invite.invitee_email}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Remove "${invite.invitee_name || invite.invitee_email}"?`
                            )
                          )
                            return;

                          setRemovingUserId(invite.id);
                          try {
                            await axios.delete(
                              `https://api.tunevote.com/sessions/${sessionId}/invites/${invite.id}`,
                              { headers: getAuthHeaders() }
                            );
                            setAcceptedInvites((prev) =>
                              prev.filter((i) => i.id !== invite.id)
                            );
                          } catch (err) {
                            console.error(err);
                            alert("Error removing participant");
                          } finally {
                            setRemovingUserId(null);
                          }
                        }}
                        disabled={removingUserId === invite.id}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {qrModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setQrModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Scan to Join</h3>
                <button
                  onClick={() => setQrModalOpen(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-white/60 mb-4 truncate">{session.title}</p>

              <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                <QRCodeCanvas value={window.location.href} size={200} level="H" />
              </div>

              <button
                onClick={() => {
                  handleShare();
                  setQrModalOpen(false);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
              >
                <Share2 className="w-4 h-4" />
                Share Link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Name Modal */}
      <AnimatePresence>
        {isEditingName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setIsEditingName(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-4">Edit Session Name</h3>
              <input
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveSessionName()}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-purple-400 focus:outline-none mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditingName(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSessionName}
                  disabled={savingName || !editingName.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-medium text-sm disabled:opacity-50"
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SessionPage;
