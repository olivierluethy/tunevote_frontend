// Host-only genre selector (#39). Picks 0 or 1 genre from the fixed list; the
// choice is persisted via PATCH /sessions/:id/ai-genre and steers the AI song
// recommendations for subsequent rounds. "Any" (null) restores random variety.
import React, { useState } from "react";
import axios from "axios";
import { Sparkles } from "lucide-react";

// Mirror of services/genres.js GENRES on the backend. Keep in sync.
export const GENRES = [
  "Pop",
  "Hip-Hop/Rap",
  "Rock",
  "Electronic/Dance",
  "R&B/Soul",
  "Latin",
  "Country",
  "Jazz/Blues",
  "Classical",
  "Metal",
  "Folk/Acoustic",
  "Reggae/Dancehall",
  "Schlager/Volksmusik",
  "Other",
];

export default function HostGenreSelect({
  apiBase,
  sessionId,
  getAuthHeaders,
  initialGenre = null,
}) {
  const [genre, setGenre] = useState(initialGenre || "Any");
  const [saving, setSaving] = useState(false);

  const onChange = async (e) => {
    const value = e.target.value;
    const prev = genre;
    setGenre(value);
    setSaving(true);
    try {
      await axios.patch(
        `${apiBase}/sessions/${sessionId}/ai-genre`,
        { genre: value === "Any" ? null : value },
        { headers: getAuthHeaders() }
      );
    } catch (err) {
      console.error("Failed to set AI genre:", err);
      setGenre(prev); // revert on failure
      alert("Could not update the AI genre.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className="flex items-center gap-2 text-sm text-white/70">
      <Sparkles className="w-4 h-4 text-purple-300" />
      <span className="whitespace-nowrap">AI genre</span>
      <select
        value={genre}
        onChange={onChange}
        disabled={saving}
        className="bg-white/10 border border-white/15 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-400/50 disabled:opacity-50"
      >
        <option value="Any">Any</option>
        {GENRES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </label>
  );
}
