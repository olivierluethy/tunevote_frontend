// src/pages/Register.jsx
import React, { useState , useEffect } from "react";
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
      const res = await axios.post("https://api.tunevote.com/register", {
        username,
        email,
        password,
      });
      setMessage(res.data.message);
      setSuccess(true);
      setUsername("");
      setEmail("");
      setPassword("");
    } catch (err) {
      setMessage(err.response?.data?.error || "Server error");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-hidden relative flex items-center justify-center p-4">
      {/* Animated Background Orbs */}
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

      {/* Floating Particles */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Username */}
          <motion.div
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
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
            transition={{ delay: 0.4 }}
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

          {/* Message */}
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
            transition={{ delay: 0.6 }}
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
          transition={{ delay: 0.7 }}
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

      {/* Success Confetti (on success) */}
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