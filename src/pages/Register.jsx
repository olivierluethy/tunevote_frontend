// src/pages/Register.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { User, Mail, Lock, Music, Sparkles, AlertCircle, CheckCircle } from "lucide-react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // 🧹 Wird beim Betreten der Login-Seite ausgeführt
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
        username,
        email,
        password,
      });

      setMessage(res.data.message);
      setSuccess(true);
      setUsername("");
      setEmail("");
      setPassword("");

      setTimeout(() => {
        window.location.href = "/login";
      }, 1500); // etwas länger, damit man die Success-Message sieht

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden relative flex items-center justify-center p-4">
      {/* Animated Background Orbs – unverändert */}
      <div className="fixed inset-0 pointer-events-none">
        <motion.div
          animate={{
            x: [0, -120, 0],
            y: [0, 80, 0],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-20 left-20 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl opacity-30"
        />
        <motion.div
          animate={{
            x: [0, 150, 0],
            y: [0, -100, 0],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute bottom-20 right-20 w-96 h-96 bg-pink-600 rounded-full filter blur-3xl opacity-30"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -180, -360],
          }}
          transition={{
            duration: 35,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-600 rounded-full filter blur-3xl opacity-20"
        />
      </div>

      {/* Floating Particles – unverändert */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="fixed w-1.5 h-1.5 bg-pink-400 rounded-full opacity-70"
          initial={{
            x: Math.random() * window.innerWidth,
            y: window.innerHeight + 20,
          }}
          animate={{
            y: -20,
            x: Math.random() * window.innerWidth,
          }}
          transition={{
            duration: Math.random() * 12 + 12,
            repeat: Infinity,
            delay: Math.random() * 6,
            ease: "linear",
          }}
        />
      ))}

      {/* Register Card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 backdrop-blur-2xl bg-white/10 rounded-3xl p-10 w-full max-w-md border border-white/20 shadow-2xl"
      >
        {/* Logo + Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 mb-4"
          >
            <Music className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className="text-gray-300 mt-2">Join the music sync revolution</p>
        </div>

        {/* Google Button + Divider – jetzt OBEN, genau wie beim Login */}
        <div className="mb-6">
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-4 px-5 rounded-2xl bg-white/10 border border-white/30 text-white font-medium text-lg flex items-center justify-center gap-3 hover:bg-white/15 hover:border-white/40 hover:shadow-xl hover:shadow-purple-500/20 transition-all duration-300 backdrop-blur-md"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
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
            <span>Continue with Google</span>
          </motion.button>

          <div className="relative mt-6 mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/20" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white/5 text-gray-300 backdrop-blur-sm rounded-full">
                or
              </span>
            </div>
          </div>
        </div>

        {/* Form – jetzt darunter */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <motion.div
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-2">
              <User className="w-4 h-4" />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all duration-300"
              placeholder="yourusername"
              required
            />
          </motion.div>

          {/* Email */}
          <motion.div
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.45 }}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-2">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all duration-300"
              placeholder="you@example.com"
              required
            />
          </motion.div>

          {/* Password */}
          <motion.div
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <label className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-2">
              <Lock className="w-4 h-4" />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/50 transition-all duration-300"
              placeholder="••••••••"
              required
            />
          </motion.div>

          {/* Message / Feedback */}
          <AnimatePresence>
            {message && (
              <motion.div
                initial={{ opacity: 0, y: -10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.9 }}
                className={`flex items-center gap-2 p-4 rounded-2xl border text-sm font-medium ${
                  success
                    ? "bg-green-600/20 border-green-500/50 text-green-300"
                    : "bg-red-600/20 border-red-500/50 text-red-300"
                }`}
              >
                {success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span>{message}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55 }}
          >
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 font-bold text-lg flex items-center justify-center gap-3 hover:shadow-2xl hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                />
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </motion.div>
        </form>

        {/* Login Link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65 }}
          className="mt-8 text-center text-gray-300"
        >
          Already have an account?{" "}
          <a
            href="/login"
            className="font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent hover:underline"
          >
            Log in here
          </a>
        </motion.p>
      </motion.div>

      {/* Success Confetti */}
      <AnimatePresence>
        {success && (
          <>
            {[...Array(30)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  x: Math.random() * window.innerWidth,
                  y: -20,
                  rotate: Math.random() * 360,
                }}
                animate={{
                  y: window.innerHeight + 20,
                  rotate: Math.random() * 720,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: Math.random() * 3 + 2,
                  ease: "easeOut",
                }}
                className="fixed w-3 h-3 rounded-sm"
                style={{
                  background: i % 3 === 0 ? "#a855f7" : i % 3 === 1 ? "#ec4899" : "#06b6d4",
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}