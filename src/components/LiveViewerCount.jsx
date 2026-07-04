import { Users } from "lucide-react";

// Abbreviate a viewer count Twitch-style: exact under 1K, then 1.2K / 12K / 1.2M.
function formatViewerCount(value) {
  const n = Number(value) || 0;
  if (n < 1000) return String(n);
  const strip = (v, digits) => v.toFixed(digits).replace(/\.0+$/, "");
  if (n < 1_000_000) return `${strip(n / 1000, n < 10_000 ? 1 : 0)}K`;
  return `${strip(n / 1_000_000, n < 10_000_000 ? 1 : 0)}M`;
}

// Twitch-style live viewer count: a pulsing "alive" dot + person icon + the
// abbreviated count. The number is presence-derived on the backend (heartbeats),
// so this component only renders whatever count it is handed. Tailwind-only,
// dark-mode. Goes green + pulses when `live`; static and muted otherwise.
export default function LiveViewerCount({ count = 0, live = false, className = "" }) {
  const label = live ? `${count} watching now` : `${count} participants`;

  return (
    <span
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 tabular-nums ${
        live ? "text-green-300" : ""
      } ${className}`}
    >
      {live && (
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.9)]" />
        </span>
      )}
      <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span className="font-semibold leading-none">{formatViewerCount(count)}</span>
    </span>
  );
}
