const baseUrl = typeof window === "undefined"
  ? ""
  : String(window.__APP_CONFIG__?.rankingApiBaseUrl || "").replace(/\/$/, "");

function getAppConfig() {
  return typeof window === "undefined" ? {} : window.__APP_CONFIG__ || {};
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
