import { useEffect, useRef, useState } from "react";

// Deterministic 0..1 PRNG seeded from a string. A given song always draws the
// SAME waveform (stable — never flickers), yet every song looks different.
function makeRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Build a plausible audio-envelope shape: a slow-moving loud/quiet envelope plus
// per-bar detail, tapered at the edges so it reads like a real clip.
function buildBars(seedStr, count) {
  const rng = makeRng(seedStr || "tunevote");
  const phase = rng() * Math.PI * 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const env = 0.55 + 0.4 * Math.sin(i / (count / 6) + phase);
    const detail = 0.35 + rng() * 0.65;
    let v = env * 0.5 + detail * 0.55;
    v *= 0.82 + 0.18 * Math.sin((i / count) * Math.PI); // soft edge taper
    out.push(Math.max(0.14, Math.min(1, v)));
  }
  return out;
}

// A SoundCloud-style "waveform" for the now-playing song.
//
// We cannot read YouTube's real audio (it plays in a cross-origin iframe, so the
// Web Audio API can't tap it). Instead the SHAPE is deterministic per song and
// the PROGRESS is real — driven by getProgress() (the clock-offset-corrected
// server position). It reads as a real waveform and never flickers randomly.
export default function SongWaveform({
  seed = "",
  playing = false,
  getProgress,
  bars = 56,
  className = "",
}) {
  const barsRef = useRef(buildBars(String(seed), bars));
  useEffect(() => {
    barsRef.current = buildBars(String(seed), bars);
  }, [seed, bars]);

  // Track only the "played up to" bar index; re-render just when it changes
  // (every few seconds), not every animation frame.
  const [head, setHead] = useState(0);
  useEffect(() => {
    if (typeof getProgress !== "function") return;
    let alive = true;
    let raf;
    let last = -1;
    const tick = () => {
      if (!alive) return;
      const { position = 0, duration = 0 } = getProgress() || {};
      const h =
        duration > 0
          ? Math.round(Math.min(1, Math.max(0, position / duration)) * bars)
          : 0;
      if (h !== last) {
        last = h;
        setHead(h);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [getProgress, bars]);

  return (
    <div
      className={`flex items-center gap-[2px] h-8 w-full ${className}`}
      aria-hidden="true"
    >
      {barsRef.current.map((h, i) => {
        const played = i < head;
        const isHead = playing && i === head;
        return (
          <span
            key={i}
            className={`flex-1 rounded-full transition-[background-color,opacity] duration-300 ${
              played
                ? playing
                  ? "bg-emerald-300"
                  : "bg-emerald-300/50"
                : "bg-white/15"
            } ${
              isHead
                ? "animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                : ""
            }`}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        );
      })}
    </div>
  );
}
