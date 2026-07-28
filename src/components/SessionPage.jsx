import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { usePlayback } from "../context/PlaybackContext";
import { resolveAuthFailure, clearUserAuth } from "../utils/auth";
import BreakModal from "./session/BreakModal";
import ParticipantsModal from "./session/ParticipantsModal";
import QrModal from "./session/QrModal";
import EditNameModal from "./session/EditNameModal";
import SessionHeader from "./session/SessionHeader";
import NowPlayingCard from "./session/NowPlayingCard";
import VotingBanner from "./session/VotingBanner";
import QueuePreview from "./session/QueuePreview";
import SearchPanel from "./session/SearchPanel";
import Avatar from "./Avatar";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import unidecode from "unidecode";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = (import.meta.env.VITE_API_URL || "https://api.tunevote.com").replace(/\/+$/, "");
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

const SOCKET_SERVER = `${API_BASE}/`;

const SessionPage = () => {
  const { sessionId: routeId } = useParams();
  const navigate = useNavigate();

  // Playback (player, current song, volume, mute, voting, breaks) is owned by
  // the global PlaybackProvider so it survives navigation. SessionPage reads
  // that state and delegates player control to it.
  const {
    currentSong,
    volume,
    isMutedForMe,
    isPlaying,
    getPlaybackProgress,
    votingPhase,
    timeRemaining,
    isPaused,
    pauseRemaining,
    pauseTitle,
    activeSessionId,
    joinLive: pbJoinLive,
    leaveLive: pbLeaveLive,
    setVolume: pbSetVolume,
    toggleMute: pbToggleMute,
  } = usePlayback();

  // The URL param may be a long public_id. SessionPage resolves it to the
  // numeric session id ONCE (in loadSessionData) and uses that numeric id for
  // everything internal — all /sessions/:id/* calls, the socket, joinLive, and
  // the "live joined" check — so the real-time/playback paths are unchanged.
  // null until the first resolve completes.
  const [numericId, setNumericId] = useState(null);
  const sessionId = numericId;
  const isLiveJoined = activeSessionId === sessionId;

  const socketRef = useRef(null);
  const searchInputRef = useRef(null);

  const [session, setSession] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [queue, setQueue] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [pauseDuration, setPauseDuration] = useState(30);
  const [pauseDescription, setPauseDescription] = useState("Short break");

  const [liveParticipants, setLiveParticipants] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [acceptedInvites, setAcceptedInvites] = useState([]);
  const [removingUserId, setRemovingUserId] = useState(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [videoCache, setVideoCache] = useState([]);
  const searchDebounceRef = useRef(null);

  const [isHost, setIsHost] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
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
        `${API_BASE}/sessions/${sessionId}`,
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
        `${API_BASE}/sessions/${sessionId}/proposals/${proposalId}`,
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
    if (!sessionId) return;
    try {
      const res = await axios.get(
        `${API_BASE}/sessions/${sessionId}/proposals`,
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
        `${API_BASE}/sessions/${sessionId}/proposals/${songId}/vote`,
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
        `${API_BASE}/sessions/${sessionId}/invite`,
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

  const handleRemoveInvite = async (invite) => {
    if (!confirm(`Remove "${invite.invitee_name || invite.invitee_email}"?`))
      return;

    setRemovingUserId(invite.id);
    try {
      await axios.delete(
        `${API_BASE}/sessions/${sessionId}/invites/${invite.id}`,
        { headers: getAuthHeaders() }
      );
      setAcceptedInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      console.error(err);
      alert("Error removing participant");
    } finally {
      setRemovingUserId(null);
    }
  };

  const ensureGuestToken = async () => {
    let guestToken = localStorage.getItem("guestToken");
    const nickname = localStorage.getItem("guestName") || "Gast";

    if (!guestToken) {
      try {
        const { data } = await axios.post(
          `${API_BASE}/guest/join`,
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

  const loadSessionData = useCallback(async () => {
    try {
      // Resolve the (possibly public_id) route param to the numeric session
      // first; every other call below uses the numeric id (numId).
      const sessRes = await axios.get(`${API_BASE}/sessions/${routeId}`, {
        headers: getAuthHeaders(),
      });
      const numId = String(sessRes.data.id);
      setNumericId(numId);

      const queueRes = await axios.get(`${API_BASE}/sessions/${numId}/queue`, {
        headers: getAuthHeaders(),
      });

      setSession(sessRes.data);
      setQueue(queueRes.data || []);
      setIsHost(isLoggedIn && sessRes.data.hostId === Number(userId));
      setSessionLive(sessRes.data.status === "live");

      if (sessRes.data.is_private) {
        loadLiveParticipants();
      }

      if (sessRes.data.is_private === 1) {
        try {
          const invitesRes = await axios.get(
            `${API_BASE}/sessions/${numId}/invites/accepted`,
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
      const status = err.response?.status;
      const action = resolveAuthFailure({
        hadToken: !!localStorage.getItem("token"),
        status,
      });
      if (action === "clear-and-login") {
        // A leftover login token was present but the server rejected it — the
        // previous login has expired. Purge the stale credential so it can't
        // shadow a guest identity, then send the user to re-authenticate
        // (consistent with the dashboard's handling). Do NOT offer guest join.
        clearUserAuth();
        navigate("/login");
      } else if (action === "guest") {
        setShowGuestModal(true);
      } else if (status === 404) {
        navigate("/dashboard");
      }
    }
  }, [routeId, userId, navigate]);

  const loadLiveParticipants = useCallback(async () => {
    if (!sessionId || !session?.is_private) return;

    try {
      const res = await axios.get(
        `${API_BASE}/sessions/${sessionId}/participants`,
        { headers: getAuthHeaders() }
      );
      setLiveParticipants(res.data || []);
    } catch (err) {
      console.error("Failed to load live participants:", err);
    }
  }, [sessionId, session?.is_private]);

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
    if (!sessionId) return;
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
    // Only ever connect the socket with the resolved NUMERIC id — the server
    // (rooms, emits, host-join) does not understand a public_id.
    if (!sessionId) return;

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
    // Playback (song sync, breaks, voting phase, live audio) is handled by the
    // global PlaybackProvider so it continues across navigation. Here we only
    // refresh the detail UI's session data.
    socketRef.current.on("session_started", () => {
      setSessionLive(true);
      loadSessionData();
    });

    socketRef.current.on("live_participants_updated", (participants) => {
      setLiveParticipants(participants);
    });

    socketRef.current.on("session_ended", () => {
      setSessionLive(false);
      loadSessionData();
    });

    // Host renamed the session — reflect the new title in the header instantly.
    socketRef.current.on("session_renamed", (data) => {
      if (Number(data.sessionId) === Number(sessionId)) {
        setSession((prev) => (prev ? { ...prev, title: data.title } : prev));
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
  }, [sessionId, token, guestToken, isHost, loadSessionData]);

  const loadCache = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/youtube-cache`);
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
          `${API_BASE}/sessions/${sessionId}/recommendations`,
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
            `${API_BASE}/youtube-info/${youtubeId}`
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
                `${API_BASE}/youtube-cache`,
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
              `${API_BASE}/sessions/${sessionId}/ai-suggestions`,
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

  // --- Playback control now lives in the global PlaybackProvider ------------
  // These thin wrappers delegate to it while keeping the existing call sites
  // (join button, leave button, volume slider, mute toggle) unchanged. The
  // player, live socket, sync loop and voting/break state all live there so
  // audio keeps going when this screen unmounts.

  const joinLive = async () => {
    if (!sessionLive || isLiveJoined) return;
    trackEvent("join_live_clicked", { session_id: sessionId });
    if (isGuest) {
      await ensureGuestToken();
    }
    await pbJoinLive({ sessionId, sessionName: session?.title });
    loadLiveParticipants();
  };

  const leaveLive = async () => {
    await pbLeaveLive();
    loadLiveParticipants();
    await loadSessionData();
  };

  const startSession = async () => {
    try {
      await axios.post(`${API_BASE}/sessions/${sessionId}/start`);
      loadSessionData();
      trackEvent("session_started", { session_id: sessionId });
    } catch (err) {
      console.error("Start session failed", err);
      alert("Error starting session");
      trackEvent("session_start_failed", { session_id: sessionId });
    }
  };

  const handleVolumeChange = (e) => {
    pbSetVolume(parseInt(e.target.value));
  };

  const togglePersonalMute = () => {
    pbToggleMute();
  };

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
        `${API_BASE}/sessions/${sessionId}/proposals`,
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
        `${API_BASE}/sessions/${sessionId}/proposals`,
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
      const res = await axios.post(`${API_BASE}/guest/join`, {
        nickname,
      });

      // Committing to a guest identity: drop any leftover user login so it can
      // never shadow this guestToken (getAuthHeaders prefers the Bearer token).
      clearUserAuth();
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

  // Reduce friction on arrival: when there's nothing queued yet (e.g. the host
  // just created the room and was dropped straight in), focus the add-song
  // input so they can start building the queue without hunting for it.
  useEffect(() => {
    if (stage === "empty" && canAddSongs) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 200);
      return () => clearTimeout(t);
    }
  }, [stage, canAddSongs]);

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
    <SearchPanel
      isLargeSearch={isLargeSearch}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      canAddSongs={canAddSongs}
      inputRef={searchInputRef}
      onPasteLink={handlePasteLink}
      searchResults={searchResults}
      onProposeSong={proposeSong}
      sessionId={sessionId}
    />
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
      <SessionHeader
        session={session}
        isHost={isHost}
        sessionLive={sessionLive}
        queuedCount={queuedSongs.length}
        participantCount={liveParticipants.length}
        onBack={() => navigate("/dashboard")}
        onEditName={() => {
          setEditingName(session.title);
          setIsEditingName(true);
        }}
        onOpenParticipants={() => setShowParticipantsModal(true)}
        onOpenQr={() => setQrModalOpen(true)}
        onShare={handleShare}
      />

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
      {/* Full-width workspace: a primary action/now-playing column beside a
          persistent queue rail, so every stage fills the viewport instead of
          floating a small card in empty space. Collapses to one column on
          mobile. */}
      <main className="relative z-10 mx-auto max-w-6xl pb-32 pt-2">
        <div className="grid lg:grid-cols-3 lg:items-start lg:gap-x-4 xl:gap-x-8">
          {/* ── PRIMARY COLUMN — hero / now-playing / add songs / suggestions ── */}
          <div className="min-w-0 lg:col-span-2">

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
            <NowPlayingCard
              currentSong={currentSong}
              isMutedForMe={isMutedForMe}
              volume={volume}
              isPlaying={isPlaying}
              getProgress={getPlaybackProgress}
              onToggleMute={togglePersonalMute}
              onVolumeChange={handleVolumeChange}
            />

            <VotingBanner
              votingPhase={votingPhase}
              timeRemaining={timeRemaining}
            />

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
                    className={`relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 ${
                      song.itemSource === "ai"
                        ? "border border-purple-400/40 bg-gradient-to-r from-purple-500/15 via-fuchsia-500/10 to-transparent shadow-[0_0_22px_-8px_rgba(168,85,247,0.6)]"
                        : "border border-white/10 bg-white/5"
                    }`}
                  >
                    {song.itemSource === "ai" && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-purple-500/25 blur-2xl"
                      />
                    )}
                    {song.itemType === "music" ? (
                      <img
                        src={song.thumbnail}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-500/20">
                        <Timer className="h-5 w-5 text-yellow-400" />
                      </div>
                    )}
                    <div className="relative min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {song.itemType === "pause"
                          ? `${song.description || "Pause"} · ${song.duration}s break`
                          : song.title}
                      </p>
                      {song.itemSource === "ai" ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-200">
                          <Sparkles className="h-3 w-3" />
                          AI pick
                        </span>
                      ) : (
                        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/40">
                          <Avatar
                            userId={song.addedById}
                            name={song.addedBy}
                            size={16}
                          />
                          <span className="truncate">{song.addedBy}</span>
                        </span>
                      )}
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

          </div>
          {/* ── END PRIMARY COLUMN ── */}

          {/* ── QUEUE RAIL — the up-next list as a persistent sidebar ── */}
          <aside className="lg:col-span-1 lg:sticky lg:top-[4.5rem]">
            {queuedSongs.length > 0 ? (
              <QueuePreview
                queuedSongs={queuedSongs}
                showAll={showAllQueue}
                setShowAll={setShowAllQueue}
                currentSong={currentSong}
                isLiveJoined={isLiveJoined}
                showBreakButton={
                  stage === "building" ||
                  stage === "ready" ||
                  stage === "live-suggesting"
                }
                canAddSongs={canAddSongs}
                onAddBreak={() => setShowBreakModal(true)}
              />
            ) : (
              <section className="px-4 pt-2 pb-3">
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                  <ListMusic className="mx-auto mb-2 h-6 w-6 text-white/25" />
                  <p className="text-sm font-medium text-white/60">
                    Your queue is empty
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    Add songs and they'll line up here.
                  </p>
                </div>
              </section>
            )}

            {/* Leave-live — leaves YOUR playback; music keeps going for others */}
            {(stage === "live-playing" ||
              stage === "live-suggesting" ||
              stage === "live-voting" ||
              stage === "live-idle") && (
              <section className="px-4 pb-2">
                <button
                  onClick={leaveLive}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
                >
                  <Pause className="h-4 w-4" />
                  Leave live playback (music keeps going for others)
                </button>
              </section>
            )}
          </aside>
        </div>

        {/* The hidden YouTube player is rendered once at the app root by
            PlaybackProvider so audio survives navigation. */}
      </main>

      {/* ──────────────────────────────────────────────────────────────────────
          BREAK MODAL — extracted from the search panel.
         ──────────────────────────────────────────────────────────────────── */}
      <BreakModal
        open={showBreakModal}
        onClose={() => setShowBreakModal(false)}
        pauseDescription={pauseDescription}
        setPauseDescription={setPauseDescription}
        pauseDuration={pauseDuration}
        setPauseDuration={setPauseDuration}
        onAddBreak={addBreak}
      />

      {/* ──────────────────────────────────────────────────────────────────────
          PARTICIPANTS MODAL — moved out of the inline section so the main
          flow doesn't get cluttered.
         ──────────────────────────────────────────────────────────────────── */}
      <ParticipantsModal
        open={showParticipantsModal && session?.is_private === 1}
        onClose={() => setShowParticipantsModal(false)}
        liveParticipants={liveParticipants}
        isHost={isHost}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        onSendInvite={sendInvite}
        inviteStatus={inviteStatus}
        acceptedInvites={acceptedInvites}
        onRemoveInvite={handleRemoveInvite}
        removingUserId={removingUserId}
      />

      <QrModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title={session.title}
        onShare={handleShare}
      />

      <EditNameModal
        open={isEditingName}
        onClose={() => setIsEditingName(false)}
        editingName={editingName}
        setEditingName={setEditingName}
        onSave={saveSessionName}
        saving={savingName}
      />
    </div>
  );
};

export default SessionPage;
