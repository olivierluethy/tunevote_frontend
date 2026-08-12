// src/pages/Dashboard.jsx
import { useEffect, useState, Fragment, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Transition } from "@headlessui/react";
import { io } from "socket.io-client";
import GenreRanking from "../components/GenreRanking";

const API_BASE = (import.meta.env.VITE_API_URL || "https://api.tunevote.com").replace(/\/+$/, "");
import {
  trackEvent,
  trackPageView,
  createScrollTracker,
  createTimeTracker,
} from "../utils/analytics";
import {
  Plus,
  LogOut,
  Copy,
  Trash2,
  Radio,
  Clock,
  Music,
  Sparkles,
  AlertCircle,
  UserPlus,
  Ban,
  CheckCircle,
  ChevronDown,
  User,
  XCircle,
  Lock,
  X,
  Globe,
  QrCode,
  Mail,
  Send,
  MoreVertical,
  Crown,
  Play,
  ArrowRight,
  Headphones,
  ArrowUpDown,
  Check,
} from "lucide-react";
import LiveViewerCount from "../components/LiveViewerCount";
import { usePlayback } from "../context/PlaybackContext";

// Remember when each session was last opened from this device so the "Recently
// opened" sort — and a freshly created, auto-joined session — surface first.
const LAST_OPENED_KEY = "tv_last_opened";
const getLastOpenedMap = () => {
  try {
    return JSON.parse(localStorage.getItem(LAST_OPENED_KEY) || "{}");
  } catch {
    return {};
  }
};
const markSessionOpened = (id) => {
  try {
    const map = getLastOpenedMap();
    map[id] = Date.now();
    localStorage.setItem(LAST_OPENED_KEY, JSON.stringify(map));
  } catch {
    /* localStorage unavailable — non-fatal */
  }
};

const SORT_OPTIONS = [
  { key: "recent", label: "Recently created" },
  { key: "opened", label: "Recently opened" },
  { key: "active", label: "Most active" },
  { key: "hosting", label: "Hosted by me first" },
  { key: "alpha", label: "A–Z" },
];

// Four little bars that borrow the mini-player's equalizer so a live room on
// the dashboard reads as the same "on air" thing as the persistent player.
// Purely decorative; falls back to a calm half-height bar under reduced motion.
const LiveBars = ({ className = "" }) => (
  <span
    className={`inline-flex items-end gap-[3px] ${className}`}
    aria-hidden="true"
  >
    {[0, 1, 2, 3].map((i) => (
      <span
        key={i}
        className="w-[3px] h-full origin-bottom rounded-full bg-emerald-300 animate-equalize motion-reduce:animate-none motion-reduce:!h-1/2"
        style={{ animationDelay: `${i * 130}ms` }}
      />
    ))}
  </span>
);

