// src/pages/Home.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Play,
  Users,
  Zap,
  Music,
  Heart,
  Shuffle,
  ArrowRight,
  Headphones,
  Mic,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const [audio] = useState(
    new Audio("https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [votes, setVotes] = useState({ yes: 42, no: 8, idk: 15 });
  const [queue, setQueue] = useState([
    {
      id: 1,
      title: "Blinding Lights",
      artist: "The Weeknd",
      votes: 89,
      cover: "https://i.scdn.co/image/ab67616d00001e02ff9ca10b55ce82aeab78608a",
    },
    {
      id: 2,
      title: "Levitating",
      artist: "Dua Lipa",
      votes: 76,
      cover: "https://i.scdn.co/image/ab67616d00001e028f8c0c1d2b9f9a7b4d9f6c5e",
    },
    {
      id: 3,
      title: "Good 4 U",
      artist: "Olivia Rodrigo",
      votes: 71,
      cover: "https://i.scdn.co/image/ab67616d00001e02e4a2f3b3f9a7b4d9f6c5e4a2",
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVotes((prev) => ({
        yes: prev.yes + Math.floor(Math.random() * 3),
        no: prev.no + Math.floor(Math.random() * 2),
        idk: prev.idk + Math.floor(Math.random() * 2),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleDemo = () => {
    if (isPlaying) {
      audio.pause();
    } else {
      audio.loop = true;
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  // ✅ handleJoinSession ruft die Backend-Route auf
  const handleJoinSession = async () => {
    try {
      const res = await fetch("https://api.tunevote.com/join");
      const data = await res.json();

      if (data.redirect) {
        // Variante 1: Browser-Redirect (empfohlen)
        window.location.href = data.redirect;

        // Variante 2: React-Navigation (wenn gleiche Domain)
        // navigate(`/session/${sessionIdAusURL}`);
      } else {
        alert(data.error || "Keine aktive Session gefunden.");
      }
    } catch (err) {
      console.error("Fehler beim Beitritt:", err);
      alert("Fehler beim Beitritt zur Session.");
    }
  };

  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-lg bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Music className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                TuneVote
              </span>
            </Link>
            <div className="flex space-x-4">
              <Link
                to="/dashboard"
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 font-semibold hover:shadow-lg hover:shadow-purple-500/40 transition-all"
              >
                Start Session
              </Link>
              <button
                onClick={handleJoinSession}
                className="px-4 py-2 rounded-lg border border-purple-400 text-purple-300 hover:bg-purple-400/20 font-semibold transition-all"
              >
                Join Session
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 blur-3xl"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              TuneVote
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-300 max-w-3xl mx-auto">
              Collaborative Music Sessions – Vote, Play, Enjoy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/dashboard"
                className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-semibold text-lg flex items-center justify-center space-x-2 hover:shadow-2xl hover:shadow-purple-500/50 transition-all"
              >
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>Start a Session</span>
              </Link>

              <button
                onClick={handleJoinSession}
                className="group px-8 py-4 bg-white/10 backdrop-blur rounded-full font-semibold text-lg flex items-center justify-center space-x-2 border border-white/20 hover:bg-white/20 transition-all"
              >
                <Users className="w-5 h-5" />
                <span>Join a Session</span>
              </button>
            </div>

            {/* Demo Video Placeholder */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="relative max-w-4xl mx-auto mt-16"
            >
              <div className="bg-black/40 backdrop-blur rounded-2xl p-8 border border-white/10">
                <div className="bg-gray-800 rounded-xl h-96 flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-16 h-16 mx-auto mb-4 text-purple-400" />
                    <p className="text-lg">Interactive Demo Coming Soon</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Animated Visualizer */}
        <div className="absolute bottom-0 left-0 right-0 h-32 overflow-hidden opacity-50">
          <div className="flex space-x-2 h-full items-end justify-center">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="w-2 bg-gradient-to-t from-purple-400 to-pink-400 rounded-full"
                animate={{
                  height: [20, 80, 40, 60, 20],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-black/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-400">
              Simple, fun, and collaborative
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {[
              {
                icon: Music,
                title: "Suggest",
                desc: "Add your favorite tracks to the queue",
              },
              {
                icon: Heart,
                title: "Vote",
                desc: "Like, dislike, or stay neutral",
              },
              { icon: Zap, title: "Play", desc: "Winner plays automatically" },
              { icon: Shuffle, title: "Loop", desc: "Keep the party going!" },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <step.icon className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Scenario Cards */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            {[
              {
                title: "Road Trip",
                emoji: "🚗",
                desc: "Perfect playlist for the journey",
              },
              {
                title: "House Party",
                emoji: "🎉",
                desc: "Everyone gets a say in the music",
              },
              {
                title: "Workout Session",
                emoji: "💪",
                desc: "High-energy tracks voted live",
              },
            ].map((scenario, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.05 }}
                className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10"
              >
                <div className="text-4xl mb-4">{scenario.emoji}</div>
                <h3 className="text-xl font-semibold mb-2">{scenario.title}</h3>
                <p className="text-gray-400">{scenario.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Voting Demo */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Live Voting in Action
            </h2>
            <p className="text-xl text-gray-400">See democracy in music</p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="bg-black/40 backdrop-blur rounded-2xl p-8 border border-white/10">
                <div className="flex items-center space-x-4 mb-6">
                  <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl w-20 h-20 flex items-center justify-center">
                    <Music className="w-10 h-10" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Shape of You</h3>
                    <p className="text-gray-400">Ed Sheeran</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-green-400" />
                      <span>Yes ({votes.yes})</span>
                    </span>
                    <div className="w-full max-w-xs bg-gray-700 rounded-full h-3 mx-4">
                      <motion.div
                        className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full"
                        animate={{
                          width: `${(votes.yes / (votes.yes + votes.no + votes.idk)) * 100}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <Heart className="w-5 h-5 text-red-400 rotate-180" />
                      <span>No ({votes.no})</span>
                    </span>
                    <div className="w-full max-w-xs bg-gray-700 rounded-full h-3 mx-4">
                      <motion.div
                        className="bg-gradient-to-r from-red-400 to-red-600 h-3 rounded-full"
                        animate={{
                          width: `${(votes.no / (votes.yes + votes.no + votes.idk)) * 100}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center space-x-2">
                      <span className="text-yellow-400">?</span>
                      <span>IDK ({votes.idk})</span>
                    </span>
                    <div className="w-full max-w-xs bg-gray-700 rounded-full h-3 mx-4">
                      <motion.div
                        className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-3 rounded-full"
                        animate={{
                          width: `${(votes.idk / (votes.yes + votes.no + votes.idk)) * 100}%`,
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button className="flex-1 py-3 rounded-lg bg-green-600 hover:bg-green-700 transition-colors font-semibold">
                    👍 Yes
                  </button>
                  <button className="flex-1 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-colors font-semibold">
                    👎 No
                  </button>
                  <button className="flex-1 py-3 rounded-lg bg-yellow-600 hover:bg-yellow-700 transition-colors font-semibold">
                    🤷 IDK
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <Sparkles className="w-6 h-6 mr-2 text-purple-400" />
                  Tie-Breaker Mode
                </h3>
                <p className="text-gray-300">
                  When votes are tied, our smart algorithm randomly selects a
                  winner with a dramatic countdown!
                </p>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-semibold mb-4 flex items-center">
                  <Headphones className="w-6 h-6 mr-2 text-pink-400" />
                  DJ Effects
                </h3>
                <p className="text-gray-300">
                  Hosts can enable loops, pitch shifts, reverse playback, and
                  more for creative sessions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Artist Dashboard Preview */}
      <section className="py-20 px-4 bg-black/30">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              For Artists & DJs
            </h2>
            <p className="text-xl text-gray-400">
              Engage fans like never before
            </p>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-12">
            <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur rounded-3xl p-8 border border-white/10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold">DJ Dashboard</h3>
                  <p className="text-gray-400">Control the flow</p>
                </div>
                <Mic className="w-12 h-12 text-purple-400" />
              </div>

              <div className="space-y-4">
                {queue.map((song, i) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center space-x-4 bg-black/30 rounded-xl p-4"
                  >
                    <img
                      src={song.cover}
                      alt={song.title}
                      className="w-12 h-12 rounded-lg"
                    />
                    <div className="flex-1">
                      <p className="font-semibold">{song.title}</p>
                      <p className="text-sm text-gray-400">{song.artist}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-400">
                        {song.votes}
                      </p>
                      <p className="text-xs text-gray-400">votes</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 flex space-x-3">
                <button className="flex-1 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 transition-colors font-semibold">
                  Go Live
                </button>
                <button className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors font-semibold border border-white/20">
                  Manage Queue
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <h3 className="text-2xl font-bold mb-4">💰 Monetization</h3>
                <p className="text-gray-300 mb-4">
                  Fans can subscribe to your exclusive sessions and tip during
                  live performances.
                </p>
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black rounded-lg p-4 font-bold">
                  Earn up to $500/session
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
                <h3 className="text-2xl font-bold mb-4">
                  📊 Real-time Analytics
                </h3>
                <p className="text-gray-300">
                  See which songs resonate most with your audience and build
                  better sets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Recommendations */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              AI-Powered Suggestions
            </h2>
            <p className="text-xl text-gray-400">
              Never run out of great music
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                mood: "Chill",
                songs: ["Ocean Eyes", "Yellow", "Weightless"],
                emoji: "🌊",
              },
              {
                mood: "Party",
                songs: ["Uptown Funk", "Dance Monkey", "Levitating"],
                emoji: "🎉",
              },
              {
                mood: "Focus",
                songs: ["Clair de Lune", "Weightless", "Nuvole Bianche"],
                emoji: "🎯",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -10 }}
                className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur rounded-2xl p-6 border border-white/10"
              >
                <div className="text-5xl mb-4 text-center">{card.emoji}</div>
                <h3 className="text-xl font-bold mb-3 text-center">
                  {card.mood} Mode
                </h3>
                <ul className="space-y-2">
                  {card.songs.map((song, j) => (
                    <li
                      key={j}
                      className="text-sm text-gray-300 flex items-center justify-between"
                    >
                      <span>{song}</span>
                      <button className="text-purple-400 hover:text-purple-300">
                        +
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/50 backdrop-blur border-t border-white/10 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Music className="w-8 h-8 text-purple-400" />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                TuneVote
              </span>
            </div>

            <div className="flex space-x-6 mb-4 md:mb-0">
              {["Twitter", "Instagram", "Discord", "GitHub"].map((social) => (
                <a
                  key={social}
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
                >
                  <span className="text-sm">{social[0]}</span>
                </a>
              ))}
            </div>

            <a
              href="#"
              className="px-6 py-2 bg-yellow-500 text-black rounded-full font-semibold hover:bg-yellow-400 transition-colors"
            >
              ☕ Buy us a coffee
            </a>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-gray-400">
            <p>
              © 2025 TuneVote. All rights reserved.{" "}
              <a href="#" className="underline">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
