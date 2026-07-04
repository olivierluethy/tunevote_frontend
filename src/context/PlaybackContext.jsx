import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import axios from "axios";
import io from "socket.io-client";

// ---------------------------------------------------------------------------
// GLOBAL PLAYBACK PROVIDER
//
// This provider owns the single YouTube IFrame player, the live-playback
// socket for the *active* session, and all playback-derived state (current
// song, volume, mute, play/pause, voting phase, breaks). It is mounted ONCE
// at the app root (see main.jsx) and never unmounts on navigation — which is
// what lets audio keep playing (YouTube-style mini-player) when the user
// leaves the session detail screen.
//
// SessionPage reads playback state from here and delegates player control to
// here; it no longer owns the player itself.
// ---------------------------------------------------------------------------

const API = "https://api.tunevote.com";
const SOCKET_SERVER = "https://api.tunevote.com/";
const MAX_PLAY_ATTEMPTS = 5;
const PLACEHOLDER_TITLES = new Set(["", "Unknown", "Loading…"]);

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

const PlaybackContext = createContext(null);

export const usePlayback = () => {
  const ctx = useContext(PlaybackContext);
  if (!ctx) {
    throw new Error("usePlayback must be used within a PlaybackProvider");
  }
  return ctx;
};

export const PlaybackProvider = ({ children }) => {
  // The session currently being listened to (survives navigation).
  const [active, setActive] = useState(null); // { sessionId, sessionName }
  const [currentSong, setCurrentSong] = useState(null);
  const [volume, setVolume] = useState(50);
  const [isMutedForMe, setIsMutedForMe] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [votingPhase, setVotingPhase] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const [isPaused, setIsPaused] = useState(false);
  const [pauseRemaining, setPauseRemaining] = useState(0);
  const [pauseTitle, setPauseTitle] = useState("");

  // Active session's queue + suggestions — power the banner's "Up Next" and the
  // queue overlay (vote + suggest without leaving the current page).
  const [queue, setQueue] = useState([]);
  const [proposals, setProposals] = useState([]);

  const playerRef = useRef(null);
  const hostRef = useRef(null); // stable React-owned wrapper for the YT iframe
  const socketRef = useRef(null);
  const syncIntervalRef = useRef(null);
  const pauseTimerRef = useRef(null);
  const autoplayProbeRef = useRef(null);
  const pendingPlayRef = useRef(null);

  const currentVideoIdRef = useRef(null);
  const metaCacheRef = useRef(new Map());

  // Refs mirroring state so socket-driven / YT callbacks read fresh values.
  const activeRef = useRef(null);
  const mutedRef = useRef(false);
  const volumeRef = useRef(50);
  const currentSongRef = useRef(null);
  const selfPausedRef = useRef(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    mutedRef.current = isMutedForMe;
  }, [isMutedForMe]);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  // --- Load the YouTube IFrame API once for the whole app -------------------
  useEffect(() => {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById("youtube-iframe-api")) return;
    const script = document.createElement("script");
    script.id = "youtube-iframe-api";
    script.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(script);
    window.onYouTubeIframeAPIReady = () => {
      // API ready — players are created on demand in createPlayer().
    };
  }, []);

  // === Autoplay retry (browsers block muted autoplay) ======================
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
      /* getVideoData throws before player is fully ready */
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
    try {
      player.playVideo();
    } catch (err) {
      console.warn(`[autoplay] playVideo() threw during ${trigger}:`, err?.message || err);
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

    if (!window.YT || !window.YT.Player || !hostRef.current) {
      // API (or the host wrapper) not ready yet — retry shortly.
      setTimeout(() => createPlayer(videoId, startSeconds, shouldPlay), 300);
      return;
    }

    // Hand YouTube a FRESH child node to replace, never the React-managed
    // wrapper itself. YT.Player() swaps its target element for an <iframe>;
    // if that target were a node React controls, React's later insert/remove
    // operations would throw NotFoundError (corrupted reconciliation). The
    // wrapper (hostRef) stays put; only this disposable child gets replaced.
    hostRef.current.innerHTML = "";
    const target = document.createElement("div");
    hostRef.current.appendChild(target);

    playerRef.current = new window.YT.Player(target, {
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
            playerRef.current.setVolume(volumeRef.current);
          }
          playerRef.current.seekTo(startSeconds, true);

          if (shouldPlay) {
            selfPausedRef.current = false;
            attemptPlay("initial");
            autoplayProbeRef.current = setTimeout(() => {
              autoplayProbeRef.current = null;
              const state = playerRef.current?.getPlayerState?.();
              if (state === 1) return;
              attemptPlay("probe");
            }, 2000);
          }
        },
        onStateChange: (e) => {
          if (e.data === 1 /* PLAYING */) {
            setIsPlaying(true);
            if (autoplayProbeRef.current) {
              clearTimeout(autoplayProbeRef.current);
              autoplayProbeRef.current = null;
            }
            const pending = pendingPlayRef.current;
            if (pending && pending.videoId === videoId) {
              pendingPlayRef.current = null;
            }
          } else if (e.data === 2 /* PAUSED */) {
            setIsPlaying(false);
          }
        },
        onError: (e) => {
          console.warn(`[autoplay] YT player error (code=${e?.data}) for ${videoId}`);
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
      const res = await axios.get(`${API}/youtube-info/${videoId}`);
      const title = res.data?.snippet?.title;
      const thumbnail =
        res.data?.snippet?.thumbnails?.medium?.url ||
        res.data?.snippet?.thumbnails?.default?.url ||
        "";
      if (!title) return;
      metaCacheRef.current.set(videoId, { title, thumbnail });
      if (currentVideoIdRef.current !== videoId) return;
      setCurrentSong((prev) =>
        prev && prev.videoId === videoId ? { ...prev, title, thumbnail } : prev
      );
    } catch (err) {
      console.warn("[metadata fallback] failed for", videoId, err.message);
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
    const elapsed = (Date.now() - video_start_time) / 1000;
    const progress = Math.max(0, elapsed);

    const cachedMeta = metaCacheRef.current.get(current_video_id);
    const prevSong = currentSongRef.current;
    const prevValid =
      prevSong?.videoId === current_video_id &&
      prevSong?.title &&
      !PLACEHOLDER_TITLES.has(prevSong.title);

    let resolvedTitle = cachedMeta?.title || null;
    let resolvedThumb = cachedMeta?.thumbnail || "";
    if (!resolvedTitle && prevValid) {
      resolvedTitle = prevSong.title;
      resolvedThumb = prevSong.thumbnail || resolvedThumb;
    }

    setCurrentSong({
      queueItemId: current_queue_item_id,
      videoId: current_video_id,
      title: resolvedTitle || "Loading…",
      thumbnail: resolvedThumb,
    });

    createPlayer(current_video_id, progress, is_playing);

    if (!resolvedTitle) {
      fetchAndApplyMetadata(current_video_id);
    }
  };

  // Seed the metadata cache from the session queue so the mini-player shows
  // real titles immediately instead of "Loading…".
  const seedMetaFromQueue = async (sessionId) => {
    try {
      const { data } = await axios.get(`${API}/sessions/${sessionId}/queue`, {
        headers: getAuthHeaders(),
      });
      (data || []).forEach((item) => {
        if (item.video_id && item.title) {
          metaCacheRef.current.set(item.video_id, {
            title: item.title,
            thumbnail: item.thumbnail || "",
          });
        }
      });
    } catch {
      /* non-fatal — fetchAndApplyMetadata covers the gap */
    }
  };

  const loadCurrentPhase = async (sessionId) => {
    try {
      const res = await axios.get(`${API}/sessions/${sessionId}/current-phase`, {
        headers: getAuthHeaders(),
      });
      if (res.data && res.data.phase && res.data.endsAt) {
        const endsAt = new Date(res.data.endsAt).getTime();
        setVotingPhase({
          phase: res.data.phase,
          endsAt,
          duration: res.data.duration || 90,
          roundId: res.data.roundId,
        });
        setTimeRemaining(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
      }
    } catch (err) {
      console.warn("Could not load current phase", err.response?.status);
    }
  };

  // === Queue + suggestions for the active session =========================
  const loadQueue = useCallback(async (sessionId) => {
    try {
      const { data } = await axios.get(`${API}/sessions/${sessionId}/queue`, {
        headers: getAuthHeaders(),
      });
      setQueue(data || []);
    } catch (err) {
      console.warn("Could not load queue", err.response?.status);
    }
  }, []);

  const loadProposals = useCallback(async (sessionId) => {
    try {
      const { data } = await axios.get(
        `${API}/sessions/${sessionId}/proposals`,
        { headers: getAuthHeaders() }
      );
      setProposals(data || []);
    } catch (err) {
      console.warn("Could not load proposals", err.response?.status);
    }
  }, []);

  // Vote for a suggested song from the banner or the queue overlay.
  const voteProposal = useCallback(async (proposalId) => {
    const sessionId = activeRef.current?.sessionId;
    if (!sessionId) return;
    try {
      await axios.post(
        `${API}/sessions/${sessionId}/proposals/${proposalId}/vote`,
        {},
        { headers: getAuthHeaders() }
      );
      loadProposals(sessionId);
    } catch (err) {
      console.error("Voting error:", err);
      alert(err.response?.data?.message || "Error voting");
    }
  }, [loadProposals]);

  // Suggest a new song into the active session (from the queue overlay).
  const proposeSong = useCallback(async (video) => {
    const sessionId = activeRef.current?.sessionId;
    if (!sessionId) return false;
    const videoId = video.id?.videoId || video.youtubeId;
    const title = video.snippet?.title || video.title;
    const thumbnail =
      video.snippet?.thumbnails?.medium?.url ||
      video.snippet?.thumbnails?.default?.url ||
      video.thumbnail ||
      `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    if (!videoId || !title) return false;
    try {
      await axios.post(
        `${API}/sessions/${sessionId}/proposals`,
        { videoId, title, thumbnail },
        { headers: getAuthHeaders() }
      );
      loadProposals(sessionId);
      return true;
    } catch (err) {
      alert(
        err.response?.data?.message === "Maximal 5 Songs pro Voting-Runde erlaubt."
          ? "🚫 Maximum 5 songs per voting round."
          : "Error suggesting: " + (err.response?.data?.message || "Unknown error")
      );
      return false;
    }
  }, [loadProposals]);

  // Lightweight YouTube search for the suggest field in the queue overlay.
  const searchSongs = useCallback(async (query) => {
    const key = import.meta.env.VITE_YOUTUBE_KEY;
    if (!query.trim() || !key) return [];
    try {
      const res = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            type: "video",
            maxResults: 6,
            q: query,
            key,
          },
        }
      );
      return res.data.items || [];
    } catch (err) {
      console.warn("YouTube search failed", err.message);
      return [];
    }
  }, []);

  // === Full teardown of the current live session ===========================
  const teardownPlayback = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (pauseTimerRef.current) {
      clearInterval(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (autoplayProbeRef.current) {
      clearTimeout(autoplayProbeRef.current);
      autoplayProbeRef.current = null;
    }
    pendingPlayRef.current = null;
    if (playerRef.current) {
      try {
        playerRef.current.stopVideo();
        playerRef.current.destroy();
      } catch {
        /* player already gone */
      }
      playerRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    currentVideoIdRef.current = null;
    setCurrentSong(null);
    setQueue([]);
    setProposals([]);
    setVotingPhase(null);
    setTimeRemaining(0);
    setIsPaused(false);
    setPauseRemaining(0);
    setPauseTitle("");
    setIsPlaying(false);
  }, []);

  // === Live-playback socket for the active session =========================
  const connectSocket = (sessionId) => {
    const token = localStorage.getItem("token");
    const guestToken = localStorage.getItem("guestToken");

    const socket = io(SOCKET_SERVER, {
      query: { sessionId },
      auth: token ? { token } : { guestToken },
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => console.warn("Playback socket error", err));

    socket.on("playback_sync", (data) => {
      if (activeRef.current?.sessionId !== sessionId) return;
      syncPlayback(data);
    });

    socket.on("session_started", (data) => {
      if (activeRef.current?.sessionId !== sessionId) return;
      if (data.firstVideoId) {
        syncPlayback({
          current_video_id: data.firstVideoId,
          video_start_time: data.video_start_time,
          is_playing: true,
        });
      }
    });

    socket.on("voting_phase_changed", (data) => {
      if (activeRef.current?.sessionId !== sessionId) return;
      setVotingPhase({
        phase: data.phase,
        endsAt: data.endsAt,
        duration: data.duration || (data.phase === "suggestion" ? 90 : 60),
        roundId: data.roundId,
      });
      setTimeRemaining(Math.max(0, Math.floor((data.endsAt - Date.now()) / 1000)));
    });

    socket.on("pause_started", ({ title, duration }) => {
      if (activeRef.current?.sessionId !== sessionId) return;
      setIsPaused(true);
      setPauseTitle(title);
      setPauseRemaining(duration);
      if (playerRef.current) playerRef.current.pauseVideo();
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

    socket.on("pause_ended", () => {
      if (activeRef.current?.sessionId !== sessionId) return;
      setIsPaused(false);
      setPauseRemaining(0);
      setPauseTitle("");
      if (pauseTimerRef.current) clearInterval(pauseTimerRef.current);
      if (playerRef.current && !selfPausedRef.current) playerRef.current.playVideo();
    });

    socket.on("session_ended", ({ message }) => {
      if (activeRef.current?.sessionId !== sessionId) return;
      if (message) alert(message);
      teardownPlayback();
      setActive(null);
    });

    // Keep the banner's Up Next + queue overlay live as others vote/suggest.
    socket.on("proposals_updated", () => {
      if (activeRef.current?.sessionId !== sessionId) return;
      loadProposals(sessionId);
    });
    socket.on("queue_updated", () => {
      if (activeRef.current?.sessionId !== sessionId) return;
      loadQueue(sessionId);
      loadProposals(sessionId);
    });
  };

  // === Public actions =======================================================

  // Join a session's live playback. Handles hand-off automatically: if the
  // user is already live in a different session, that one is torn down first
  // so only one session is ever active.
  const joinLive = useCallback(
    async ({ sessionId, sessionName }) => {
      if (!sessionId) return;
      if (activeRef.current?.sessionId === sessionId) return; // already here

      // Hand off from a previous session.
      if (activeRef.current) {
        const prev = activeRef.current.sessionId;
        try {
          await axios.post(
            `${API}/sessions/${prev}/leave-live`,
            {},
            { headers: getAuthHeaders() }
          );
        } catch (err) {
          console.warn("leave-live (handoff) failed", err.message);
        }
        teardownPlayback();
      }

      const mute = localStorage.getItem(`mute_${sessionId}`) === "true";
      mutedRef.current = mute;
      setIsMutedForMe(mute);

      setActive({ sessionId, sessionName });
      activeRef.current = { sessionId, sessionName };

      seedMetaFromQueue(sessionId);
      connectSocket(sessionId);

      try {
        await axios.post(
          `${API}/sessions/${sessionId}/join-live`,
          {},
          { headers: getAuthHeaders() }
        );
        const { data } = await axios.get(
          `${API}/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() }
        );
        if (data.current_video_id && data.video_start_time) {
          syncPlayback(data);
        }
      } catch (err) {
        console.error("Join Live failed", err);
        teardownPlayback();
        setActive(null);
        alert("Error joining live session");
        return;
      }

      loadCurrentPhase(sessionId);
      loadQueue(sessionId);
      loadProposals(sessionId);

      // Drift-correction poll.
      syncIntervalRef.current = setInterval(async () => {
        if (activeRef.current?.sessionId !== sessionId) return;
        try {
          const { data } = await axios.get(
            `${API}/sessions/${sessionId}/playback-sync`,
            { headers: getAuthHeaders() }
          );
          if (data.current_video_id && data.video_start_time) {
            const elapsed = (Date.now() - data.video_start_time) / 1000;
            const current = playerRef.current?.getCurrentTime?.() || 0;
            if (Math.abs(current - elapsed) > 2) {
              playerRef.current?.seekTo(elapsed, true);
            }
          }
        } catch (e) {
          console.warn("Sync failed:", e.message);
        }
      }, 10000);
    },
    [teardownPlayback]
  );

  // Fully leave the active session (mini-player ✕ or "Leave live playback").
  const leaveLive = useCallback(async () => {
    const current = activeRef.current;
    teardownPlayback();
    setActive(null);
    if (current) {
      try {
        await axios.post(
          `${API}/sessions/${current.sessionId}/leave-live`,
          {},
          { headers: getAuthHeaders() }
        );
      } catch (err) {
        console.error("Leave failed", err);
      }
    }
  }, [teardownPlayback]);

  const setVolumeLevel = useCallback((vol) => {
    setVolume(vol);
    volumeRef.current = vol;
    playerRef.current?.setVolume(mutedRef.current ? 0 : vol);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMutedForMe((prev) => {
      const next = !prev;
      mutedRef.current = next;
      if (activeRef.current) {
        localStorage.setItem(`mute_${activeRef.current.sessionId}`, next);
      }
      if (next) {
        playerRef.current?.mute();
      } else {
        playerRef.current?.unMute();
        playerRef.current?.setVolume(volumeRef.current);
      }
      return next;
    });
  }, []);

  // Play/pause = stop MY audio / resume and re-sync to the live position.
  const togglePlayPause = useCallback(async () => {
    if (isPaused) return; // during a break, playback is host-controlled
    const player = playerRef.current;
    if (!player) return;

    if (selfPausedRef.current) {
      // Resume: jump back to the live position, then play.
      const sessionId = activeRef.current?.sessionId;
      try {
        const { data } = await axios.get(
          `${API}/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() }
        );
        if (data?.video_start_time) {
          const elapsed = (Date.now() - data.video_start_time) / 1000;
          player.seekTo(Math.max(0, elapsed), true);
        }
      } catch (e) {
        console.warn("resume resync failed", e.message);
      }
      selfPausedRef.current = false;
      player.playVideo();
      setIsPlaying(true);
    } else {
      selfPausedRef.current = true;
      player.pauseVideo();
      setIsPlaying(false);
    }
  }, [isPaused]);

  // === Voting-phase countdown (single source of truth) =====================
  useEffect(() => {
    if (!votingPhase) {
      setTimeRemaining(0);
      return;
    }
    const timer = setInterval(() => {
      setTimeRemaining(() => {
        const remaining = Math.max(
          0,
          Math.floor((votingPhase.endsAt - Date.now()) / 1000)
        );
        if (remaining <= 0) {
          clearInterval(timer);
          if (votingPhase.phase === "suggestion" || votingPhase.phase === "voting") {
            setVotingPhase(null);
          }
          return 0;
        }
        return remaining;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [votingPhase]);

  // === Media Session API (lock-screen / hardware media keys) ===============
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    if (!currentSong || !currentSong.videoId) {
      try {
        navigator.mediaSession.metadata = null;
      } catch {
        /* older browsers */
      }
      return;
    }
    if (PLACEHOLDER_TITLES.has(currentSong.title)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title,
        artist: active?.sessionName || "TuneVote",
        album: "TuneVote",
        artwork: currentSong.thumbnail
          ? [{ src: currentSong.thumbnail, sizes: "512x512", type: "image/jpeg" }]
          : [],
      });
    } catch (err) {
      console.warn("[mediaSession] metadata update failed:", err);
    }
  }, [currentSong, active?.sessionName]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const inSilence = isMutedForMe || isPaused || !isPlaying;
    navigator.mediaSession.playbackState = inSilence ? "paused" : "playing";
  }, [isMutedForMe, isPaused, isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.setActionHandler("play", () => togglePlayPause());
      navigator.mediaSession.setActionHandler("pause", () => togglePlayPause());
    } catch (err) {
      console.warn("[mediaSession] setActionHandler failed:", err);
    }
    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
      } catch {
        /* older browsers */
      }
    };
  }, [togglePlayPause]);

  // === Re-sync when the tab becomes visible again ==========================
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState !== "visible") return;
      const sessionId = activeRef.current?.sessionId;
      if (!sessionId) return;
      if (!selfPausedRef.current) attemptPlay("visibility");
      await new Promise((r) => setTimeout(r, 150));
      try {
        const { data } = await axios.get(
          `${API}/sessions/${sessionId}/playback-sync`,
          { headers: getAuthHeaders() }
        );
        if (data?.current_video_id && data.video_start_time && !selfPausedRef.current) {
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
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const value = {
    // state
    active,
    activeSessionId: active?.sessionId || null,
    currentSong,
    volume,
    isMutedForMe,
    isPlaying,
    votingPhase,
    timeRemaining,
    isPaused,
    pauseRemaining,
    pauseTitle,
    queue,
    proposals,
    // actions
    joinLive,
    leaveLive,
    setVolume: setVolumeLevel,
    toggleMute,
    togglePlayPause,
    voteProposal,
    proposeSong,
    searchSongs,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      {/* The single, persistent player host — lives at the app root so it
          survives route changes. React owns this wrapper but never touches its
          contents; createPlayer() appends a disposable child inside it for the
          YouTube iframe, so React reconciliation is never corrupted. */}
      <div
        ref={hostRef}
        aria-hidden="true"
        style={{ width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
      />
    </PlaybackContext.Provider>
  );
};

export default PlaybackProvider;
