const rankingSeasons = Object.freeze({
  currentSeason: 2,
  seasons: Object.freeze([
    Object.freeze({
      id: 2,
      kind: "season",
      displayName: "시즌 1",
      status: "current",
      period: "2026.04.01 - 2026.05.01",
      firebaseCollection: "rankings_season2"
    }),
    Object.freeze({
      id: 1,
      kind: "preseason",
      displayName: "프리시즌",
      status: "archived",
      period: "2026.03.31",
      firebaseCollection: "rankings"
    })
  ])
});

window.__APP_CONFIG__ = Object.freeze({
  rankingProvider: "firebase",
  rankingApiBaseUrl: `${window.location.protocol}//${window.location.hostname}:4000`,
  assetBaseUrl: "",
  processedAssetBaseUrl: "/processed-assets",
  rankingSeasons,
  adminAccess: Object.freeze({
    requiresSignIn: true,
    allowedEmails: Object.freeze([])
  }),
  firebase: {
    apiKey: "AIzaSyCVk-H_DkZfbo_KaEg9C3Kq1ij4ziHmW6M",
    authDomain: "kaguya-snack-rush.firebaseapp.com",
    projectId: "kaguya-snack-rush",
    storageBucket: "kaguya-snack-rush.firebasestorage.app",
    messagingSenderId: "594120586215",
    appId: "1:594120586215:web:c7e8a99519d6b4335e0342",
    measurementId: "G-GRSREBV6S9"
  }
});
