function matchesAnyMedia(query) {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(query).matches
    : false;
}

function hasTouchCapabilities() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorRef = window.navigator;
  const maxTouchPoints = Number(navigatorRef?.maxTouchPoints || navigatorRef?.msMaxTouchPoints || 0);
  return matchesAnyMedia("(hover: none), (pointer: coarse)")
    || maxTouchPoints > 0
    || "ontouchstart" in window;
}

function looksLikeMobileBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = String(window.navigator?.userAgent || "");
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|SamsungBrowser|CriOS/i.test(userAgent);
}

function isNarrowViewport() {
  return matchesAnyMedia("(max-width: 760px)");
}

export function isTouchDevice() {
  return hasTouchCapabilities() || (looksLikeMobileBrowser() && isNarrowViewport());
}

export function isPortraitTouchViewport() {
  return isTouchDevice() && matchesAnyMedia("(orientation: portrait)");
}

export function isLandscapeTouchViewport() {
  return isTouchDevice() && matchesAnyMedia("(orientation: landscape)");
}

export async function requestLandscapePresentation(target) {
  if (target?.requestFullscreen && !document.fullscreenElement) {
    try {
      await target.requestFullscreen({ navigationUI: "hide" });
    } catch {
      // Fullscreen is best-effort on mobile browsers.
    }
  }

  if (screen.orientation?.lock) {
    try {
      await screen.orientation.lock("landscape");
    } catch {
      // Orientation lock is not supported in every mobile browser.
    }
  }
}

export async function exitLandscapePresentation() {
  if (screen.orientation?.unlock) {
    try {
      screen.orientation.unlock();
    } catch {
      // Ignore unsupported browsers.
    }
  }

  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore exit failures.
    }
  }
}
