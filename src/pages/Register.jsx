// src/pages/Register.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Music, Sparkles, AlertCircle, CheckCircle, X, User } from "lucide-react";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    localStorage.clear();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    setSuccess(false);

    try {
      const res = await axios.post("http://localhost:4000/register", {
        email,
        password,
      });

      setMessage(res.data.message);
      setSuccess(true);
      setEmail("");
      setPassword("");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
    } catch (err) {
      setMessage(err.response?.data?.error || "Server error");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:4000/auth/google";
  };

  const handleFacebookLogin = () => {
    window.location.href = "http://localhost:4000/auth/facebook";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center p-4">
      {/* Subtle Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-pink-600/20 rounded-full filter blur-[120px]"></div>
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-purple-600/15 rounded-full filter blur-[100px]"></div>
      </div>

      {/* Register Card */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-sm"
      >
        {/* Logo + Title - Compact */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 300 }}
            className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-3"
          >
            <Music className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-white/50 text-sm mt-1">Join the music sync revolution</p>
        </div>

        {/* Card Container */}
        <div className="backdrop-blur-xl bg-white/5 rounded-2xl p-5 border border-white/10 shadow-2xl">
          {/* Social Login Buttons - Compact Side by Side */}
          <div className="flex gap-3 mb-4">
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              onClick={handleFacebookLogin}
              type="button"
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#1877F2"
                  d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.925-1.955 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 22.954 24 17.99 24 12z"
                />
              </svg>
              <span className="hidden xs:inline">Facebook</span>
            </motion.button>

            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              onClick={handleGoogleLogin}
              type="button"
              className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.51h5.84c-.25 1.31-.98 2.42-2.07 3.16v2.63h3.35c1.96-1.81 3.1-4.47 3.1-7.8z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-1.01 7.28-2.73l-3.35-2.63c-1.01.68-2.29 1.08-3.93 1.08-3.02 0-5.58-2.04-6.49-4.79H.96v2.67C2.77 20.39 6.62 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.51 14.21c-.23-.68-.36-1.41-.36-2.21s.13-1.53.36-2.21V7.34H.96C.35 8.85 0 10.39 0 12s.35 3.15.96 4.66l4.55-2.45z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 4.98c1.64 0 3.11.56 4.27 1.66l3.19-3.19C17.46 1.01 14.97 0 12 0 6.62 0 2.77 2.61 0.96 6.34l4.55 2.45C6.42 6.02 8.98 4.98 12 4.98z"
                  fill="#EA4335"
                />
              </svg>
              <span className="hidden xs:inline">Google</span>
            </motion.button>
          </div>

          {/* Divider - Compact */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 text-xs text-white/30 bg-slate-950/50 rounded">
                or register with email
              </span>
            </div>
          </div>

          {/* Form - Compact */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Email Field */}
            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none transition-colors"
                  placeholder="Email address"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-purple-400 focus:outline-none transition-colors"
                  placeholder="Password (min. 8 characters)"
                  required
                  minLength={8}
                />
              </div>
            </div>

            {/* Terms hint */}
            <p className="text-[10px] text-white/30 text-center px-2">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>

            {/* Message / Feedback - Compact */}
            <AnimatePresence>
              {message && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs ${
                    success
                      ? "bg-green-500/10 border-green-500/20 text-green-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {success ? (
                    <CheckCircle className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span className="flex-1">{message}</span>
                  {!success && (
                    <button type="button" onClick={() => setMessage("")}>
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-purple-500/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </motion.button>
          </form>
        </div>

        {/* Login Link - Outside Card */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-5 text-center text-sm text-white/50"
        >
          Already have an account?{" "}
          <a
            href="/login"
            className="font-semibold text-purple-400 hover:text-purple-300 transition-colors"
          >
            Log in
          </a>
        </motion.p>
      </motion.div>

      {/* Success Confetti - Simplified */}
      <AnimatePresence>
        {success && (
          <>
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: "50vw",
                  y: "50vh",
                  scale: 0,
                }}
                animate={{
                  x: `${20 + Math.random() * 60}vw`,
                  y: `${20 + Math.random() * 60}vh`,
                  scale: 1,
                  rotate: Math.random() * 360,
                }}
                exit={{ opacity: 0, scale: 0 }}
                transition={{
                  duration: 0.8,
                  ease: "easeOut",
                }}
                className="fixed w-2 h-2 rounded-full pointer-events-none"
                style={{
                  background:
                    i % 3 === 0
                      ? "#a855f7"
                      : i % 3 === 1
                        ? "#ec4899"
                        : "#06b6d4",
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}