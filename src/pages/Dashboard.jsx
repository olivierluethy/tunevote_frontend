// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  LogOut,
  Copy,
  Trash2,
  Users,
  Radio,
  Clock,
  Music,
  Link2,
  Sparkles,
  AlertCircle,
  UserPlus,
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

  // Prüfungen
  const isGuest = !token && guestToken;
  const isLoggedIn = !!token;
  const displayName = isGuest ? guestName : username;

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
    const res = await axios.get("http://localhost:4000/sessions", {
      headers: getAuthHeaders(),
    });
    setSessions(res.data);
  } catch (err) {
    console.error("Fehler beim Laden der Sessions:", err);

    // Nur bei echten Token-Problemen ausloggen, nicht bei Gast-Token
    if (
      !isGuest &&
      (err.response?.status === 401 || err.response?.status === 403)
    ) {
      localStorage.clear();
      navigate("/login");
    }
  }
};

  useEffect(() => {
    if (token || guestToken) {
      fetchSessions();
    } else {
      navigate("/login");
    }
  }, [token, guestToken]);

  // === Logout ===
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  // === Session erstellen (nur eingeloggte) ===
  const createSession = async () => {
    if (!isLoggedIn || !newSessionTitle.trim() || loading) return;
    setLoading(true);
    try {
      const res = await axios.post(
        "http://localhost:4000/sessions",
        { title: newSessionTitle },
        { headers: getAuthHeaders() }
      );
      setSessions((prev) => [res.data, ...prev]);
      setNewSessionTitle("");
    } catch (err) {
      alert("Fehler beim Erstellen der Session");
    } finally {
      setLoading(false);
    }
  };

  // === Session löschen (nur Host) ===
  const deleteSession = async (sessionId) => {
    try {
      await axios.delete(`http://localhost:4000/sessions/${sessionId}`, {
        headers: getAuthHeaders(),
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setShowDeleteModal(null);
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
  };

  // === Session öffnen ===
  const openSession = (session) => {
    navigate(`/session/${session.id}`);
  };

  // === Schutz: Kein Zugriff ohne Token oder GuestToken ===
  if (!token && !guestToken) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 -right-4 w-96 h-96 bg-pink-600 rounded-full filter blur-3xl animate-pulse animation-delay-2000"></div>
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 backdrop-blur-xl bg-black/30 border-b border-white/10"
      >
        <div className="max-w-7xl mx-auto px-6 py-5 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Music className="w-8 h-8 text-purple-400" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Willkommen, <span className="text-white">{displayName}</span>!
              {isGuest && <span className="text-sm text-yellow-400 ml-2">(Gast)</span>}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="group flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-red-600/20 border border-red-500/50 hover:bg-red-600/30 transition-all duration-300"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">{isGuest ? "Verlassen" : "Logout"}</span>
          </button>
        </div>
      </motion.header>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-10">

        {/* === GAST-BANNER === */}
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-5 bg-gradient-to-r from-yellow-600/20 to-orange-600/20 backdrop-blur-lg border border-yellow-500/30 rounded-2xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="font-semibold text-yellow-200">Gastmodus aktiv</p>
                <p className="text-sm text-yellow-300">
                  Erstelle einen Account, um Sessions zu erstellen und zu löschen!
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/register")}
              className="px-5 py-2 bg-yellow-500 text-purple-900 font-bold rounded-xl hover:bg-yellow-400 transition-all flex items-center space-x-2"
            >
              <UserPlus className="w-5 h-5" />
              <span>Account erstellen</span>
            </button>
          </motion.div>
        )}

        {/* === Session erstellen (nur eingeloggte) === */}
        {isLoggedIn && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <div className="backdrop-blur-2xl bg-white/10 rounded-3xl p-8 border border-white/20 shadow-2xl">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                  <Plus className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Neue Session starten</h2>
              </div>

              <div className="flex gap-4">
                <input
                  type="text"
                  placeholder="z.B. Summer Vibes 2025"
                  className="flex-1 px-5 py-4 rounded-2xl bg-white/10 border border-white/20 placeholder-gray-400 focus:border-purple-400 focus:outline-none transition-all text-lg"
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && createSession()}
                  disabled={loading}
                />
                <button
                  onClick={createSession}
                  disabled={loading || !newSessionTitle.trim()}
                  className="group px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-lg flex items-center space-x-3 hover:shadow-2xl hover:shadow-purple-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                  <span>{loading ? "Wird erstellt..." : "Erstellen"}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* === Sessions Grid === */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold flex items-center space-x-3">
            <Radio className="w-8 h-8 text-purple-400" />
            <span>Aktive Sessions</span>
          </h2>
          <p className="text-gray-400">{sessions.length} Session{sessions.length !== 1 ? "s" : ""}</p>
        </div>

        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-white/5 backdrop-blur flex items-center justify-center">
              <Music className="w-16 h-16 text-gray-500" />
            </div>
            <p className="text-xl text-gray-400">Noch keine Sessions</p>
            {isGuest ? (
              <p className="text-gray-500">Tritt einer Session bei oder erstelle einen Account!</p>
            ) : (
              <p className="text-gray-500">Erstelle deine erste Session oben!</p>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {sessions.map((s, i) => (
                <motion.div
                  key={s.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -20 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -8 }}
                  className="group relative backdrop-blur-2xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-xl hover:shadow-2xl hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer"
                  onClick={() => openSession(s)}
                >
                  {/* Live Indicator */}
                  {s.is_live && (
                    <div className="absolute -top-3 -right-3 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                      <div className="relative">
                        <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-75"></div>
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                      <span>LIVE</span>
                    </div>
                  )}

                  <h3 className="text-xl font-bold mb-2 group-hover:text-purple-300 transition-colors">
                    {s.title}
                  </h3>

                  <div className="space-y-2 text-sm text-gray-300">
                    <p className="flex items-center space-x-2">
                      <Users className="w-4 h-4" />
                      <span>{s.participant_count} Teilnehmer</span>
                    </p>
                    <p className="flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(s.created_at).toLocaleDateString()} um {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-4 mt-6">
                    <div className="flex-1">
                      <div className="p-3 bg-white/10 rounded-2xl border border-white/20 backdrop-blur">
                        <QRCodeCanvas
                          value={`${window.location.origin}/session/${s.id}`}
                          size={72}
                          level="H"
                          className="mx-auto"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {/* Link kopieren */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyJoinLink(s.id);
                        }}
                        className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          copiedId === s.id
                            ? "bg-green-600 text-white"
                            : "bg-white/10 hover:bg-white/20 border border-white/20"
                        }`}
                      >
                        {copiedId === s.id ? (
                          <>Checkmark</>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Link</span>
                          </>
                        )}
                      </button>

                      {/* Löschen – nur für Host (eingeloggter Nutzer) */}
                      {isLoggedIn && userId && Number(userId) === s.hostId && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteModal(s.id);
                          }}
                          className="flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/50 text-xs font-medium transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Löschen</span>
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

      {/* === Delete Modal === */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-purple-900/90 to-blue-900/90 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full border border-white/20 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl bg-red-600/20">
                  <AlertCircle className="w-6 h-6 text-red-400" />
                </div>
                <h3 className="text-2xl font-bold">Session löschen?</h3>
              </div>

              <p className="text-gray-300 mb-8">
                Diese Aktion kann nicht rückgängig gemacht werden. Alle Teilnehmer werden entfernt.
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 font-medium transition-all"
                >
                  Abbrechen
                </button>
                <button
                  onClick={() => deleteSession(showDeleteModal)}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 font-medium transition-all"
                >
                  Löschen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}