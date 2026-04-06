const rankingSeasons = Object.freeze({
  currentSeason: 2,
  seasons: Object.freeze([
    Object.freeze({
      id: 2,
      kind: "season",
      displayName: "시즌 1",
      status: "archived",
      period: "2026.04.01 ~ 2026.04.06",
      firebaseCollection: "rankings_season2"
    }),
    Object.freeze({
      id: 1,
      kind: "preseason",
      displayName: "시즌 0",
      status: "archived",
      period: "2026.03.31 ~ 2026.04.01",
      firebaseCollection: "rankings"
    })
  ])
});

const gameContent = Object.freeze({
  currentSeasonId: "s2",
  seasons: Object.freeze([
    Object.freeze({
      id: "s1",
      displayName: "시즌 1",
      notes: "Current live gameplay snapshot"
    }),
    Object.freeze({
      id: "s2",
      displayName: "시즌 2",
      notes: "Upcoming gameplay workspace"
    })
  ])
});

window.__APP_CONFIG__ = Object.freeze({
  rankingProvider: "firebase",
  rankingApiBaseUrl: `${window.location.protocol}//${window.location.hostname}:4000`,
  adminApiBaseUrl: `${window.location.protocol}//${window.location.hostname}:3000`,
  assetBaseUrl: "",
  processedAssetBaseUrl: "/processed-assets",
  rankingClosed: true,
  rankingClosureNotice: "\uC2DC\uBBAC\uB77C\uD06C DIS\uB294 \uC6D0\uC791 \uBC0F \uC6D0\uC791\uC790\uC758 \uAD8C\uB9AC\uB97C \uC874\uC911\uD569\uB2C8\uB2E4. \uAD00\uB828 \uAC00\uC774\uB4DC\uB77C\uC778\uC744 \uC900\uC218\uD558\uAE30 \uC704\uD574 \uC5C5\uB370\uC774\uD2B8 \uBC30\uD3EC\uB97C \uC911\uB2E8\uD558\uBA70, \uC2DC\uC98C 1 \uB7AD\uD0B9 \uC6B4\uC601 \uB610\uD55C \uD568\uAED8 \uC885\uB8CC\uB429\uB2C8\uB2E4. \uADF8\uB3D9\uC548 \uD568\uAED8\uD574\uC8FC\uC154\uC11C \uAC10\uC0AC\uD569\uB2C8\uB2E4.",
  rankingSeasons,
  gameContent,
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
