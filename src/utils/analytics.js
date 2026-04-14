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
