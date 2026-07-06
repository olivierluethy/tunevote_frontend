import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Avatar — a user's profile picture with a clean initials fallback.
//
// Song queue/proposal items only carry the submitter's numeric user id
// (`added_by`) and display name, not their picture. This component resolves
// the picture on demand from the existing `GET /user/:id` endpoint (which
// returns an `image_url` data URI), caching results process-wide and
// de-duplicating in-flight requests so a room with many songs by the same
// person triggers exactly one fetch. Guests (no user id) and users without a
// picture fall back to their initial on a brand gradient.
// ---------------------------------------------------------------------------

const API = "https://api.tunevote.com";

// userId -> image_url string | null (null = resolved, no picture)
const avatarCache = new Map();
// userId -> Promise, so concurrent Avatars for the same user share one request
const inflight = new Map();

const authHeaders = () => {
  const token = localStorage.getItem("token");
  let guestToken = localStorage.getItem("guestToken");
  if (guestToken) guestToken = guestToken.trim().replace(/^["']|["']$/g, "");
  return token
    ? { Authorization: `Bearer ${token}` }
    : guestToken
      ? { "x-guest-token": guestToken }
      : {};
};

async function resolveAvatar(userId) {
  if (avatarCache.has(userId)) return avatarCache.get(userId);
  if (inflight.has(userId)) return inflight.get(userId);

  const req = fetch(`${API}/user/${userId}`, { headers: authHeaders() })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const url = data?.image_url || null;
      avatarCache.set(userId, url);
      return url;
    })
    .catch(() => {
      avatarCache.set(userId, null);
      return null;
    })
    .finally(() => inflight.delete(userId));

  inflight.set(userId, req);
  return req;
}

const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase() || "?";

const Avatar = ({ userId, name, src = null, size = 32, className = "" }) => {
  const [url, setUrl] = useState(src ?? (userId ? avatarCache.get(userId) : null));

  useEffect(() => {
    if (src) {
      setUrl(src);
      return;
    }
    if (!userId) {
      setUrl(null);
      return;
    }
    let alive = true;
    resolveAvatar(userId).then((resolved) => {
      if (alive) setUrl(resolved);
    });
    return () => {
      alive = false;
    };
  }, [userId, src]);

  const dimension = { width: size, height: size };
  const base =
    "shrink-0 overflow-hidden rounded-full ring-1 ring-white/15 select-none";

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `${name}'s avatar` : ""}
        style={dimension}
        className={`${base} object-cover ${className}`}
        onError={(e) => {
          // A broken/expired image URL falls back to initials.
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }

  return (
    <span
      style={dimension}
      aria-hidden="true"
      className={`grid place-items-center bg-gradient-to-br from-purple-500 to-pink-500 text-[0.7em] font-bold text-white ${base} ${className}`}
    >
      {initialOf(name)}
    </span>
  );
};

export default Avatar;
