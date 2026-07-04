// One-off test for the auth-failure decision that fixes the stale-cookie →
// guest bug. The frontend has no test runner wired up, so run this directly:
//   node src/utils/auth.test.mjs
import assert from "node:assert/strict";
import { resolveAuthFailure } from "./auth.js";

let passed = 0;
const check = (name, actual, expected) => {
  assert.equal(actual, expected, `${name}: expected ${expected}, got ${actual}`);
  passed++;
  console.log(`  ok  ${name}`);
};

// The bug: a leftover (expired) login token present → 401/403. Old code showed
// the guest modal, leaving the dead token to shadow the guest identity. Correct:
// purge the stale login and send the user to re-authenticate.
check("stale token, 401 → clear-and-login",
  resolveAuthFailure({ hadToken: true, status: 401 }), "clear-and-login");
check("stale token, 403 → clear-and-login",
  resolveAuthFailure({ hadToken: true, status: 403 }), "clear-and-login");

// Genuinely anonymous visitor (no token) → guest join is legitimate.
check("no token, 401 → guest",
  resolveAuthFailure({ hadToken: false, status: 401 }), "guest");
check("no token, 403 → guest",
  resolveAuthFailure({ hadToken: false, status: 403 }), "guest");

// Non-auth failures are not this handler's concern.
check("token present, 404 → none",
  resolveAuthFailure({ hadToken: true, status: 404 }), "none");
check("no token, 500 → none",
  resolveAuthFailure({ hadToken: false, status: 500 }), "none");
check("undefined status → none",
  resolveAuthFailure({ hadToken: true, status: undefined }), "none");

console.log(`\n${passed} passed`);
