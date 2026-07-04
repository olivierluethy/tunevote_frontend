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
