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
  Filter,
  Globe,
  ChevronUp,
  QrCode,
  Mail,
  MailOpen,
  Send,
} from "lucide-react";

export default function Dashboard() {
  const navigate = useNavigate();

  // Auth
  const token = localStorage.getItem("token");
  const guestToken = localStorage.getItem("guestToken");
  const username = localStorage.getItem("username");
  const guestName = localStorage.getItem("guestName") || "Gast";
  const userId = localStorage.getItem("userId");

  // Zustand
  const [sessions, setSessions] = useState([]);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(null);
  const [isPrivate, setIsPrivate] = useState(false);

  const [sentInvites, setSentInvites] = useState([]);
  const [receivedInvites, setReceivedInvites] = useState([]);

  // UI State
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showInvitations, setShowInvitations] = useState(false);
  const [filterType, setFilterType] = useState("all"); // all, public, private
  const [qrModalSession, setQrModalSession] = useState(null);

  // Prüfungen
  const isGuest = !token && guestToken;
  const isLoggedIn = !!token;
  const displayName = isGuest ? guestName : username;

  const [profileImage, setProfileImage] = useState(null);

  const socketRef = useRef(null);

  // Neu: Socket richtig initialisieren
  useEffect(() => {
    socketRef.current = io("https://api.tunevote.com/");

    socketRef.current.on("participant_count_update", (data) => {
      console.log("Dashboard: participant_count_update empfangen", data);
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

  // === Auth Headers ===
  const getAuthHeaders = () => {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    else if (guestToken) headers["x-guest-token"] = guestToken;
    return headers;
  };

  // === Sessions laden ===
  const fetchSessions = async () => {
    try {
      const res = await axios.get("https://api.tunevote.com/sessions", {
        headers: getAuthHeaders(),
      });
      setSessions(res.data);
    } catch (err) {
      console.error("Fehler beim Laden der Sessions:", err);

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
      console.error("Fehler beim Laden gesendeter Einladungen:", err);
    }
  };

  const fetchReceivedInvites = async () => {
    try {
      const res = await axios.get("https://api.tunevote.com/invites/received", {
        headers: getAuthHeaders(),
      });
      setReceivedInvites(res.data);
    } catch (err) {
      console.error("Fehler beim Laden empfangener Einladungen:", err);
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
      console.error("Fehler beim Laden des Profilbildes:", err);
      setProfileImage(null);
    }
  };

  const revokeInvite = async (inviteId) => {
    if (!confirm("Möchtest du diese Einladung wirklich widerrufen?")) return;

    try {
      await axios.post(
        `https://api.tunevote.com/invites/${inviteId}/revoke`,
        {},
        { headers: getAuthHeaders() }
      );
      fetchSentInvites();
      fetchReceivedInvites();
    } catch (err) {
      alert("Fehler beim Widerrufen der Einladung");
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
    } catch (err) {
      console.error("Fehler beim Akzeptieren:", err);
      alert("Fehler beim Akzeptieren der Einladung");
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
    } catch (err) {
      console.error("Fehler beim Ablehnen:", err);
      alert("Fehler beim Ablehnen");
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

  // === Logout ===
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const handleRegister = () => {
    localStorage.clear();
    navigate("/register");
  };

  // === Session erstellen (nur eingeloggte) ===
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
      setShowCreateSession(false);
      trackEvent("session_created", {
        session_id: res.data.id,
        is_private: isPrivate,
      });
    } catch (err) {
      alert("Fehler beim Erstellen der Session");
      trackEvent("session_create_failed");
    } finally {
      setLoading(false);
    }
  };

  // === Session löschen (nur Host) ===
  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`https://api.tunevote.com/sessions/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setShowDeleteModal(null);
      trackEvent("session_deleted", { session_id: sessionId });
    } catch (err) {
      alert("Fehler beim Löschen");
    }
  };

  // === Link kopieren ===
  const copyJoinLink = (sessionId) => {
    const link = `${window.location.origin}/session/${sessionId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
    trackEvent("session_link_copied", { session_id: sessionId });
  };

  // === Session öffnen ===
  const openSession = (session) => {
    trackEvent("session_opened_from_dashboard", {
      session_id: session.id,
      session_title: session.title,
    });
    navigate(`/session/${session.id}`);
  };

  // Filter sessions
  const filteredSessions = sessions.filter((s) => {
    if (filterType === "public") return s.is_private !== 1;
    if (filterType === "private") return s.is_private === 1;
    return true;
  });

  // Count pending invitations
  const pendingInvitesCount = receivedInvites.filter(
    (i) => !i.accepted_at && !i.revoked_at
  ).length;

  // === Schutz: Kein Zugriff ohne Token oder GuestToken ===
  if (!token && !guestToken) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 text-white">
      {/* Subtle Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/20 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-pink-600/15 rounded-full filter blur-[100px]"></div>
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/80 border-b border-white/5"
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Music className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg hidden sm:block">TuneVote</span>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-2">
            {/* Invitations Badge (Mobile) */}
            {!isGuest && pendingInvitesCount > 0 && (
              <button
                onClick={() => setShowInvitations(!showInvitations)}
                className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors sm:hidden"
              >
                <Mail className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 rounded-full text-xs font-bold flex items-center justify-center">
                  {pendingInvitesCount}
                </span>
              </button>
            )}

            {/* Profile Dropdown */}
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
                <span className="font-medium text-sm hidden sm:block max-w-[100px] truncate">
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
        </div>
      </motion.header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 py-6 pb-24">
        {/* Guest Banner - Compact */}
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0" />
              <p className="text-sm text-yellow-200 truncate">
                <span className="font-medium">Guest mode</span>
                <span className="hidden sm:inline">
                  {" "}
                  – Create an account for full access
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

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Create Session Button */}
          {isLoggedIn && (
            <button
              onClick={() => {
                if (!showCreateSession) trackEvent("create_session_form_opened");
                setShowCreateSession(!showCreateSession);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                showCreateSession
                  ? "bg-purple-500 text-white"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              {showCreateSession ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              New Session
            </button>
          )}

          {/* Invitations Button (Desktop) */}
          {!isGuest && (
            <button
              onClick={() => setShowInvitations(!showInvitations)}
              className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all ${
                showInvitations
                  ? "bg-pink-500 text-white"
                  : "bg-white/5 hover:bg-white/10 border border-white/10"
              }`}
            >
              {showInvitations ? (
                <MailOpen className="w-4 h-4" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              Invitations
              {pendingInvitesCount > 0 && (
                <span className="px-1.5 py-0.5 bg-pink-500/30 rounded text-xs">
                  {pendingInvitesCount}
                </span>
              )}
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Filter */}
          <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10">
            <button
              onClick={() => setFilterType("all")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filterType === "all"
                  ? "bg-white/10 font-medium"
                  : "hover:bg-white/5"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType("public")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                filterType === "public"
                  ? "bg-white/10 font-medium"
                  : "hover:bg-white/5"
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Public</span>
            </button>
            <button
              onClick={() => setFilterType("private")}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all flex items-center gap-1.5 ${
                filterType === "private"
                  ? "bg-white/10 font-medium"
                  : "hover:bg-white/5"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Private</span>
            </button>
          </div>
        </div>

        {/* Create Session Panel - Collapsible */}
        <AnimatePresence>
          {isLoggedIn && showCreateSession && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Session title..."
                    className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 placeholder-white/30 focus:border-purple-400 focus:outline-none transition-colors text-sm"
                    value={newSessionTitle}
                    onChange={(e) => setNewSessionTitle(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && createSession()}
                    disabled={loading}
                  />
                  <div className="flex gap-2">
                    <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setIsPrivate(false)}
                        className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-all ${
                          !isPrivate
                            ? "bg-purple-500 text-white"
                            : "hover:bg-white/5"
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
                            ? "bg-pink-500 text-white"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Private
                      </button>
                    </div>
                    <button
                      onClick={createSession}
                      disabled={loading || !newSessionTitle.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl font-medium text-sm flex items-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      {loading ? "..." : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invitations Panel - Collapsible */}
        <AnimatePresence>
          {!isGuest && showInvitations && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mb-6"
            >
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Mail className="w-4 h-4 text-purple-400" />
                    Invitations
                  </h3>
                  <button
                    onClick={() => setShowInvitations(false)}
                    className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Received Invitations */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                      <MailOpen className="w-3.5 h-3.5" />
                      Received
                    </h4>
                    {receivedInvites.length === 0 ? (
                      <p className="text-sm text-white/40 py-2">
                        No pending invitations
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {receivedInvites.map((invite) => (
                          <div
                            key={invite.id}
                            className="p-3 rounded-xl bg-white/5 border border-white/10"
                          >
                            <p className="text-sm font-medium truncate mb-1">
                              {invite.session_title}
                            </p>
                            <p className="text-xs text-white/40 mb-2">
                              From: {invite.host_name}
                            </p>
                            {!invite.accepted_at && !invite.revoked_at && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => acceptInvite(invite.id)}
                                  className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                                >
                                  Accept
                                </button>
                                <button
                                  onClick={() => rejectInvite(invite.id)}
                                  className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Sent Invitations */}
                  <div>
                    <h4 className="text-xs uppercase tracking-wider text-white/40 mb-2 flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" />
                      Sent
                    </h4>
                    {sentInvites.length === 0 ? (
                      <p className="text-sm text-white/40 py-2">
                        No invitations sent
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {sentInvites.map((invite) => {
                          let statusIcon;
                          let statusColor;

                          switch (invite.status) {
                            case "accepted":
                              statusIcon = (
                                <CheckCircle className="w-3.5 h-3.5" />
                              );
                              statusColor = "text-green-400";
                              break;
                            case "rejected":
                              statusIcon = <XCircle className="w-3.5 h-3.5" />;
                              statusColor = "text-red-400";
                              break;
                            case "revoked":
                              statusIcon = <Ban className="w-3.5 h-3.5" />;
                              statusColor = "text-red-400";
                              break;
                            default:
                              statusIcon = <Clock className="w-3.5 h-3.5" />;
                              statusColor = "text-yellow-400";
                              break;
                          }

                          return (
                            <div
                              key={invite.id}
                              className="p-3 rounded-xl bg-white/5 border border-white/10"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {invite.session_title}
                                  </p>
                                  <p className="text-xs text-white/40 truncate">
                                    To: {invite.email}
                                  </p>
                                </div>
                                <span className={statusColor}>{statusIcon}</span>
                              </div>
                              {invite.status === "pending" && (
                                <button
                                  onClick={() => revokeInvite(invite.id)}
                                  className="mt-2 w-full py-1.5 text-xs font-medium rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sessions Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Radio className="w-5 h-5 text-purple-400" />
            Sessions
          </h2>
          <span className="text-sm text-white/40">
            {filteredSessions.length} session
            {filteredSessions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Sessions Grid */}
        {filteredSessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <Music className="w-10 h-10 text-white/20" />
            </div>
            <p className="text-white/40 mb-1">No sessions found</p>
            <p className="text-sm text-white/30">
              {isGuest
                ? "Join a session or create an account"
                : "Create your first session above"}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <AnimatePresence>
              {filteredSessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -4 }}
                  className="group relative bg-white/5 hover:bg-white/[0.08] rounded-2xl p-3 sm:p-4 border border-white/10 hover:border-white/20 transition-all duration-200 cursor-pointer"
                  onClick={() => openSession(s)}
                >
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 mb-2">
                    {s.is_private === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-md text-[10px] font-medium">
                        <Lock className="w-2.5 h-2.5" />
                        Private
                      </span>
                    )}
                    {s.is_live === 1 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500/30 text-red-300 rounded-md text-[10px] font-medium">
                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                        LIVE
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-sm sm:text-base truncate mb-2 group-hover:text-purple-300 transition-colors">
                    {s.title}
                  </h3>

                  {/* Meta */}
                  <div className="space-y-1 text-xs text-white/40 mb-3">
                    <p className="flex items-center gap-1.5">
                      <Users className="w-3 h-3" />
                      {s.participant_count}
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      <span className="truncate">
                        {new Date(s.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                  </div>

                  {/* Actions Row */}
                  <div className="flex items-center gap-2">
                    {/* QR Code - Clickable */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setQrModalSession(s);
                      }}
                      className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-colors"
                      title="Show QR Code"
                    >
                      <QRCodeCanvas
                        value={`${window.location.origin}/session/${s.id}`}
                        size={36}
                        level="H"
                        bgColor="transparent"
                        fgColor="#ffffff"
                        className="opacity-70 group-hover:opacity-100 transition-opacity"
                      />
                    </button>

                    <div className="flex flex-col gap-1 flex-1">
                      {/* Copy Link */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyJoinLink(s.id);
                        }}
                        className={`flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          copiedId === s.id
                            ? "bg-green-500/20 text-green-400"
                            : "bg-white/5 hover:bg-white/10 border border-white/10"
                        }`}
                      >
                        {copiedId === s.id ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        {copiedId === s.id ? "Copied" : "Copy"}
                      </button>

                      {/* Delete - only for host */}
                      {isLoggedIn &&
                        userId &&
                        Number(userId) === s.hostId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteModal(s.id);
                            }}
                            className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* QR Code Modal */}
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

      {/* Delete Modal */}
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
                This action cannot be undone. All participants will be removed.
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
    </div>
  );
}