export default function Dashboard() {
  const navigate = useNavigate();

  // The session this device is currently listening to (survives navigation via
  // the global playback provider). Powers the "You're listening" state so the
  // dashboard always shows which live room you're in — same source as the
  // persistent mini-player.
  const { activeSessionId } = usePlayback();

  // Auth
  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const username = localStorage.getItem("username");
  const guestName = localStorage.getItem("guestName") || "Gast";
  const userId = localStorage.getItem("userId");

  // State
  const [sessions, setSessions] = useState([]);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);

  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);

  // UI state
  // ---------------------------------------------------------------------------
  // Filter only renders above a certain session count threshold — below that,
  // it's noise. `showSentInvitesModal` is used to surface sent-invite status.
  // ---------------------------------------------------------------------------
  const FILTER_THRESHOLD = 5;
  const [filterType, setFilterType] = useState("all"); // all, public, private
  const [sortBy, setSortBy] = useState("recent"); // recent, opened, active, alpha
  const [qrModalSession, setQrModalSession] = useState(null);
  const [showSentInvitesModal, setShowSentInvitesModal] = useState(false);

  // Checks
  const isGuest = !token && guestToken;
  const isLoggedIn = !!token;
  const displayName = isGuest ? guestName : username;

  const [profileImage, setProfileImage] = useState(null);

  const socketRef = useRef(null);

  // Socket — participant counts update live across the dashboard.
  useEffect(() => {
    socketRef.current = io(`${API_BASE}/`);

    socketRef.current.on("participant_count_update", (data) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === data.sessionId ? { ...s, participant_count: data.count } : s
        )
      );
    });

    // Live session rename — update the card title without waiting for a refetch.
    socketRef.current.on("session_renamed", (data) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === data.sessionId ? { ...s, title: data.title } : s
        )
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off("participant_count_update");
        socketRef.current.off("session_renamed");
        socketRef.current.disconnect();
      }
    };
  }, []);

  const getAuthHeaders = () => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (guestToken) headers["x-guest-token"] = guestToken;
    return headers;
  };

  // === Sessions loading ===
  const fetchSessions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/sessions`, {
        headers: getAuthHeaders(),
      });
      setSessions(res.data);
    } catch (err) {
      console.error("Failed to load sessions:", err);

      if (
        !isGuest &&
        (err.response?.status === 401 || err.response?.status === 403)
      ) {
        localStorage.clear();
        navigate("/login");
      }
    }
  };

  const fetchSentInvites = async () => {
    try {
      const res = await axios.get(`${API_BASE}/invites/sent`, {
        headers: getAuthHeaders(),
      });
      setSentInvites(res.data);
    } catch (err) {
      console.error("Failed to load sent invites:", err);
    }
  };

  const fetchReceivedInvites = async () => {
    try {
      const res = await axios.get(`${API_BASE}/invites/received`, {
        headers: getAuthHeaders(),
      });
      setReceivedInvites(res.data);
    } catch (err) {
      console.error("Failed to load received invites:", err);
    }
  };

  const fetchProfileData = async () => {
    if (!isLoggedIn) return;

    try {
      const res = await axios.get(`${API_BASE}/profile`, {
        headers: getAuthHeaders(),
      });

      const { imageType, imageData } = res.data;
      if (imageData && imageType) {
        setProfileImage(`data:${imageType};base64,${imageData}`);
      } else {
        setProfileImage(null);
      }
    } catch (err) {
      console.error("Failed to load profile image:", err);
      setProfileImage(null);
    }
  };

  const revokeInvite = async (inviteId) => {
    if (
      !window.confirm(
        "Revoke this invitation? The recipient won't be able to accept it anymore."
      )
    ) {
      return;
    }

    try {
      await axios.post(
        `${API_BASE}/invites/${inviteId}/revoke`,
        {},
        { headers: getAuthHeaders() }
      );
      fetchSentInvites();
      fetchReceivedInvites();
    } catch (err) {
      alert("Could not revoke invitation");
      console.error(err);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      fetchSentInvites();
      fetchReceivedInvites();
    }
  }, [isLoggedIn]);

  const acceptInvite = async (inviteId) => {
    try {
      await axios.post(
        `${API_BASE}/invites/${inviteId}/accept`,
        {},
        { headers: getAuthHeaders() }
      );

      setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
      fetchSessions();
      trackEvent("invitation_accepted", { invite_id: inviteId });
    } catch (err) {
      console.error("Accept failed:", err);
      alert("Could not accept invitation");
      fetchReceivedInvites();
    }
  };

  const rejectInvite = async (inviteId) => {
    try {
      await axios.post(
        `${API_BASE}/invites/${inviteId}/reject`,
        {},
        { headers: getAuthHeaders() }
      );

      setReceivedInvites((prev) => prev.filter((i) => i.id !== inviteId));
      trackEvent("invitation_rejected", { invite_id: inviteId });
    } catch (err) {
      console.error("Reject failed:", err);
      alert("Could not reject invitation");
      fetchReceivedInvites();
    }
  };

  useEffect(() => {
    if (token || guestToken) {
      fetchSessions();
    } else {
      navigate("/login");
    }
  }, [token, guestToken]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchProfileData();
    }
  }, [isLoggedIn]);

  // === Analytics: page view, scroll depth, time on page ===
  useEffect(() => {
    trackPageView("/dashboard", "Dashboard");
    trackEvent("dashboard_viewed", {
      user_type: isGuest ? "guest" : "registered",
    });

    const cleanupScroll = createScrollTracker("dashboard");
    const sendTime = createTimeTracker("dashboard");

    return () => {
      cleanupScroll();
      sendTime();
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleRegister = () => {
    localStorage.clear();
    navigate("/register");
  };

  const createSession = async () => {
    if (!isLoggedIn || !newSessionTitle.trim() || loading) return;
    setLoading(true);
    try {
      const res = await axios.post(
        `${API_BASE}/sessions`,
        {
          title: newSessionTitle,
          is_private: isPrivate ? 1 : 0,
        },
        { headers: getAuthHeaders() }
      );
      setNewSessionTitle("");
      trackEvent("session_created", {
        session_id: res.data.id,
        is_private: isPrivate,
      });
      // Drop the host straight into their new room instead of making them hunt
      // for it in the list — the session page focuses the add-song input on
      // arrival so they can start building the queue immediately.
      markSessionOpened(res.data.id);
      navigate(`/session/${res.data.public_id || res.data.id}`);
    } catch (err) {
      alert("Could not create session");
      trackEvent("session_create_failed");
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`${API_BASE}/sessions/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setShowDeleteModal(null);
      trackEvent("session_deleted", { session_id: sessionId });
    } catch (err) {
      alert("Could not delete session");
    }
  };

  // `publicId` (the long share id) goes in the URL; `sessionId` (numeric) still
  // drives the "Copied" UI state so it matches the card's copiedId === s.id.
  const copyJoinLink = (sessionId, publicId) => {
    const link = `${window.location.origin}/session/${publicId || sessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
    trackEvent("session_link_copied", { session_id: sessionId });
  };

  const openSession = (session) => {
    trackEvent("session_opened_from_dashboard", {
      session_id: session.id,
      session_title: session.title,
    });
    markSessionOpened(session.id);
    navigate(`/session/${session.public_id || session.id}`);
  };

  // ---------------------------------------------------------------------------
  // DERIVED STATE — the dashboard is split into two activation zones (make vs.
  // join) plus a browse grid.
  //
  //   liveSessions      → the "On air" rail (join in one tap)
  //   pendingInvites    → someone is waiting for a reply
  //   otherSessions     → the browse grid (everything not currently live)
  //
  // First-run is keyed on sessions the user actually HOSTS, not just anything
  // visible: a brand-new account still sees public radio rooms, but should be
  // pushed to create their own.
  // ---------------------------------------------------------------------------
  const isHostOf = (s) => isLoggedIn && userId && Number(userId) === s.hostId;

  const pendingInvites = receivedInvites.filter(
    (i) => !i.accepted_at && !i.revoked_at
  );
  // activeSessionId comes from the route param (a string); session ids are
  // numbers — compare as strings so the match actually lands.
  const isActiveSession = (s) =>
    activeSessionId != null && String(s.id) === String(activeSessionId);
  // The room you're currently in floats to the front of the rail so "You're
  // listening" is always the first thing you see.
  const liveSessions = sessions
    .filter((s) => s.status === "live")
    .sort((a, b) => {
      if (isActiveSession(a)) return -1;
      if (isActiveSession(b)) return 1;
      return 0;
    });
  const nonLiveSessions = sessions.filter((s) => s.status !== "live");
  const ownedSessions = sessions.filter(isHostOf);

  const filteredOtherSessions = nonLiveSessions.filter((s) => {
    if (filterType === "public") return s.is_private !== 1;
    if (filterType === "private") return s.is_private === 1;
    return true;
  });

  const lastOpenedMap = getLastOpenedMap();
  const sortedOtherSessions = [...filteredOtherSessions].sort((a, b) => {
    if (sortBy === "alpha") return (a.title || "").localeCompare(b.title || "");
    if (sortBy === "active")
      return (b.participant_count || 0) - (a.participant_count || 0);
    if (sortBy === "opened")
      return (lastOpenedMap[b.id] || 0) - (lastOpenedMap[a.id] || 0);
    if (sortBy === "hosting") {
      // Sessions you host first, then newest.
      const ah = isHostOf(a) ? 1 : 0;
      const bh = isHostOf(b) ? 1 : 0;
      if (ah !== bh) return bh - ah;
      return new Date(b.created_at) - new Date(a.created_at);
    }
    // "recent" (default): newest first.
    return new Date(b.created_at) - new Date(a.created_at);
  });

  const hasZeroSessions = sessions.length === 0;
  // First-run = a logged-in host with no rooms of their own. If userId is
  // somehow absent (ownership unknowable), fall back to "no sessions at all"
  // so returning users aren't wrongly dropped back into the first-run hero.
  const isFirstRun =
    isLoggedIn && (userId ? ownedSessions.length === 0 : hasZeroSessions);
  const pendingSentInvitesCount = sentInvites.filter(
    (i) => i.status === "pending"
  ).length;

  // === Auth guard ===
  if (!token && !guestToken) {
    navigate("/login");
    return null;
  }

  // Format a date relative to now ("today", "yesterday", "3 days ago", or date)
  const formatRelativeDate = (iso) => {
    const d = new Date(iso);
    const diffDays = Math.floor(
      (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // ---------------------------------------------------------------------------
  // The per-session overflow menu (QR / copy / delete). Shared by both the
  // live cards and the browse-grid cards.
  //
  // IMPORTANT: this and the card renderers below are plain functions returning
  // JSX, NOT nested components. A nested `const Card = …` would get a new
  // identity on every Dashboard render, so React would unmount/remount every
  // card — tearing down any open Headless UI <Menu> mid-interaction whenever a
  // socket participant-count event fires. Plain functions reconcile by key.
  // ---------------------------------------------------------------------------
  const renderCardMenu = (s) => (
    <Menu as="div" className="relative">
      <Menu.Button
        onClick={(e) => e.stopPropagation()}
        className="grid place-items-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        title="More actions"
      >
        <MoreVertical className="w-4 h-4" />
      </Menu.Button>
      <Menu.Items
        anchor="bottom end"
        transition
        className="w-44 origin-top-right rounded-xl bg-slate-900 border border-white/10 shadow-xl overflow-hidden z-50 [--anchor-gap:0.5rem] transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
      >
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setQrModalSession(s);
                }}
                className={`${
                  active ? "bg-white/5" : ""
                } flex w-full items-center gap-2 px-3 py-2.5 text-sm`}
              >
                <QrCode className="w-4 h-4 text-violet-400" />
                Show QR code
              </button>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  copyJoinLink(s.id, s.public_id);
                }}
                className={`${
                  active ? "bg-white/5" : ""
                } flex w-full items-center gap-2 px-3 py-2.5 text-sm`}
              >
                <Copy className="w-4 h-4 text-violet-400" />
                Copy share link
              </button>
            )}
          </Menu.Item>
          {isHostOf(s) && (
            <>
              <div className="h-px bg-white/5" />
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteModal(s.id);
                    }}
                    className={`${
                      active ? "bg-red-500/10" : ""
                    } flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-400`}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete session
                  </button>
                )}
              </Menu.Item>
            </>
          )}
      </Menu.Items>
    </Menu>
  );

  // ---------------------------------------------------------------------------
  // Live "on air" card — the join path. The session the user is currently
  // listening to (activeSessionId) gets an emerald "You're listening" state so
  // returning to the dashboard always shows where you are.
  // ---------------------------------------------------------------------------
  const renderLiveCard = (s) => {
    const isCurrent = isActiveSession(s);

    return (
      <motion.div
        key={s.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        whileHover={{ y: -3 }}
        onClick={() => openSession(s)}
        className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-4 transition-colors ${
          isCurrent
            ? "border-emerald-400/60 bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent shadow-lg shadow-emerald-500/20"
            : "border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent hover:border-emerald-400/50"
        }`}
      >
        {/* ambient on-air glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl"
        />

        <div className="relative flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            <LiveBars className="h-3" />
            {isCurrent ? "You're listening" : "On air"}
          </span>
          <span onClick={(e) => e.stopPropagation()}>{renderCardMenu(s)}</span>
        </div>

        <h3 className="relative mt-3 line-clamp-2 text-lg font-bold leading-tight text-emerald-50">
          {s.title}
        </h3>

        <div className="relative mt-3 flex items-center justify-between gap-2">
          <LiveViewerCount count={s.participant_count || 0} live />
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              isCurrent
                ? "bg-emerald-400 text-emerald-950"
                : "bg-emerald-500/20 text-emerald-200 group-hover:bg-emerald-500 group-hover:text-emerald-950"
            }`}
          >
            {isCurrent ? (
              <>
                <Headphones className="h-4 w-4" />
                Back to session
              </>
            ) : (
              <>
                <Play className="h-4 w-4" fill="currentColor" />
                Join
              </>
            )}
          </span>
        </div>
      </motion.div>
    );
  };

  // ---------------------------------------------------------------------------
  // Browse-grid card — compact tile for a non-live session.
  // ---------------------------------------------------------------------------
  const renderSessionCard = (s) => {
    const priv = s.is_private === 1;

    return (
      <motion.div
        key={s.id}
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        whileHover={{ y: -3 }}
        onClick={() => openSession(s)}
        className="group flex cursor-pointer flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 backdrop-blur-xl transition-colors hover:border-violet-400/30 hover:bg-white/[0.07]"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                priv
                  ? "bg-fuchsia-500/15 text-fuchsia-300"
                  : "bg-violet-500/15 text-violet-300"
              }`}
            >
              {priv ? (
                <Lock className="h-3 w-3" />
              ) : (
                <Globe className="h-3 w-3" />
              )}
              {priv ? "Private" : "Public"}
            </span>
            {isHostOf(s) && (
              <span
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300"
                title="You host this session"
              >
                <Crown className="h-3 w-3" />
                Hosting
              </span>
            )}
          </div>
          {renderCardMenu(s)}
        </div>

        <h3 className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug text-white group-hover:text-violet-100">
          {s.title}
        </h3>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-white/45">
          <LiveViewerCount count={s.participant_count || 0} />
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatRelativeDate(s.created_at)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5 border-t border-white/5 pt-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              copyJoinLink(s.id, s.public_id);
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              copiedId === s.id
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            {copiedId === s.id ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Share
              </>
            )}
          </button>
          <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/60 transition-colors group-hover:bg-violet-500/20 group-hover:text-violet-200">
            Open
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </motion.div>
    );
  };

  // ---------------------------------------------------------------------------
  // The create form — reused in both the compact console hero and the big
  // first-run hero. `hero` scales the input/CTA up for the first-run layout.
  // ---------------------------------------------------------------------------
  const renderCreateForm = ({ hero = false } = {}) => (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createSession();
        }}
        className="flex flex-col gap-2.5"
      >
        <input
          type="text"
          placeholder={
            hero
              ? "Name your room — e.g. Friday night party, Road trip 2026…"
              : "Name your session…"
          }
          className={`w-full rounded-xl border border-white/10 bg-white/5 placeholder-white/30 transition-colors focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 ${
            hero ? "px-4 py-3.5 text-base" : "px-4 py-3 text-sm"
          }`}
          value={newSessionTitle}
          onChange={(e) => setNewSessionTitle(e.target.value)}
          disabled={loading}
        />

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setIsPrivate(false)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                !isPrivate
                  ? "bg-violet-500 text-white shadow-sm"
                  : "text-white/60 hover:bg-white/5"
              }`}
            >
              <Globe className="h-4 w-4" />
              Public
            </button>
            <button
              type="button"
              onClick={() => setIsPrivate(true)}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all ${
                isPrivate
                  ? "bg-fuchsia-500 text-white shadow-sm"
                  : "text-white/60 hover:bg-white/5"
              }`}
            >
              <Lock className="h-4 w-4" />
              Private
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !newSessionTitle.trim()}
            className={`flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 font-semibold text-white transition-all hover:shadow-lg hover:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-40 ${
              hero ? "px-6 py-3.5 text-base" : "px-5 py-2.5 text-sm"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Creating…" : "Create session"}
          </button>
        </div>
      </form>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-white/45">
        {isPrivate ? (
          <>
            <Lock className="h-3 w-3 text-fuchsia-300" />
            Private — only people you invite can join.
          </>
        ) : (
          <>
            <Globe className="h-3 w-3 text-violet-300" />
            Public — anyone with the link can join.
          </>
        )}
      </p>
    </>
  );

  return (
    <div className="min-h-screen bg-[#070312] text-white">
      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/4 h-[520px] w-[520px] rounded-full bg-violet-600/20 blur-[130px]" />
        <div className="absolute bottom-0 right-1/4 h-[420px] w-[420px] rounded-full bg-fuchsia-600/15 blur-[110px]" />
        <div className="absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[120px]" />
      </div>

      {/* ── HEADER — slim, full-width identity bar ─────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-40 border-b border-white/5 bg-[#070312]/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img
              src="/icons/icon.png"
              alt="TuneVote"
              className="h-9 w-9 drop-shadow-[0_0_12px_rgba(139,92,246,0.45)]"
            />
            <span className="text-lg font-black tracking-tight">TuneVote</span>
          </div>

          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1.5 transition-colors hover:bg-white/10">
              <div className="h-8 w-8 overflow-hidden rounded-full ring-2 ring-white/10">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">
                {displayName}
              </span>
              {isGuest && (
                <span className="hidden rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300 sm:block">
                  Guest
                </span>
              )}
              <ChevronDown className="h-4 w-4 text-white/50" />
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                {!isGuest && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => navigate("/profile")}
                        className={`${
                          active ? "bg-white/5" : ""
                        } flex w-full items-center gap-2 px-4 py-2.5 text-sm`}
                      >
                        <User className="h-4 w-4 text-violet-400" />
                        My profile
                      </button>
                    )}
                  </Menu.Item>
                )}
                {!isGuest && pendingSentInvitesCount > 0 && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => setShowSentInvitesModal(true)}
                        className={`${
                          active ? "bg-white/5" : ""
                        } flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm`}
                      >
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4 text-violet-400" />
                          Sent invites
                        </span>
                        <span className="text-xs text-white/40 tabular-nums">
                          {pendingSentInvitesCount}
                        </span>
                      </button>
                    )}
                  </Menu.Item>
                )}
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={handleLogout}
                      className={`${
                        active ? "bg-red-500/10" : ""
                      } flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400`}
                    >
                      <LogOut className="h-4 w-4" />
                      {isGuest ? "Leave" : "Log out"}
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </motion.header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-40 pt-6 sm:px-6">
        {/* Guest banner */}
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-3 backdrop-blur-xl"
          >
            <div className="flex min-w-0 items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
              <p className="truncate text-sm text-amber-200">
                <span className="font-medium">Guest mode</span>
                <span className="hidden sm:inline">
                  {" "}
                  — Create an account to host your own sessions
                </span>
              </p>
            </div>
            <button
              onClick={handleRegister}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-amber-400"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Sign up</span>
            </button>
          </motion.div>
        )}

        {/* ── Greeting — orients returning users and surfaces live activity ─── */}
        {!isFirstRun && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex flex-wrap items-end justify-between gap-3"
          >
            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-[0.25em] text-violet-300/70">
                Dashboard
              </p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Hey {displayName}
              </h1>
            </div>
            {liveSessions.length > 0 && (
              <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-sm font-semibold tabular-nums text-emerald-200">
                  {liveSessions.length} live now
                </span>
              </div>
            )}
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            FIRST-RUN HERO — a brand-new host lands here. One unmistakable job:
            create the first room. Live public rooms (if any) sit underneath as
            an instant alternative.
           ══════════════════════════════════════════════════════════════════ */}
        {isFirstRun && (
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl border border-violet-400/30 bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-transparent p-6 shadow-2xl shadow-violet-900/40 sm:p-10"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl"
            />
            <div className="relative mx-auto max-w-2xl text-center">
              <motion.img
                src="/icons/icon.png"
                alt="TuneVote"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="mx-auto mb-4 h-16 w-16 drop-shadow-[0_0_20px_rgba(139,92,246,0.5)]"
              />
              <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-violet-300/70">
                Welcome to TuneVote
              </p>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Create your first session
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-white/60 sm:text-base">
                Name your room, pick Public or Private, and your friends vote on
                what plays next — live, together.
              </p>

              <div className="mx-auto mt-6 max-w-xl text-left">
                {renderCreateForm({ hero: true })}
              </div>
            </div>
          </motion.section>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CONSOLE — two side-by-side activation zones (make vs. join) for
            returning hosts. Uses the full desktop width.
           ══════════════════════════════════════════════════════════════════ */}
        {isLoggedIn && !isFirstRun && (
          <section className="grid gap-4 lg:grid-cols-5">
            {/* CREATE (dominant, violet) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/[0.08] to-transparent p-5 backdrop-blur-xl lg:col-span-3"
            >
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-lg bg-violet-500/20 p-1.5">
                  <Plus className="h-4 w-4 text-violet-300" />
                </div>
                <h2 className="text-lg font-bold tracking-tight">
                  Start a session
                </h2>
              </div>
              {renderCreateForm()}
            </motion.div>

            {/* JOIN / ON AIR (emerald) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="flex flex-col rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5 backdrop-blur-xl lg:col-span-2"
            >
              <div className="mb-3 flex items-center gap-2">
                <Radio className="h-4 w-4 text-emerald-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                  On air
                </h2>
                {liveSessions.length > 0 && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
                    {liveSessions.length}
                  </span>
                )}
              </div>

              {liveSessions.length > 0 ? (
                <div className="flex max-h-[19rem] flex-col gap-2.5 overflow-y-auto pr-1">
                  <AnimatePresence>
                    {liveSessions.map((s) => renderLiveCard(s))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
                  <Radio className="mb-2 h-6 w-6 text-white/25" />
                  <p className="text-sm font-medium text-white/60">
                    No rooms are live right now
                  </p>
                  <p className="mt-0.5 text-xs text-white/40">
                    Start one and your friends can jump in.
                  </p>
                </div>
              )}
            </motion.div>
          </section>
        )}

        {/* ── First-run: live rooms to join underneath the hero ────────────── */}
        {isFirstRun && liveSessions.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Radio className="h-4 w-4 text-emerald-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                Or drop into a live room
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
                {liveSessions.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {liveSessions.map((s) => renderLiveCard(s))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── Guests can't create, but they can drop into any live room ────── */}
        {isGuest && liveSessions.length > 0 && (
          <section className="mt-1">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Radio className="h-4 w-4 text-emerald-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-emerald-300">
                Live now
              </h2>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-300">
                {liveSessions.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence>
                {liveSessions.map((s) => renderLiveCard(s))}
              </AnimatePresence>
            </div>
          </section>
        )}

        {/* ── INVITATIONS — someone is waiting for a reply ─────────────────── */}
        {!isGuest && pendingInvites.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center gap-2 px-1">
              <Mail className="h-4 w-4 text-fuchsia-400" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-fuchsia-300">
                Waiting for you
              </h2>
              <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-xs font-semibold tabular-nums text-fuchsia-300">
                {pendingInvites.length}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pendingInvites.map((invite) => (
                <motion.div
                  key={invite.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-500/10 to-transparent p-4 backdrop-blur-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/20">
                      <Mail className="h-5 w-5 text-fuchsia-300" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {invite.session_title}
                      </p>
                      <p className="truncate text-xs text-white/50">
                        Invited by {invite.host_name}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-green-500/25"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => rejectInvite(invite.id)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10"
                    >
                      <XCircle className="h-4 w-4" />
                      Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── TRENDING GENRES — genre ranking over a time window (#43) ──────── */}
        <section className="mt-8">
          <GenreRanking />
        </section>

        {/* ── BROWSE GRID — every non-live session, dense multi-column ──────── */}
        {nonLiveSessions.length > 0 && (
          <section className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/80">
                  {liveSessions.length > 0 ? "Other sessions" : "Your sessions"}
                </h2>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold tabular-nums text-white/50">
                  {filteredOtherSessions.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {nonLiveSessions.length >= FILTER_THRESHOLD && (
                  <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/5 p-0.5">
                    <button
                      onClick={() => setFilterType("all")}
                      className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                        filterType === "all"
                          ? "bg-white/10 font-medium"
                          : "text-white/60 hover:bg-white/5"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType("public")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-all ${
                        filterType === "public"
                          ? "bg-white/10 font-medium"
                          : "text-white/60 hover:bg-white/5"
                      }`}
                      title="Public sessions"
                    >
                      <Globe className="h-3 w-3" />
                      <span className="hidden sm:inline">Public</span>
                    </button>
                    <button
                      onClick={() => setFilterType("private")}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-all ${
                        filterType === "private"
                          ? "bg-white/10 font-medium"
                          : "text-white/60 hover:bg-white/5"
                      }`}
                      title="Private sessions"
                    >
                      <Lock className="h-3 w-3" />
                      <span className="hidden sm:inline">Private</span>
                    </button>
                  </div>
                )}

                {/* Sort — helps find a freshly created or recently used room */}
                {nonLiveSessions.length > 1 && (
                  <Menu as="div" className="relative">
                    <Menu.Button
                      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
                      title="Sort sessions"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span className="hidden font-medium sm:inline">
                        {SORT_OPTIONS.find((o) => o.key === sortBy)?.label}
                      </span>
                      <ChevronDown className="h-3 w-3 text-white/40" />
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="opacity-0 scale-95"
                      enterTo="opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="opacity-100 scale-100"
                      leaveTo="opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-xl">
                        {SORT_OPTIONS.map((opt) => (
                          <Menu.Item key={opt.key}>
                            {({ active }) => (
                              <button
                                onClick={() => setSortBy(opt.key)}
                                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm ${
                                  active ? "bg-white/5" : ""
                                } ${
                                  sortBy === opt.key
                                    ? "text-violet-200"
                                    : "text-white/80"
                                }`}
                              >
                                {opt.label}
                                {sortBy === opt.key && (
                                  <Check className="h-4 w-4 text-violet-400" />
                                )}
                              </button>
                            )}
                          </Menu.Item>
                        ))}
                      </Menu.Items>
                    </Transition>
                  </Menu>
                )}
              </div>
            </div>

            {filteredOtherSessions.length === 0 ? (
              <div className="py-10 text-center text-sm text-white/40">
                No sessions match this filter.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <AnimatePresence>
                  {sortedOtherSessions.map((s) => renderSessionCard(s))}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}

        {/* Guest empty-state — no sessions visible at all */}
        {isGuest && hasZeroSessions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center"
          >
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/5">
              <Music className="h-10 w-10 text-white/20" />
            </div>
            <p className="mb-1 font-medium text-white/60">No sessions yet</p>
            <p className="mb-4 text-sm text-white/40">
              Join a session via a shared link, or create an account to host
              your own.
            </p>
            <button
              onClick={handleRegister}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-medium"
            >
              <UserPlus className="h-4 w-4" />
              Create an account
            </button>
          </motion.div>
        )}
      </main>

      {/* ── QR Code Modal ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {qrModalSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setQrModalSession(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 text-center shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Scan to join</h3>
                <button
                  onClick={() => setQrModalSession(null)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mb-4 truncate text-sm text-white/60">
                {qrModalSession.title}
              </p>

              <div className="mb-4 inline-block rounded-2xl bg-white p-4">
                <QRCodeCanvas
                  value={`${window.location.origin}/session/${qrModalSession.public_id || qrModalSession.id}`}
                  size={200}
                  level="H"
                />
              </div>

              <button
                onClick={() => {
                  copyJoinLink(qrModalSession.id, qrModalSession.public_id);
                  setQrModalSession(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 py-2.5 text-sm font-medium transition-all hover:shadow-lg hover:shadow-violet-500/25"
              >
                <Copy className="h-4 w-4" />
                Copy link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Sent Invitations Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showSentInvitesModal && !isGuest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setShowSentInvitesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Send className="h-5 w-5 text-violet-400" />
                  <h3 className="font-semibold">Sent invitations</h3>
                </div>
                <button
                  onClick={() => setShowSentInvitesModal(false)}
                  className="rounded-lg p-1.5 transition-colors hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {sentInvites.length === 0 ? (
                <p className="py-4 text-center text-sm text-white/40">
                  You haven't sent any invitations yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sentInvites.map((invite) => {
                    let statusIcon;
                    let statusColor;
                    let statusLabel;

                    switch (invite.status) {
                      case "accepted":
                        statusIcon = <CheckCircle className="h-3.5 w-3.5" />;
                        statusColor = "text-green-400";
                        statusLabel = "Accepted";
                        break;
                      case "rejected":
                        statusIcon = <XCircle className="h-3.5 w-3.5" />;
                        statusColor = "text-red-400";
                        statusLabel = "Declined";
                        break;
                      case "revoked":
                        statusIcon = <Ban className="h-3.5 w-3.5" />;
                        statusColor = "text-red-400";
                        statusLabel = "Revoked";
                        break;
                      default:
                        statusIcon = <Clock className="h-3.5 w-3.5" />;
                        statusColor = "text-yellow-400";
                        statusLabel = "Pending";
                        break;
                    }

                    return (
                      <div
                        key={invite.id}
                        className="rounded-xl border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {invite.session_title}
                            </p>
                            <p className="truncate text-xs text-white/40">
                              To: {invite.email}
                            </p>
                          </div>
                          <span
                            className={`${statusColor} flex shrink-0 items-center gap-1 text-xs`}
                          >
                            {statusIcon}
                            {statusLabel}
                          </span>
                        </div>
                        {invite.status === "pending" && (
                          <button
                            onClick={() => revokeInvite(invite.id)}
                            className="mt-2 w-full rounded-lg bg-red-500/10 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
                          >
                            Revoke invitation
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 26, stiffness: 320 }}
              className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-red-500/20 p-2.5">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold">Delete session?</h3>
              </div>

              <p className="mb-6 text-sm text-white/60">
                This can't be undone. All participants will be removed and the
                session history will be lost.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm font-medium transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteSession(showDeleteModal)}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium transition-all hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
