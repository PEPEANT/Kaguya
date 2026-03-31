import { elements } from "./dom.js";
import { t } from "./i18n.js";

const STORAGE_KEY = "music-enabled";

function createTrack(src, volume) {
  if (typeof Audio === "undefined") {
    return null;
  }

  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = volume;
  return audio;
}

const tracks = {
  lobby: createTrack("./audio/ost00.mp3", 0.34),
  game: createTrack("./audio/ost01.mp3", 0.3)
};

let unlocked = false;
let enabled = true;
let desiredTrackKey = "lobby";
let currentTrackKey = null;
let initialized = false;

function pauseAllTracks() {
  for (const track of Object.values(tracks)) {
    if (!track) {
      continue;
    }

    track.pause();
  }

  currentTrackKey = null;
}

function updateMusicToggleButton() {
  if (!elements.musicToggleButton) {
    return;
  }

  const label = enabled ? t("audio.off") : t("audio.on");
  elements.musicToggleButton.textContent = label;
  elements.musicToggleButton.setAttribute("aria-label", label);
  elements.musicToggleButton.setAttribute("aria-pressed", String(enabled));
}

function rememberPreference() {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(STORAGE_KEY, String(enabled));
}

function getTrack(trackKey) {
  return tracks[trackKey] || null;
}

async function playDesiredTrack() {
  if (!enabled || !unlocked) {
    pauseAllTracks();
    return;
  }

  const nextTrack = getTrack(desiredTrackKey);
  if (!nextTrack) {
    pauseAllTracks();
    return;
  }

  if (currentTrackKey !== desiredTrackKey) {
    for (const [trackKey, track] of Object.entries(tracks)) {
      if (!track) {
        continue;
      }

      if (trackKey !== desiredTrackKey) {
        track.pause();
        track.currentTime = 0;
      }
    }

    nextTrack.currentTime = 0;
    currentTrackKey = desiredTrackKey;
  }

  try {
    await nextTrack.play();
  } catch {
    unlocked = false;
    currentTrackKey = null;
  }
}

function unlockAudio() {
  if (unlocked) {
    return;
  }

  unlocked = true;
  void playDesiredTrack();
}

function bindUnlockEvents() {
  if (typeof window === "undefined") {
    return;
  }

  const onceOptions = { once: true, passive: true };
  window.addEventListener("pointerdown", unlockAudio, onceOptions);
  window.addEventListener("touchstart", unlockAudio, onceOptions);
  window.addEventListener("keydown", unlockAudio, { once: true });
}

export function initAudio() {
  if (initialized) {
    return;
  }

  initialized = true;

  if (typeof localStorage !== "undefined") {
    enabled = localStorage.getItem(STORAGE_KEY) !== "false";
  }

  updateMusicToggleButton();
  bindUnlockEvents();

  if (typeof window !== "undefined") {
    window.addEventListener("langchange", updateMusicToggleButton);
  }
}

export function toggleMusic() {
  unlockAudio();
  enabled = !enabled;
  rememberPreference();
  updateMusicToggleButton();

  if (!enabled) {
    pauseAllTracks();
    return;
  }

  void playDesiredTrack();
}

export function playLobbyMusic() {
  desiredTrackKey = "lobby";
  void playDesiredTrack();
}

export function playGameMusic() {
  desiredTrackKey = "game";
  void playDesiredTrack();
}
