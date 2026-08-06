// src/pages/ResetPassword.jsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_URL || "https://api.tunevote.com").replace(/\/+$/, "");

export default function ResetPassword() {
  const { token } = useParams(); // read the token from the URL
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Guard against a missing token.
  useEffect(() => {
    if (!token) {
      setError("No valid reset link.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/reset-password`, {
        token,
        newPassword: password,
      });

      setMessage("Your password has been changed successfully! You can now sign in.");
      setPassword("");
      setConfirmPassword("");

      // Redirect to login after a short delay.
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(
        err.response?.data?.error || "Reset failed. The link may have expired."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070312] text-white flex items-center justify-center px-4 relative overflow-hidden">
      {/* Ambient glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 left-1/4 w-[440px] h-[440px] bg-violet-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/5 w-[320px] h-[320px] bg-fuchsia-600/10 rounded-full blur-[100px]" />
      </div>

      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md rounded-3xl p-8 sm:p-10 bg-white/[0.04] border border-white/10 backdrop-blur-2xl shadow-2xl"
      >
        {/* Logo + title */}
        <div className="text-center mb-8">
          <img
            src="/icons/icon-192.png"
            alt="TuneVote"
            className="w-14 h-14 mx-auto mb-4"
          />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            TuneVote
          </h1>
          <p className="text-white/50 mt-2">Set a new password</p>
        </div>

        {message ? (
          <div className="text-center">
            <div className="mb-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{message}</span>
            </div>
            <a
              href="/login"
              className="inline-block bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold py-3 px-8 rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition"
            >
              Sign in now
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Lock className="w-4 h-4" />
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="8"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-white/70 mb-2">
                <Lock className="w-4 h-4" />
                Repeat password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/40 transition"
                placeholder="••••••••"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm"
                >
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white font-semibold py-3.5 rounded-xl hover:shadow-lg hover:shadow-violet-500/25 disabled:opacity-70 disabled:cursor-not-allowed transition"
            >
              {loading ? "Saving..." : "Change password"}
            </button>

            <p className="text-xs text-white/40 text-center">
              This link expires soon. Please finish the process shortly.
            </p>

            <a
              href="/login"
              className="flex items-center justify-center gap-2 text-white/50 hover:text-violet-300 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </a>
          </form>
        )}
      </motion.div>
    </div>
  );
}
