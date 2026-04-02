const baseUrl = typeof window === "undefined"
  ? ""
  : String(window.__APP_CONFIG__?.rankingApiBaseUrl || "").replace(/\/$/, "");

function getAppConfig() {
  return typeof window === "undefined" ? {} : window.__APP_CONFIG__ || {};
}

function normalizeSeasonNumber(value) {
  const safeSeason = Math.floor(Number(value));
  return Number.isFinite(safeSeason) && safeSeason >= 1 ? safeSeason : null;
}

export function getRankingApiUrl(path) {
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function getRankingProvider() {
  return String(getAppConfig().rankingProvider || "rest");
}

export function getFirebaseRuntimeConfig() {
  return getAppConfig().firebase || null;
}

export function getCurrentRankingSeason() {
  return normalizeSeasonNumber(getAppConfig().rankingSeasons?.currentSeason) || 1;
}

export function getAvailableRankingSeasons() {
  const configuredSeasons = Array.isArray(getAppConfig().rankingSeasons?.seasons)
    ? getAppConfig().rankingSeasons.seasons
    : [];

  const seasons = configuredSeasons
    .map((seasonConfig) => {
      const id = normalizeSeasonNumber(seasonConfig?.id);
      if (!id) {
        return null;
      }

      return {
        id,
        kind: String(seasonConfig?.kind || (id === 1 ? "preseason" : "season")),
        displayName: String(seasonConfig?.displayName || `Season ${id}`),
        status: String(seasonConfig?.status || (id === getCurrentRankingSeason() ? "current" : "archived")),
        period: String(seasonConfig?.period || ""),
        firebaseCollection: String(seasonConfig?.firebaseCollection || (id === 1 ? "rankings" : `rankings_season${id}`))
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.id - left.id);

  if (seasons.length) {
    return seasons;
  }

  return [{
    id: getCurrentRankingSeason(),
    kind: "season",
    displayName: `Season ${getCurrentRankingSeason()}`,
    status: "current",
    period: "",
    firebaseCollection: "rankings"
  }];
}

export function getRankingSeasonConfig(season = getCurrentRankingSeason()) {
  const safeSeason = normalizeSeasonNumber(season) || getCurrentRankingSeason();
  return getAvailableRankingSeasons().find((seasonConfig) => seasonConfig.id === safeSeason) || {
    id: safeSeason,
    kind: safeSeason === 1 ? "preseason" : "season",
    displayName: `Season ${safeSeason}`,
    status: safeSeason === getCurrentRankingSeason() ? "current" : "archived",
    period: "",
    firebaseCollection: safeSeason === 1 ? "rankings" : `rankings_season${safeSeason}`
  };
}

export function getRankingSeasonCollection(season = getCurrentRankingSeason()) {
  return getRankingSeasonConfig(season).firebaseCollection;
}

export function getAdminAccessConfig() {
  const config = getAppConfig().adminAccess || {};
  const allowedEmails = Array.isArray(config.allowedEmails)
    ? config.allowedEmails.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean)
    : [];

  return {
    requiresSignIn: config.requiresSignIn !== false,
    allowedEmails
  };
}

export function getAssetBaseUrl() {
  return typeof window === "undefined"
    ? ""
    : String(window.__APP_CONFIG__?.assetBaseUrl || "").replace(/\/$/, "");
}

export function getProcessedAssetBaseUrl() {
  return typeof window === "undefined"
    ? "/processed-assets"
    : String(window.__APP_CONFIG__?.processedAssetBaseUrl || "/processed-assets").replace(/\/$/, "");
}
