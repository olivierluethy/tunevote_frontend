import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { QRCodeCanvas } from "qrcode.react";
import io from "socket.io-client";
import { FaPlay, FaPause, FaVolumeMute, FaVolumeUp } from "react-icons/fa";
import unidecode from "unidecode";
import { motion, AnimatePresence } from "framer-motion";
import {
  trackEvent,
  trackPageView,
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
  Clock,
  Music,
  Radio,
  Share2,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Mail,
  Trash2,
  Edit3,
  QrCode,
  Clipboard,
  ThumbsUp,
  ListMusic,
  Sparkles,
  Timer,
  Send,
  UserMinus,
  Crown,
  Rocket,
  Lock,
} from "lucide-react";

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
  const [pauseDuration, setPauseDuration] = useState(30);
  const [pauseDescription, setPauseDescription] = useState("Short break");

  const [liveParticipants, setLiveParticipants] = useState([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [acceptedInvites, setAcceptedInvites] = useState([]);
  const [removingUserId, setRemovingUserId] = useState(null);

  const [votingRound, setVotingRound] = useState(null);
  const [remainingTime, setRemainingTime] = useState(0);
  const [connectedCount, setConnectedCount] = useState(0);
  const [votesCast, setVotesCast] = useState(0);
  const [votingPhase, setVotingPhase] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const hasInteracted = useRef(false);
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
  const [isMutedForMe, setIsMutedForMe] = useState(
    () => localStorage.getItem(`mute_${sessionId}`) === "true"
  );
  const [isLiveJoined, setIsLiveJoined] = useState(false);
  const [sessionLive, setSessionLive] = useState(false);

  const [recommendations, setRecommendations] = useState([]);
  const [recLoading, setRecLoading] = useState(false);

  // UI State for collapsible sections
  const [showSearch, setShowSearch] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInviteSection, setShowInviteSection] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);

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

  const handlePasteLink = async () => {
    trackEvent("paste_link_attempted", { session_id: sessionId });
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSearchQuery(text);
        trackEvent("paste_link_success", {
          session_id: sessionId,
          is_youtube_url: /youtu\.?be/.test(text),
        });
      }
    } catch (err) {
      console.error("Clipboard access failed:", err);
    }
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
    trackPageView(`/session/${sessionId}`, "Session Page");
    trackEvent("session_page_viewed", {
      session_id: sessionId,
      user_type: isGuest ? "guest" : isLoggedIn ? "registered" : "anonymous",
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
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(async () => {
      trackEvent("song_search_started", {
        session_id: sessionId,
        query_type: extractYouTubeId(query) ? "youtube_link" : "text_search",
      });
      const normQuery = normalize(query);
      const youtubeId = extractYouTubeId(query);

      if (youtubeId) {
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
          return;
        } catch (err) {
          console.error("YTDL fetch failed", err);
          setSearchResults([]);
        }
      } else {
        const API_KEY = import.meta.env.VITE_YOUTUBE_KEY;

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

          let results = [];

          if (matches.length > 0) {
            results = matches.map((m) => ({
              id: { videoId: m.youtubeId },
              snippet: {
                title: m.title,
                thumbnails: { default: { url: m.thumbnail } },
              },
            }));
          } else if (API_KEY) {
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
                { headers: getAuthHeaders() }
              );
            }
            await loadCache();
          }

          setSearchResults(results);

          if (sessionLive && isLiveJoined) {
            setAiLoading(true);
            try {
              const res = await axios.post(
                `https://api.tunevote.com/sessions/${sessionId}/ai-suggestions`,
                { query },
                { headers: getAuthHeaders() }
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
  }, [searchQuery, videoCache, sessionLive, isLiveJoined, sessionId, loadCache]);

  const createPlayer = (videoId, startSeconds = 0, shouldPlay = false) => {
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
        autoplay: 0,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
      },
      events: {
        onReady: () => {
          if (isMutedForMe) {
            playerRef.current.mute();
          } else {
            playerRef.current.unMute();
            playerRef.current.setVolume(volume);
          }

          playerRef.current.seekTo(startSeconds, true);

          if (shouldPlay) {
            playerRef.current.playVideo();
          }
        },
      },
    });
  };

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
      title: item?.title || "Unknown",
      thumbnail: item?.thumbnail || "",
    });

    createPlayer(current_video_id, progress, is_playing);
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
    setIsMutedForMe(next);
    localStorage.setItem(`mute_${sessionId}`, next);
    if (next) {
      playerRef.current?.mute();
    } else {
      playerRef.current?.unMute();
      playerRef.current?.setVolume(volume);
    }
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
      });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[400px] h-[400px] bg-purple-600/15 rounded-full filter blur-[100px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-pink-600/10 rounded-full filter blur-[80px]"></div>
      </div>

      {/* Header - Fixed */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/90 border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            {/* Back + Title */}
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
                    <span className="text-yellow-400">Waiting</span>
                  )}
                  {session.is_private === 1 && (
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Private
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
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
        </div>
      </header>

      <main className="relative z-10 pb-32">
        {/* Session Stats Bar */}
        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-white/60">
                <ListMusic className="w-4 h-4" />
                <span className="font-medium text-white">{queuedSongs.length}</span> in queue
              </span>
              <span className="flex items-center gap-1.5 text-white/60">
                <ThumbsUp className="w-4 h-4" />
                <span className="font-medium text-white">{suggestedSongs.length}</span> voting
              </span>
            </div>
            <span className="text-white/40">
              {playedSongs.length} / {totalSongsInSession} played
            </span>
          </div>
        </div>

        {/* Voting Phase Timer */}
        {sessionLive && votingPhase && timeRemaining > 0 && (
          <div className="px-4 py-4">
            <div
              className={`p-4 rounded-2xl ${
                votingPhase.phase === "suggestion"
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30"
                  : "bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  {votingPhase.phase === "suggestion" ? "Submit Songs" : "Vote Now"}
                </span>
                <span className="text-2xl font-mono font-bold">
                  {formatTime(timeRemaining)}
                </span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full ${
                    votingPhase.phase === "suggestion" ? "bg-green-400" : "bg-orange-400"
                  }`}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${((votingPhase.duration - timeRemaining) / votingPhase.duration) * 100}%`,
                  }}
                  transition={{ duration: 1, ease: "linear" }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Now Playing / Pause */}
        {isLiveJoined && (
          <div className="px-4 py-2">
            {isPaused ? (
              <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-yellow-500/20">
                    <Timer className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-yellow-300">{pauseTitle || "Break"}</p>
                    <p className="text-sm text-yellow-400/70">{pauseRemaining}s remaining</p>
                  </div>
                </div>
              </div>
            ) : currentSong ? (
              <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
                <div className="flex items-center gap-3">
                  <img
                    src={currentSong.thumbnail}
                    alt=""
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{currentSong.title}</p>
                    <p className="text-sm text-green-400">Now playing</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePersonalMute}
                      className={`p-2 rounded-lg transition-colors ${
                        isMutedForMe ? "bg-red-500/20 text-red-400" : "bg-white/10"
                      }`}
                    >
                      {isMutedForMe ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
                {/* Volume Slider */}
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
                    <span className="text-xs text-white/50 w-8">{volume}%</span>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Join/Leave Live + Start Session */}
        <div className="px-4 py-3">
          <div className="flex gap-2">
            {sessionLive ? (
              <button
                onClick={isLiveJoined ? leaveLive : joinLive}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  isLiveJoined
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                }`}
              >
                {isLiveJoined ? (
                  <>
                    <Pause className="w-5 h-5" />
                    Leave Live
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Join Live
                  </>
                )}
              </button>
            ) : isHost ? (
              <button
                onClick={startSession}
                disabled={queuedSongs.length === 0}
                className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
                  queuedSongs.length === 0
                    ? "bg-white/5 text-white/30 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
                }`}
              >
                <Rocket className="w-5 h-5" />
                Start Session
              </button>
            ) : (
              <div className="flex-1 py-3 text-center text-white/50 text-sm">
                Waiting for host to start...
              </div>
            )}
          </div>
        </div>

        {/* Voting Section */}
        {suggestedSongs.length > 0 && (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2">
                <ThumbsUp className="w-5 h-5 text-purple-400" />
                Vote ({suggestedSongs.length}/5)
              </h2>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto rounded-xl">
              {suggestedSongs.map((song) => (
                <motion.div
                  key={song.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl flex items-center gap-3 ${
                    song.itemSource === "ai"
                      ? "bg-purple-500/10 border border-purple-500/20"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  {song.itemType === "music" && (
                    <img
                      src={song.thumbnail}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {song.itemType === "pause"
                        ? `${song.description || "Pause"} - ${song.duration}s`
                        : song.title}
                    </p>
                    <p className="text-xs text-white/40 flex items-center gap-1">
                      {song.itemSource === "ai" ? (
                        <>
                          <Sparkles className="w-3 h-3 text-purple-400" />
                          AI Suggestion
                        </>
                      ) : (
                        song.addedBy
                      )}
                    </p>
                  </div>
                  {votingPhase?.phase === "voting" ? (
                    <button
                      onClick={() => voteSong(song.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                        song.userHasVoted
                          ? "bg-green-500 text-white"
                          : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      }`}
                    >
                      {song.userHasVoted ? "✓" : ""} {song.votes}
                    </button>
                  ) : song.itemSource !== "ai" && song.addedBy === displayName ? (
                    <button
                      onClick={() => removeSongFromSuggestions(song.id)}
                      className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-white/30 shrink-0">
                      {song.votes} votes
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Search Section - Collapsible */}
        <div className="px-4 py-3">
          <button
            onClick={() => {
              if (!showSearch) trackEvent("search_section_opened", { session_id: sessionId });
              setShowSearch(!showSearch);
            }}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <Search className="w-5 h-5 text-purple-400" />
              Search & Add Songs
            </span>
            {showSearch ? (
              <ChevronUp className="w-5 h-5 text-white/50" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/50" />
            )}
          </button>

          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Search songs or paste YouTube link..."
                      className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button
                      onClick={handlePasteLink}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                      <Clipboard className="w-5 h-5" />
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-60 overflow-y-auto rounded-xl">
                      {searchResults.map((video) => (
                        <div
                          key={video.id.videoId}
                          className="flex items-center gap-3 p-2 rounded-xl bg-white/5 hover:bg-white/[0.07] transition-colors"
                        >
                          <img
                            src={video.snippet.thumbnails.default.url}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <p className="flex-1 text-sm truncate">
                            {video.snippet.title}
                          </p>
                          <button
                            onClick={() => proposeSong(video)}
                            disabled={sessionLive && votingPhase?.phase !== "suggestion"}
                            className={`p-2 rounded-lg transition-all shrink-0 ${
                              sessionLive && votingPhase?.phase !== "suggestion"
                                ? "bg-white/5 text-white/30 cursor-not-allowed"
                                : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                            }`}
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Pause */}
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-white/50 mb-2">Add a break</p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="5"
                        value={pauseDuration}
                        onChange={(e) => setPauseDuration(Number(e.target.value))}
                        className="w-16 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-center"
                        disabled={sessionLive && votingPhase?.phase !== "suggestion"}
                      />
                      <input
                        type="text"
                        value={pauseDescription}
                        onChange={(e) => setPauseDescription(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm placeholder-white/30"
                        placeholder="Description"
                        disabled={sessionLive && votingPhase?.phase !== "suggestion"}
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
                              { headers: getAuthHeaders() }
                            );
                            loadSessionData();
                          } catch (err) {
                            console.error(err);
                            alert("Error adding pause");
                          }
                        }}
                        disabled={sessionLive && votingPhase?.phase !== "suggestion"}
                        className={`p-2 rounded-lg transition-all ${
                          sessionLive && votingPhase?.phase !== "suggestion"
                            ? "bg-white/5 text-white/30 cursor-not-allowed"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        <Timer className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Queue Section */}
        <div className="px-4 py-3">
          <button
            onClick={() => setShowQueue(!showQueue)}
            className="w-full flex items-center justify-between mb-3"
          >
            <h2 className="font-semibold flex items-center gap-2">
              <ListMusic className="w-5 h-5 text-purple-400" />
              Queue ({queuedSongs.length})
            </h2>
            {showQueue ? (
              <ChevronUp className="w-5 h-5 text-white/50" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/50" />
            )}
          </button>

          <AnimatePresence>
            {showQueue && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {queue.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    <ListMusic className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Queue is empty</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto rounded-xl pr-1">
                    {queue.map((item, index) => {
                      const isCurrent =
                        currentSong?.queueItemId === item.id && isLiveJoined;

                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
                            isCurrent
                              ? "bg-green-500/20 border border-green-500/30"
                              : item.item_type === "pause"
                                ? "bg-yellow-500/10 border border-yellow-500/20"
                                : item.status === "played"
                                  ? "bg-white/[0.02] opacity-50"
                                  : "bg-white/5"
                          }`}
                        >
                          {isCurrent && (
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0"></span>
                          )}
                          {item.item_type === "music" && (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover shrink-0"
                            />
                          )}
                          {item.item_type === "pause" && (
                            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
                              <Timer className="w-5 h-5 text-yellow-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.item_type === "pause"
                                ? `${item.description || "Pause"} - ${item.duration}s`
                                : item.title}
                            </p>
                            <p className="text-xs text-white/40">
                              {item.addedBy || "Guest"}
                            </p>
                          </div>
                          <span className="text-xs text-white/30 shrink-0">
                            #{index + 1}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Participants Section (Private Sessions) */}
        {session?.is_private === 1 && (
          <div className="px-4 py-3">
            <button
              onClick={() => {
                if (!showParticipants) trackEvent("participants_section_opened", { session_id: sessionId });
                setShowParticipants(!showParticipants);
              }}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Users className="w-5 h-5 text-purple-400" />
                Participants ({liveParticipants.length})
              </span>
              {showParticipants ? (
                <ChevronUp className="w-5 h-5 text-white/50" />
              ) : (
                <ChevronDown className="w-5 h-5 text-white/50" />
              )}
            </button>

            <AnimatePresence>
              {showParticipants && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2 max-h-48 overflow-y-auto">
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

                  {/* Invite Section for Host */}
                  {isHost && (
                    <div className="mt-3 p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-white/50 mb-2">Invite by email</p>
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
                        <p className="text-xs text-green-400 mt-2">Invitation sent!</p>
                      )}
                      {inviteStatus === "error" && (
                        <p className="text-xs text-red-400 mt-2">Invalid email or error.</p>
                      )}
                    </div>
                  )}

                  {/* Accepted Invites Management for Host */}
                  {isHost && acceptedInvites.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs text-white/50">Manage members</p>
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
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Hidden YouTube Player */}
        {isLiveJoined && (
          <div
            id="youtube-player"
            style={{ width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
          ></div>
        )}
      </main>

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