const PLAYER_ID_STORAGE_KEY = "player-id";
const PLAYER_NAME_STORAGE_KEY = "player-name";
const GUEST_NICKNAME_PREFIXES = Object.freeze({
  ko: "플레이어",
  ja: "プレイヤー",
  en: "Player"
});

let fallbackPlayerId = "";

function canUseStorage() {
  return typeof localStorage !== "undefined";
}

function normalizeStoredName(name) {
  if (typeof name !== "string") {
    return "";
  }

  return Array.from(name.trim().replace(/\s+/g, " ")).slice(0, 12).join("");
}

function normalizePlayerId(playerId) {
  if (typeof playerId !== "string") {
    return "";
  }

  const trimmed = playerId.trim();
  return /^[A-Za-z0-9_-]{16,64}$/u.test(trimmed) ? trimmed : "";
}

function createPlayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `player-${Math.random().toString(36).slice(2, 14)}-${Date.now().toString(36)}`;
}

function createGuestSuffix(playerId) {
  const safePlayerId = normalizePlayerId(playerId) || "player";
  const hash = Array.from(safePlayerId).reduce((accumulator, character, index) => {
    return ((accumulator * 33) + character.charCodeAt(0) + index) >>> 0;
  }, 5381);

  return String(hash % 10000).padStart(4, "0");
}

function resolveGuestNicknamePrefix(lang = "en") {
  return GUEST_NICKNAME_PREFIXES[lang] || GUEST_NICKNAME_PREFIXES.en;
}

export function getOrCreatePlayerId() {
  if (canUseStorage()) {
    const stored = normalizePlayerId(localStorage.getItem(PLAYER_ID_STORAGE_KEY));
    if (stored) {
      return stored;
    }

    const nextId = createPlayerId();
    localStorage.setItem(PLAYER_ID_STORAGE_KEY, nextId);
    return nextId;
  }

  if (!fallbackPlayerId) {
    fallbackPlayerId = createPlayerId();
  }

  return fallbackPlayerId;
}

export function getSavedNickname() {
  if (!canUseStorage()) {
    return "";
  }

  return normalizeStoredName(localStorage.getItem(PLAYER_NAME_STORAGE_KEY));
}

export function rememberNickname(name) {
  if (!canUseStorage()) {
    return;
  }

  const safeName = normalizeStoredName(name);

  if (!safeName) {
    localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
    return;
  }

  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, safeName);
}

export function clearSavedNickname() {
  if (!canUseStorage()) {
    return;
  }

  localStorage.removeItem(PLAYER_NAME_STORAGE_KEY);
}

export function buildGuestNickname(playerId, lang = "en") {
  return normalizeStoredName(`${resolveGuestNicknamePrefix(lang)}#${createGuestSuffix(playerId)}`);
}
