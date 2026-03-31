export function isTouchDevice() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function isPortraitTouchViewport() {
  return isTouchDevice() && window.matchMedia("(orientation: portrait)").matches;
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
