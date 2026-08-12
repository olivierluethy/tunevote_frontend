// Auth model: a registered user carries a `token` (JWT); a guest carries a
// `guestToken`. getAuthHeaders always prefers the Bearer `token` over the
// guest token, so a *stale* token (an expired login left in localStorage) is
// dangerous: it shadows any guest identity and makes every request 401, while
// the app still believes the user is "logged in" (isLoggedIn = !!token).
//
// resolveAuthFailure decides what to do when a request is rejected with
// 401/403 while entering a session:
//   - a token WAS present  → the previous login is invalid/expired. Purge it and
//                            send the user to re-authenticate. Never fall through
//                            to guest join, which would leave the dead token in
//                            place to shadow the new guest token ("entwertet").
//   - NO token (anonymous) → guest join is legitimate; show the guest modal.
// Anything that isn't an auth status is not this handler's concern → "none".
export function resolveAuthFailure({ hadToken, status }) {
  if (status !== 401 && status !== 403) return "none";
  return hadToken ? "clear-and-login" : "guest";
}

// Remove every trace of a registered-user login. Used when a token is proven
// invalid (server rejected it) so it can't shadow a guest identity or keep the
// UI in a phantom "logged in" state.
export function clearUserAuth(storage = window.localStorage) {
  storage.removeItem("token");
  storage.removeItem("userId");
  storage.removeItem("username");
}

// Base URL of the API, resolved the same way as every other frontend module.
const API_BASE = (
  import.meta.env.VITE_API_URL || "https://api.tunevote.com"
).replace(/\/+$/, "");

// Guarantee the current visitor has an identity before entering an auth-gated
// area (dashboard/session). A logged-in user already has a `token`, so we do
// nothing. An anonymous visitor with no `guestToken` gets one minted via
// POST /guest/join and persisted, so the app (RequireAuth, GET /sessions)
// recognises them as a guest instead of bouncing them to /login.
//
// Fixes issue #45: "Start a Session" from the landing page must make the
// clicker a recognised guest. Never throws — on failure it returns whatever
// token exists (possibly null) and lets the caller proceed/handle it.
export async function ensureGuestToken(storage = window.localStorage) {
  if (storage.getItem("token")) return storage.getItem("token");

  let guestToken = storage.getItem("guestToken");
  if (guestToken) return guestToken;

  const nickname = storage.getItem("guestName") || "Gast";
  try {
    const { default: axios } = await import("axios");
    const { data } = await axios.post(`${API_BASE}/guest/join`, { nickname });
    guestToken = data.guestToken;
    storage.setItem("guestToken", guestToken);
    if (data.nickname) storage.setItem("guestName", data.nickname);
  } catch (err) {
    console.error("ensureGuestToken: guest creation failed:", err);
  }
  return guestToken;
}
