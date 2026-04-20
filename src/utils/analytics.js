// Lightweight Google Analytics (gtag) wrapper
// All calls are non-blocking and fail silently to avoid impacting UX

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export function trackEvent(eventName, params = {}) {
  if (!window.gtag || !GA_MEASUREMENT_ID) return;
  try {
    window.gtag("event", eventName, {
      ...params,
      send_to: GA_MEASUREMENT_ID,
    });
  } catch (e) {
    // Silently fail — tracking must never break the app
  }
}

export function trackPageView(pagePath, pageTitle) {
  if (!window.gtag || !GA_MEASUREMENT_ID) return;
  try {
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_title: pageTitle,
      send_to: GA_MEASUREMENT_ID,
    });
  } catch (e) {}
}

// --- Diagnostic timing helpers -------------------------------------------
// Lets us compute durations (`time_since_search_ms`, `time_since_session_start_ms`,
// first-song-added delta, response_time_ms) without threading refs through
// many components. Keys are arbitrary strings; callers own the namespace.
const _timings = new Map();

export function markTime(key) {
  _timings.set(key, performance.now());
}

export function msSince(key) {
  const t = _timings.get(key);
  if (t == null) return null;
  return Math.round(performance.now() - t);
}

export function clearTime(key) {
  _timings.delete(key);
}

// --- Once-per-key dedupe -------------------------------------------------
// For lifecycle events that MUST NOT fire twice in a single session
// (e.g. `session_initialized`, `session_empty_state_seen`, `guest_modal_shown`).
// Callers pass a dedupeKey — typically scoped by sessionId so navigating
// to a different session re-enables the event.
const _firedOnce = new Set();

export function trackOnce(eventName, params = {}, dedupeKey) {
  const k = dedupeKey || eventName;
  if (_firedOnce.has(k)) return;
  _firedOnce.add(k);
  trackEvent(eventName, params);
}

export function resetTrackOnce(dedupeKey) {
  _firedOnce.delete(dedupeKey);
}

// --- YouTube API error classifier ----------------------------------------
// Maps axios errors to a small, dashboard-friendly enum so we can tell
// quota exhaustion apart from a bad key or a network blip. This is what
// makes the "did the API fail or did the user get zero results?" question
// answerable in GA.
export function classifyYouTubeError(err) {
  if (!err) return "unknown";
  if (err.code === "ECONNABORTED") return "timeout";
  if (!err.response) return "network_error";
  const status = err.response.status;
  const reason =
    err.response.data?.error?.errors?.[0]?.reason ||
    err.response.data?.error?.status ||
    "";
  if (status === 403 && /quota|dailyLimitExceeded|rateLimitExceeded/i.test(reason)) {
    return "quota_exceeded";
  }
  if (status === 400) return "invalid_key";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limit";
  if (status >= 500) return "server_error";
  return "api_error";
}

// Idle / inactivity tracker for a component.
// Returns { reset, cleanup } — call reset() on any user interaction,
// and cleanup() on unmount.
export function createIdleTracker(label, sessionId, thresholdMs = 30000) {
  let timer = null;
  let fired = false;

  function start() {
    if (fired) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      trackEvent("user_idle", {
        idle_location: label,
        session_id: sessionId || "n/a",
        idle_threshold_sec: Math.round(thresholdMs / 1000),
      });
    }, thresholdMs);
  }

  function reset() {
    fired = false;
    start();
  }

  function cleanup() {
    clearTimeout(timer);
  }

  start();
  return { reset, cleanup };
}

// Scroll depth tracker — fires events at 25/50/75/100%
export function createScrollTracker(pageName) {
  const thresholds = [25, 50, 75, 100];
  const fired = new Set();

  function handler() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight =
      document.documentElement.scrollHeight -
      document.documentElement.clientHeight;
    if (docHeight <= 0) return;

    const percent = Math.round((scrollTop / docHeight) * 100);

    for (const t of thresholds) {
      if (percent >= t && !fired.has(t)) {
        fired.add(t);
        trackEvent("scroll_depth", {
          page: pageName,
          depth_percent: t,
        });
      }
    }
  }

  window.addEventListener("scroll", handler, { passive: true });

  return function cleanup() {
    window.removeEventListener("scroll", handler);
  };
}

// Time-on-page tracker — sends an event when the user leaves
export function createTimeTracker(pageName) {
  const startTime = Date.now();

  return function sendTimeEvent() {
    const durationSec = Math.round((Date.now() - startTime) / 1000);
    trackEvent("time_on_page", {
      page: pageName,
      duration_sec: durationSec,
    });
  };
}
