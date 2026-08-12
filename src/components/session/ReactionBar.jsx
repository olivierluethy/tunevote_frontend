// Ephemeral emoji reactions on the playing song (#18). Tapping an emoji emits a
// `song_reaction` socket event and floats it locally; reactions from others
// arrive as `song_reaction_broadcast` and float too. Nothing is persisted.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const EMOJIS = ["😍", "🔥", "👏", "🎉", "😴"];

export default function ReactionBar({ socketRef }) {
  const [floaters, setFloaters] = useState([]);
  const idRef = useRef(0);

  const addFloater = useCallback((emoji) => {
    const id = ++idRef.current;
    const left = 8 + Math.random() * 84; // % across the bar
    setFloaters((f) => [...f, { id, emoji, left }]);
    // Remove after the float animation completes.
    setTimeout(() => {
      setFloaters((f) => f.filter((x) => x.id !== id));
    }, 2200);
  }, []);

  useEffect(() => {
    const s = socketRef?.current;
    if (!s) return;
    const handler = (payload) => addFloater(payload?.emoji);
    s.on("song_reaction_broadcast", handler);
    return () => s.off("song_reaction_broadcast", handler);
  }, [socketRef, addFloater]);

  const react = (emoji) => {
    addFloater(emoji);
    socketRef?.current?.emit("song_reaction", { emoji });
  };

  return (
    <div className="relative">
      {/* Floating layer — rises out of the button row */}
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-40 overflow-hidden">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.span
              key={f.id}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 1, 0], y: -140, scale: 1.1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: "easeOut" }}
              style={{ left: `${f.left}%` }}
              className="absolute bottom-0 text-2xl"
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => react(e)}
            className="text-xl rounded-full px-2 py-1 bg-white/5 hover:bg-white/15 active:scale-90 transition-all"
            title="React"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
