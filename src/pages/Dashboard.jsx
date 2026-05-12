// src/pages/Dashboard.jsx
import { useEffect, useState, Fragment, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, Transition } from "@headlessui/react";
import { io } from "socket.io-client";
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
  Users,
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
  Play,
  ArrowRight,
  CreditCard,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

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
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [paywallLoading, setPaywallLoading] = useState(false);

  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);

  // UI state
  // ---------------------------------------------------------------------------
  // Filter only renders above a certain session count threshold — below that,
  // it's noise. `showSentInvitesModal` is used to surface sent-invite status
  // (replaces the old equal-weight "Sent" column).
  // ---------------------------------------------------------------------------
  const FILTER_THRESHOLD = 5;
  const [filterType, setFilterType] = useState("all"); // all, public, private
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
    socketRef.current = io("https://api.tunevote.com/");

    socketRef.current.on("participant_count_update", (data) => {
      console.log("Dashboard: participant_count_update received", data);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === data.sessionId ? { ...s, participant_count: data.count } : s
        )
      );
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.off("participant_count_update");
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
      const res = await axios.get("https://api.tunevote.com/sessions", {
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
      const res = await axios.get("https://api.tunevote.com/invites/sent", {
        headers: getAuthHeaders(),
      });
      setSentInvites(res.data);
    } catch (err) {
      console.error("Failed to load sent invites:", err);
    }
  };

  const fetchReceivedInvites = async () => {
    try {
      const res = await axios.get("https://api.tunevote.com/invites/received", {
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
      const res = await axios.get("https://api.tunevote.com/profile", {
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
    // Replaces the German confirm(). English-only, consistent with rest of UI.
    if (!window.confirm("Revoke this invitation? The recipient won't be able to accept it anymore.")) {
      return;
    }

    try {
      await axios.post(
        `https://api.tunevote.com/invites/${inviteId}/revoke`,
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
        `https://api.tunevote.com/invites/${inviteId}/accept`,
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
        `https://api.tunevote.com/invites/${inviteId}/reject`,
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
        "https://api.tunevote.com/sessions",
        {
          title: newSessionTitle,
          is_private: isPrivate ? 1 : 0,
        },
        { headers: getAuthHeaders() }
      );
      setSessions((prev) => [res.data, ...prev]);
      setNewSessionTitle("");
      trackEvent("session_created", {
        session_id: res.data.id,
        is_private: isPrivate,
      });
    } catch (err) {
      if (err?.response?.status === 402) {
        setShowPaywallModal(true);
        trackEvent("paywall_shown", { trigger: "create_private_session" });
      } else {
        alert("Could not create session");
        trackEvent("session_create_failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const startCheckout = async () => {
    if (paywallLoading) return;
    setPaywallLoading(true);
    try {
      const res = await axios.post(
        "https://api.tunevote.com/billing/checkout-session",
        {},
        { headers: getAuthHeaders() }
      );
      trackEvent("checkout_started");
      window.location.href = res.data.url;
    } catch {
      setPaywallLoading(false);
      alert("Could not start checkout. Please try again.");
    }
  };

  const openCustomerPortal = async () => {
    try {
      const res = await axios.post(
        "https://api.tunevote.com/billing/portal-session",
        {},
        { headers: getAuthHeaders() }
      );
      window.location.href = res.data.url;
    } catch {
      alert("Could not open subscription management.");
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`https://api.tunevote.com/sessions/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setShowDeleteModal(null);
      trackEvent("session_deleted", { session_id: sessionId });
    } catch (err) {
      alert("Could not delete session");
    }
  };

  const copyJoinLink = (sessionId) => {
    const link = `${window.location.origin}/session/${sessionId}`;
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
    navigate(`/session/${session.id}`);
  };

  // ---------------------------------------------------------------------------
  // PRIORITY-DRIVEN DERIVED STATE.
  //
  // The dashboard renders sections in a fixed priority order. Each section
  // only appears if its data exists. The order reflects "what does the user
  // most need to act on right now?":
  //
  //   1. Live sessions the user is host of OR has joined — jump back in
  //   2. Pending received invitations — someone is waiting for a response
  //   3. (For empty-state users only) prominent create-session prompt
  //   4. All remaining sessions
  //
  // Filtering only applies to (4) — live and invitations are time-sensitive
  // and shouldn't be hidden behind a public/private filter.
  // ---------------------------------------------------------------------------
  const pendingInvites = receivedInvites.filter(
    (i) => !i.accepted_at && !i.revoked_at
  );
  const liveSessions = sessions.filter((s) => s.is_live === 1);
  const nonLiveSessions = sessions.filter((s) => s.is_live !== 1);

  const filteredOtherSessions = nonLiveSessions.filter((s) => {
    if (filterType === "public") return s.is_private !== 1;
    if (filterType === "private") return s.is_private === 1;
    return true;
  });

  const totalSessions = sessions.length;
  const hasZeroSessions = totalSessions === 0;
  const pendingSentInvitesCount = sentInvites.filter((i) => i.status === "pending").length;

  // === Auth guard ===
  if (!token && !guestToken) {
    navigate("/login");
    return null;
  }

  // Format a date relative to now ("today", "yesterday", "3 days ago", or date)
  const formatRelativeDate = (iso) => {
    const d = new Date(iso);
    const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // ---------------------------------------------------------------------------
  // renderSessionRow — used in all session list contexts (live + regular).
  // The list-row format works across all screen sizes and packs more useful
  // info per item than the previous grid.
  //
  // IMPORTANT: defined as a plain function returning JSX, NOT as a React
  // component. Defining a component inside the parent (`const SessionRow = …`)
  // would create a new component reference on every Dashboard render,
  // causing React to unmount/remount every row. That tears down any open
  // Headless UI `<Menu>` dropdown mid-interaction (e.g. when a socket
  // `participant_count_update` event fires while the user is browsing
  // the more-actions menu). A regular function bypasses React's component
  // identity check — the returned JSX is treated as the parent's own
  // children, so rows reconcile by position+key, and open menus stay open.
  //
  // emphasis: 'live' (glowing border) | 'normal' (subtle)
  // ---------------------------------------------------------------------------
  const renderSessionRow = (s, emphasis = "normal") => {
    const isHost = isLoggedIn && userId && Number(userId) === s.hostId;
    const isLive = s.is_live === 1;

    return (
      <motion.div
        key={s.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -10 }}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
        onClick={() => openSession(s)}
        className={`group cursor-pointer rounded-2xl border transition-all ${
          emphasis === "live"
            ? "bg-gradient-to-r from-green-500/15 via-emerald-500/10 to-transparent border-green-500/30 hover:border-green-400/50 shadow-lg shadow-green-500/10"
            : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
        }`}
      >
        <div className="flex items-center gap-3 p-3 sm:p-4">
          {/* Status indicator */}
          <div className="shrink-0">
            {isLive ? (
              <div className="relative w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Play className="w-5 h-5 text-green-300" fill="currentColor" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 ring-2 ring-slate-950">
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping" />
                </span>
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                <Music className="w-5 h-5 text-white/40" />
              </div>
            )}
          </div>

          {/* Title + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className={`font-semibold text-sm sm:text-base truncate ${
                isLive ? "text-green-50" : "group-hover:text-purple-200"
              } transition-colors`}>
                {s.title}
              </h3>
              {s.is_private === 1 && (
                <Lock className="w-3 h-3 text-white/40 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-white/50">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {s.participant_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatRelativeDate(s.created_at)}
              </span>
              {isLive && (
                <span className="text-green-400 font-medium uppercase tracking-wider text-[10px]">
                  Live now
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyJoinLink(s.id);
              }}
              className={`p-2 rounded-lg transition-colors ${
                copiedId === s.id
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90"
              }`}
              title="Copy share link"
            >
              {copiedId === s.id ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            {/* Overflow menu — protects against accidental Delete clicks */}
            <Menu as="div" className="relative">
              <Menu.Button
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/90 transition-colors"
                title="More actions"
              >
                <MoreVertical className="w-4 h-4" />
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
                <Menu.Items className="absolute right-0 mt-2 w-44 rounded-xl bg-slate-900 border border-white/10 shadow-xl overflow-hidden z-30">
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
                        <QrCode className="w-4 h-4 text-purple-400" />
                        Show QR code
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyJoinLink(s.id);
                        }}
                        className={`${
                          active ? "bg-white/5" : ""
                        } flex w-full items-center gap-2 px-3 py-2.5 text-sm`}
                      >
                        <Copy className="w-4 h-4 text-purple-400" />
                        Copy share link
                      </button>
                    )}
                  </Menu.Item>
                  {isHost && (
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
              </Transition>
            </Menu>

            <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/60 group-hover:translate-x-0.5 transition-all ml-1 hidden sm:block" />
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      {/* Background atmosphere */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-600/15 rounded-full filter blur-[100px]"></div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────
          HEADER — slim, persistent. Identity + profile only. Action buttons
          (create session, invitations) were moved into the body where they
          belong, since they're not navigation-level.
         ──────────────────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-white/5"
      >
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Music className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg">TuneVote</span>
          </div>

          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
              <div className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-white/10">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm font-bold">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <span className="font-medium text-sm hidden sm:block max-w-[120px] truncate">
                {displayName}
              </span>
              {isGuest && (
                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded hidden sm:block">
                  Guest
                </span>
              )}
              <ChevronDown className="w-4 h-4 text-white/50" />
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
              <Menu.Items className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-white/10 shadow-xl overflow-hidden">
                {!isGuest && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => navigate("/profile")}
                        className={`${
                          active ? "bg-white/5" : ""
                        } flex w-full items-center gap-2 px-4 py-2.5 text-sm`}
                      >
                        <User className="w-4 h-4 text-purple-400" />
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
                          <Send className="w-4 h-4 text-purple-400" />
                          Sent invites
                        </span>
                        <span className="text-xs text-white/40">
                          {pendingSentInvitesCount}
                        </span>
                      </button>
                    )}
                  </Menu.Item>
                )}
                {!isGuest && (
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={openCustomerPortal}
                        className={`${
                          active ? "bg-white/5" : ""
                        } flex w-full items-center gap-2 px-4 py-2.5 text-sm`}
                      >
                        <CreditCard className="w-4 h-4 text-purple-400" />
                        Manage subscription
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
                      <LogOut className="w-4 h-4" />
                      {isGuest ? "Leave" : "Log out"}
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </motion.header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-6 pb-24 space-y-6">

        {/* Guest banner — only shown for guests */}
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
              <p className="text-sm text-yellow-200 truncate">
                <span className="font-medium">Guest mode</span>
                <span className="hidden sm:inline">
                  {" "}
                  — Create an account to host your own sessions
                </span>
              </p>
            </div>
            <button
              onClick={handleRegister}
              className="px-3 py-1.5 bg-yellow-500 text-slate-900 font-semibold text-sm rounded-lg hover:bg-yellow-400 transition-colors shrink-0 flex items-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Sign up</span>
            </button>
          </motion.div>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            HERO PRIORITY 1: Live sessions.
            If anything is live, surface it at the top. Highest-attention
            position. Users with a live session almost certainly want to
            return to it immediately.
           ──────────────────────────────────────────────────────────────── */}
        {liveSessions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Radio className="w-4 h-4 text-green-400" />
              <h2 className="text-sm font-semibold text-green-300 uppercase tracking-wider">
                Live now
              </h2>
              <span className="text-xs text-white/40">
                ({liveSessions.length})
              </span>
            </div>
            <div className="space-y-2">
              {liveSessions.map((s) => renderSessionRow(s, "live"))}
            </div>
          </section>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            HERO PRIORITY 2: Pending invitations.
            Someone is waiting for the user's response. Don't bury this.
            Inline Accept / Decline — no extra clicks to act.
           ──────────────────────────────────────────────────────────────── */}
        {!isGuest && pendingInvites.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3 px-1">
              <Mail className="w-4 h-4 text-pink-400" />
              <h2 className="text-sm font-semibold text-pink-300 uppercase tracking-wider">
                Waiting for you
              </h2>
              <span className="text-xs text-white/40">
                ({pendingInvites.length})
              </span>
            </div>
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <motion.div
                  key={invite.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="p-4 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/8 to-transparent border border-pink-500/25"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-pink-300" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {invite.session_title}
                      </p>
                      <p className="text-xs text-white/50 truncate">
                        Invited by {invite.host_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => acceptInvite(invite.id)}
                      className="flex-1 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-green-500/25 transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Accept
                    </button>
                    <button
                      onClick={() => rejectInvite(invite.id)}
                      className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-medium text-sm transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      Decline
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            CREATE SESSION — always inline, but visually heroic when the user
            has zero sessions, and compact when they already have some.

            This collapses the previous "click to expand" panel into a single
            zero-friction creation flow.
           ──────────────────────────────────────────────────────────────── */}
        {isLoggedIn && (
          <section
            className={
              hasZeroSessions
                ? "p-5 rounded-3xl bg-gradient-to-br from-purple-500/15 via-pink-500/10 to-transparent border border-purple-400/30"
                : "p-4 rounded-2xl bg-white/[0.03] border border-white/10"
            }
          >
            {hasZeroSessions && (
              <div className="text-center mb-4">
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-400/40 mb-3"
                >
                  <Sparkles className="w-6 h-6 text-purple-200" />
                </motion.div>
                <h2 className="text-xl font-bold mb-1">Start your first session</h2>
                <p className="text-sm text-white/60">
                  Give it a name and invite your friends to vote on songs together.
                </p>
              </div>
            )}

            {!hasZeroSessions && (
              <div className="flex items-center gap-2 mb-3 px-1">
                <Plus className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                  Create a session
                </h2>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSession();
              }}
              className="flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                placeholder={
                  hasZeroSessions
                    ? "e.g. Friday night party, Road trip 2026…"
                    : "New session name…"
                }
                className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 placeholder-white/30 focus:border-purple-400 focus:outline-none transition-colors text-sm"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                disabled={loading}
              />
              <div className="flex gap-2">
                <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
                      !isPrivate
                        ? "bg-purple-500 text-white shadow-sm"
                        : "hover:bg-white/5 text-white/70"
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
                      isPrivate
                        ? "bg-pink-500 text-white shadow-sm"
                        : "hover:bg-white/5 text-white/70"
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Private
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || !newSessionTitle.trim()}
                  className="px-5 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-semibold text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  {loading ? "Creating…" : "Create"}
                </button>
              </div>
            </form>

            {hasZeroSessions && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/40">
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Public: anyone with the link
                </span>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Private: invitation only
                </span>
              </div>
            )}
          </section>
        )}

        {/* ──────────────────────────────────────────────────────────────────
            REGULAR SESSIONS LIST.
            Only renders if there are non-live sessions. Filter UI appears
            only above the threshold (FILTER_THRESHOLD) — for users with 1–4
            sessions it's just noise.
           ──────────────────────────────────────────────────────────────── */}
        {nonLiveSessions.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1 gap-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
                  {liveSessions.length > 0 ? "Other sessions" : "Your sessions"}
                </h2>
                <span className="text-xs text-white/40">
                  ({filteredOtherSessions.length})
                </span>
              </div>

              {/* Filter only above threshold */}
              {nonLiveSessions.length >= FILTER_THRESHOLD && (
                <div className="flex items-center gap-0.5 p-0.5 bg-white/5 rounded-lg border border-white/10">
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                      filterType === "all"
                        ? "bg-white/10 font-medium"
                        : "hover:bg-white/5 text-white/60"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType("public")}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1 ${
                      filterType === "public"
                        ? "bg-white/10 font-medium"
                        : "hover:bg-white/5 text-white/60"
                    }`}
                    title="Public sessions"
                  >
                    <Globe className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setFilterType("private")}
                    className={`px-2.5 py-1 rounded-md text-xs transition-all flex items-center gap-1 ${
                      filterType === "private"
                        ? "bg-white/10 font-medium"
                        : "hover:bg-white/5 text-white/60"
                    }`}
                    title="Private sessions"
                  >
                    <Lock className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {filteredOtherSessions.length === 0 ? (
              <div className="py-8 text-center text-white/40 text-sm">
                No sessions match this filter.
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredOtherSessions.map((s) => renderSessionRow(s))}
                </AnimatePresence>
              </div>
            )}
          </section>
        )}

        {/* Guest empty-state when not logged in and zero sessions visible */}
        {isGuest && hasZeroSessions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <Music className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-white/60 mb-1 font-medium">No sessions yet</p>
            <p className="text-sm text-white/40 mb-4">
              Join a session via a shared link, or create an account to host your own.
            </p>
            <button
              onClick={handleRegister}
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm inline-flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create an account
            </button>
          </motion.div>
        )}
      </main>

      {/* ──────────────────────────────────────────────────────────────────────
          QR Code Modal
         ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {qrModalSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setQrModalSession(null)}
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
                  onClick={() => setQrModalSession(null)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-white/60 mb-4 truncate">
                {qrModalSession.title}
              </p>

              <div className="bg-white p-4 rounded-2xl inline-block mb-4">
                <QRCodeCanvas
                  value={`${window.location.origin}/session/${qrModalSession.id}`}
                  size={200}
                  level="H"
                />
              </div>

              <button
                onClick={() => {
                  copyJoinLink(qrModalSession.id);
                  setQrModalSession(null);
                }}
                className="w-full py-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all"
              >
                <Copy className="w-4 h-4" />
                Copy Link
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────────────────────────────────────────────────────────────────────
          Sent Invitations Modal (accessed via profile menu)
         ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSentInvitesModal && !isGuest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowSentInvitesModal(false)}
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
                  <Send className="w-5 h-5 text-purple-400" />
                  <h3 className="font-semibold">Sent invitations</h3>
                </div>
                <button
                  onClick={() => setShowSentInvitesModal(false)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {sentInvites.length === 0 ? (
                <p className="text-sm text-white/40 py-4 text-center">
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
                        statusIcon = <CheckCircle className="w-3.5 h-3.5" />;
                        statusColor = "text-green-400";
                        statusLabel = "Accepted";
                        break;
                      case "rejected":
                        statusIcon = <XCircle className="w-3.5 h-3.5" />;
                        statusColor = "text-red-400";
                        statusLabel = "Declined";
                        break;
                      case "revoked":
                        statusIcon = <Ban className="w-3.5 h-3.5" />;
                        statusColor = "text-red-400";
                        statusLabel = "Revoked";
                        break;
                      default:
                        statusIcon = <Clock className="w-3.5 h-3.5" />;
                        statusColor = "text-yellow-400";
                        statusLabel = "Pending";
                        break;
                    }

                    return (
                      <div
                        key={invite.id}
                        className="p-3 rounded-xl bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
                              {invite.session_title}
                            </p>
                            <p className="text-xs text-white/40 truncate">
                              To: {invite.email}
                            </p>
                          </div>
                          <span className={`${statusColor} flex items-center gap-1 text-xs shrink-0`}>
                            {statusIcon}
                            {statusLabel}
                          </span>
                        </div>
                        {invite.status === "pending" && (
                          <button
                            onClick={() => revokeInvite(invite.id)}
                            className="mt-2 w-full py-1.5 text-xs font-medium rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
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

      {/* ──────────────────────────────────────────────────────────────────────
          Delete Modal
         ──────────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold">Delete session?</h3>
              </div>

              <p className="text-sm text-white/60 mb-6">
                This action cannot be undone. All participants will be removed and the session history will be lost.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-medium text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteSession(showDeleteModal)}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 font-medium text-sm transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPaywallModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => !paywallLoading && setShowPaywallModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 rounded-3xl p-6 max-w-sm w-full border border-white/10 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                  <Lock className="w-5 h-5 text-pink-400" />
                </div>
                <h3 className="text-lg font-semibold">Unlock private sessions</h3>
              </div>

              <p className="text-sm text-white/60 mb-2">
                Private sessions are invitation-only and stay off the public list.
              </p>
              <p className="text-sm text-white/60 mb-6">
                Subscribe for <span className="text-white font-semibold">$5/month</span> to create unlimited private sessions. Cancel any time.
              </p>

              <div className="flex gap-3">
                <button
                  disabled={paywallLoading}
                  onClick={() => setShowPaywallModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-medium text-sm transition-all disabled:opacity-40"
                >
                  Not now
                </button>
                <button
                  onClick={startCheckout}
                  disabled={paywallLoading}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:shadow-lg hover:shadow-purple-500/25 font-medium text-sm transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {paywallLoading ? "Redirecting…" : "Subscribe"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}