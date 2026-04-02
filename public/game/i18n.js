const TRANSLATIONS = {
  ko: {
    "app.title": "카구야 스낵 러쉬",
    "app.brand": "카구야",
    "app.name": "스낵 러쉬",
    "canvas.aria": "카구야 스낵 러쉬 게임 화면",

    "orientation.eyebrow": "가로 모드",
    "orientation.title": "기기를 가로로 돌려주세요",
    "orientation.body": "모바일에서는 가로 화면에서만 플레이할 수 있습니다.",

    "intro.prompt": "게스트로 바로 시작하거나 로그인해 기록을 연결해보세요",
    "intro.guestStart": "게스트로 시작",
    "intro.enterLobby": "로비로 이동",
    "lobby.lead": "하늘에서 떨어지는 간식을 먹고 트랩을 피해서 최고 점수를 노려보세요.",
    "lobby.nickname": "닉네임",
    "lobby.start": "게임 시작",
    "lobby.enter": "입장하기",
    "lobby.defaultNickname": "플레이어",
    "lobby.rankLabel": "순위",
    "lobby.mobileGuide": "아이템",
    "lobby.mobileRanking": "랭킹",
    "lobby.mobileBack": "뒤로가기",
    "auth.login": "로그인",
    "auth.signup": "회원가입",
    "auth.logout": "로그아웃",
    "auth.optionalHint": "게스트로 먼저 플레이하고, 나중에 로그인해서 기록을 연결할 수 있어요.",
    "auth.guestBadge": "게스트",
    "auth.memberBadge": "계정 연결됨",
    "auth.guestTitle": "게스트로 플레이 중",
    "auth.guestDescription": "지금은 게스트로 플레이 중입니다. 로그인하면 이후 시즌 기록을 계정과 함께 저장할 수 있어요.",
    "auth.loginTitle": "로그인",
    "auth.signupTitle": "회원가입",
    "auth.email": "이메일",
    "auth.nickname": "닉네임",
    "auth.password": "비밀번호",
    "auth.passwordConfirm": "비밀번호 확인",
    "auth.loginSubmit": "로그인",
    "auth.signupSubmit": "회원가입",
    "auth.loggingIn": "로그인 중...",
    "auth.signingUp": "가입 중...",
    "auth.resetPassword": "비밀번호 찾기",
    "auth.resetPasswordHint": "가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드려요.",
    "profile.open": "내 정보",
    "profile.title": "내 정보",
    "profile.linkedBadge": "연결된 계정",
    "profile.currentSeasonRecordTitle": "현재 시즌 기록",
    "profile.currentSeasonBody": "지금 진행 중인 시즌의 최고 기록입니다.",
    "profile.currentSeasonNoRecord": "아직 현재 시즌에 저장된 내 기록이 없어요.",
    "profile.season1RecordTitle": "시즌1 내 기록",
    "profile.season1Top10Title": "시즌1 Top 10",
    "profile.season1Top10Body": "종료된 시즌의 최종 Top 10 기록입니다.",
    "profile.noRecord": "이 브라우저에 연결된 시즌1 기록을 아직 찾지 못했어요.",
    "profile.unavailable": "기록을 아직 불러오지 못했어요.",
    "profile.recordScore": "최고 점수",
    "profile.recordRank": "최종 순위",

    "preview.round1.badge": "라운드 1",
    "preview.round1.title": "천천히 시작",
    "preview.round1.desc": "초보자도 바로 적응할 수 있게 부드럽게 시작합니다.",
    "preview.round2.badge": "라운드 2",
    "preview.round2.title": "속도 상승",
    "preview.round2.desc": "떨어지는 속도와 횡이동이 눈에 띄게 빨라집니다.",
    "preview.round3.badge": "라운드 3",
    "preview.round3.title": "랭킹 승부",
    "preview.round3.desc": "실수 없이 받아내야 점수가 빠르게 오릅니다.",
    "preview.round4.badge": "라운드 4",
    "preview.round4.title": "달빛 폭주",
    "preview.round4.desc": "마지막 20초, 속도와 밀도가 한꺼번에 몰아칩니다.",

    "guide.title": "아이템",
    "guide.lead": "간식을 먹고, 트랩은 피하세요.",
    "guide.group.iroha": "이로하",
    "guide.group.snack": "간식",
    "guide.group.special": "특수",
    "guide.group.trap": "트랩",

    "item.iroha": "이로하",
    "item.iroha.points": "+50",
    "item.snack1": "딸기 케이크",
    "item.snack2": "딸기 팬케이크",
    "item.snack3": "볶음밥",
    "item.snack4": "블루 소다",
    "item.snack5": "오무라이스",
    "item.special1": "보름달",
    "item.special1.effect": "+20초",
    "item.heal1": "야치요 인형",
    "item.heal1.effect": "+1HP",
    "item.danger1": "달나라 요원",
    "item.danger2": "물만 탄 팬케이크",
    "item.danger3": "미카도",

    "ranking.title": "실시간 랭킹",
    "ranking.refresh": "새로고침",
    "ranking.viewAll": "전체 보기",
    "ranking.allTitle": "전체 랭킹",
    "ranking.close": "닫기",
    "ranking.currentSeasonBadge": "시즌 2",
    "ranking.season1Label": "시즌 1",
    "ranking.season2Label": "시즌 2",
    "ranking.seasonLive": "진행 중",
    "ranking.seasonEnded": "종료",
    "ranking.season1ArchiveTitle": "시즌 1 기록",
    "ranking.season1ArchivePeriod": "2025.03 — 2025.06",
    "ranking.season1ArchiveBody": "종료된 시즌의 최종 기록입니다.",
    "ranking.loading": "불러오는 중...",
    "ranking.expandAll": "11위부터 전체 보기",
    "ranking.collapseAll": "Top 10만 보기",
    "ranking.saved": "새 최고기록 저장",
    "ranking.kept": "기존 최고기록 유지",
    "ranking.best": "실시간 랭킹",
    "ranking.empty": "기록 없음",
    "ranking.failed": "불러오기 실패",
    "ranking.norecords": "아직 등록된 기록이 없습니다.",
    "ranking.pts": "점",

    "result.eyebrow": "결과",
    "result.title": "게임 종료",
    "result.score": "점수",
    "result.rank": "랭킹",
    "result.restart": "다시 시작",
    "result.lobby": "로비",
    "result.saving": "저장 중",
    "result.fail": "저장 실패",
    "result.newBest": "새 최고기록",
    "result.rankOne": "랭킹 1위",
    "result.newBestTop": "새 최고기록 / 랭킹 1위",

    "mobile.left": "<",
    "mobile.right": ">",
    "mobile.jump": "^",
    "audio.on": "음악 켜기",
    "audio.off": "음악 끄기",

    "boot.loading.title": "카구야 스낵 러쉬",
    "boot.loading.button": "로딩 중",
    "boot.ready.title": "카구야 스낵 러쉬",
    "boot.ready.button": "게임 시작",
    "boot.error.title": "불러오기 실패",
    "boot.error.button": "오류",
    "boot.error.status": "게임 데이터를 불러오지 못했습니다.",

    "hud.score": "점수",
    "hud.time": "남은 시간",
    "hud.seconds": "초",

    "round.1.label": "라운드 1",
    "round.2.label": "라운드 2",
    "round.3.label": "라운드 3",
    "round.4.label": "라운드 4",
    "round.1.transition": "천천히 시작",
    "round.2.transition": "속도 상승",
    "round.3.transition": "고수 영역",
    "round.4.transition": "최종 폭주"
  },

  en: {
    "app.title": "Kaguya Snack Rush",
    "app.brand": "Kaguya",
    "app.name": "Snack Rush",
    "canvas.aria": "Kaguya Snack Rush game screen",

    "orientation.eyebrow": "Landscape",
    "orientation.title": "Rotate Your Device",
    "orientation.body": "On mobile, the game only plays in landscape mode.",

    "intro.prompt": "Jump in as a guest now, or sign up to keep your records.",
    "intro.guestStart": "Start as Guest",
    "intro.enterLobby": "Enter Lobby",
    "lobby.lead": "Catch falling snacks, avoid traps, and chase the highest score.",
    "lobby.nickname": "Nickname",
    "lobby.start": "Start Game",
    "lobby.enter": "Enter",
    "lobby.rankLabel": "Rank",
    "lobby.defaultNickname": "Player",
    "lobby.mobileGuide": "Items",
    "lobby.mobileRanking": "Ranking",
    "lobby.mobileBack": "Back",
    "auth.login": "Log In",
    "auth.signup": "Sign Up",
    "auth.logout": "Log Out",
    "auth.optionalHint": "Play as a guest first, then sign in later to connect your records.",
    "auth.guestBadge": "Guest",
    "auth.memberBadge": "Linked",
    "auth.guestTitle": "Playing as Guest",
    "auth.guestDescription": "You are currently playing as a guest. Sign in to keep future season records on your account.",
    "auth.loginTitle": "Log In",
    "auth.signupTitle": "Create Account",
    "auth.email": "Email",
    "auth.nickname": "Nickname",
    "auth.password": "Password",
    "auth.passwordConfirm": "Confirm Password",
    "auth.loginSubmit": "Log In",
    "auth.signupSubmit": "Create Account",
    "auth.loggingIn": "Signing in...",
    "auth.signingUp": "Creating account...",
    "auth.resetPassword": "Forgot Password",
    "auth.resetPasswordHint": "Enter the email you signed up with and we will send a password reset link.",
    "profile.open": "My Info",
    "profile.title": "My Info",
    "profile.linkedBadge": "Linked Account",
    "profile.currentSeasonRecordTitle": "Current Season Record",
    "profile.currentSeasonBody": "This is your best record for the live season.",
    "profile.currentSeasonNoRecord": "You do not have a saved record for the current season yet.",
    "profile.season1RecordTitle": "My Season 1 Record",
    "profile.season1Top10Title": "Season 1 Top 10",
    "profile.season1Top10Body": "These are the final Top 10 standings from the finished season.",
    "profile.noRecord": "No Season 1 record linked to this browser was found yet.",
    "profile.unavailable": "This record could not be loaded yet.",
    "profile.recordScore": "Best Score",
    "profile.recordRank": "Final Rank",

    "preview.round1.badge": "Round 1",
    "preview.round1.title": "Slow Start",
    "preview.round1.desc": "A gentle opening that beginners can follow.",
    "preview.round2.badge": "Round 2",
    "preview.round2.title": "Pace Up",
    "preview.round2.desc": "Faster drops and wider sway start to matter.",
    "preview.round3.badge": "Round 3",
    "preview.round3.title": "Ranking Match",
    "preview.round3.desc": "Clean movement starts to separate the leaderboard.",
    "preview.round4.badge": "Round 4",
    "preview.round4.title": "Moonlit Rush",
    "preview.round4.desc": "The final 20 seconds get crowded, fast, and unforgiving.",

    "guide.title": "Items",
    "guide.lead": "Grab snacks and avoid traps.",
    "guide.group.iroha": "Iroha",
    "guide.group.snack": "Snacks",
    "guide.group.special": "Special",
    "guide.group.trap": "Traps",

    "item.iroha": "Iroha",
    "item.iroha.points": "+50",
    "item.snack1": "Strawberry Cake",
    "item.snack2": "Strawberry Pancake",
    "item.snack3": "Fried Rice",
    "item.snack4": "Blue Soda",
    "item.snack5": "Omurice",
    "item.special1": "Full Moon",
    "item.special1.effect": "+20s",
    "item.heal1": "Yachiyo Doll",
    "item.heal1.effect": "+1HP",
    "item.danger1": "Moon Agent",
    "item.danger2": "Watery Pancake",
    "item.danger3": "Mikado",

    "ranking.title": "Live Ranking",
    "ranking.refresh": "Refresh",
    "ranking.viewAll": "View All",
    "ranking.allTitle": "All Rankings",
    "ranking.close": "Close",
    "ranking.currentSeasonBadge": "Season 2",
    "ranking.season1Label": "Season 1",
    "ranking.season2Label": "Season 2",
    "ranking.seasonLive": "Live",
    "ranking.seasonEnded": "Ended",
    "ranking.season1ArchiveTitle": "Season 1 Records",
    "ranking.season1ArchivePeriod": "Mar — Jun 2025",
    "ranking.season1ArchiveBody": "These are the final standings from the finished season.",
    "ranking.loading": "Loading...",
    "ranking.expandAll": "Show 11+",
    "ranking.collapseAll": "Top 10 Only",
    "ranking.saved": "New best saved",
    "ranking.kept": "Previous best kept",
    "ranking.best": "Live ranking",
    "ranking.empty": "No records",
    "ranking.failed": "Failed to load",
    "ranking.norecords": "No records yet.",
    "ranking.pts": " pts",

    "result.eyebrow": "Result",
    "result.title": "Game Over",
    "result.score": "Score",
    "result.rank": "Rank",
    "result.restart": "Restart",
    "result.lobby": "Lobby",
    "result.saving": "Saving",
    "result.fail": "Save Failed",
    "result.newBest": "New Best Record",
    "result.rankOne": "Rank #1",
    "result.newBestTop": "New Best / Rank #1",

    "mobile.left": "<",
    "mobile.right": ">",
    "mobile.jump": "^",
    "audio.on": "Music On",
    "audio.off": "Music Off",

    "boot.loading.title": "Kaguya Snack Rush",
    "boot.loading.button": "Loading",
    "boot.ready.title": "Kaguya Snack Rush",
    "boot.ready.button": "Start Game",
    "boot.error.title": "Load Failed",
    "boot.error.button": "Error",
    "boot.error.status": "Failed to load game data.",

    "hud.score": "Score",
    "hud.time": "Time Left",
    "hud.seconds": "s",

    "round.1.label": "Round 1",
    "round.2.label": "Round 2",
    "round.3.label": "Round 3",
    "round.4.label": "Round 4",
    "round.1.transition": "Slow Start",
    "round.2.transition": "Pace Up",
    "round.3.transition": "Expert Zone",
    "round.4.transition": "Final Rush"
  },

  ja: {
    "app.title": "かぐや スナックラッシュ",
    "app.brand": "かぐや",
    "app.name": "スナックラッシュ",
    "canvas.aria": "かぐや スナックラッシュのゲーム画面",

    "orientation.eyebrow": "横画面",
    "orientation.title": "端末を横向きにしてください",
    "orientation.body": "モバイルでは横画面でのみプレイできます。",

    "intro.prompt": "まずはゲストで遊ぶか、ログインして記録をつなげましょう。",
    "intro.guestStart": "ゲストで始める",
    "intro.enterLobby": "ロビーへ",
    "lobby.lead": "空から落ちるおやつを集めて、トラップを避けながらハイスコアを目指しましょう。",
    "lobby.nickname": "ニックネーム",
    "lobby.start": "ゲーム開始",
    "lobby.enter": "入場する",
    "lobby.rankLabel": "順位",
    "lobby.defaultNickname": "プレイヤー",
    "lobby.mobileGuide": "アイテム",
    "lobby.mobileRanking": "ランキング",
    "lobby.mobileBack": "戻る",
    "auth.login": "ログイン",
    "auth.signup": "会員登録",
    "auth.logout": "ログアウト",
    "auth.optionalHint": "まずはゲストで遊んで、あとからログインして記録を連携できます。",
    "auth.guestBadge": "ゲスト",
    "auth.memberBadge": "連携済み",
    "auth.guestTitle": "ゲストでプレイ中",
    "auth.guestDescription": "今はゲストとしてプレイ中です。ログインすると今後のシーズン記録をアカウントに保存できます。",
    "auth.loginTitle": "ログイン",
    "auth.signupTitle": "会員登録",
    "auth.email": "メールアドレス",
    "auth.nickname": "ニックネーム",
    "auth.password": "パスワード",
    "auth.passwordConfirm": "パスワード確認",
    "auth.loginSubmit": "ログイン",
    "auth.signupSubmit": "会員登録",
    "auth.loggingIn": "ログイン中...",
    "auth.signingUp": "登録中...",
    "auth.resetPassword": "パスワードを忘れた",
    "auth.resetPasswordHint": "登録したメールアドレスを入力すると、パスワード再設定リンクを送信します。",
    "profile.open": "マイ情報",
    "profile.title": "マイ情報",
    "profile.linkedBadge": "連携済みアカウント",
    "profile.currentSeasonRecordTitle": "現在シーズンの記録",
    "profile.currentSeasonBody": "進行中シーズンでの最高記録です。",
    "profile.currentSeasonNoRecord": "現在シーズンに保存された自分の記録はまだありません。",
    "profile.season1RecordTitle": "シーズン1の自分の記録",
    "profile.season1Top10Title": "シーズン1 Top 10",
    "profile.season1Top10Body": "終了したシーズンの最終 Top 10 記録です。",
    "profile.noRecord": "このブラウザに連携されたシーズン1記録はまだ見つかっていません。",
    "profile.unavailable": "この記録はまだ読み込めていません。",
    "profile.recordScore": "最高スコア",
    "profile.recordRank": "最終順位",

    "preview.round1.badge": "Round 1",
    "preview.round1.title": "ゆっくりスタート",
    "preview.round1.desc": "初心者でも入りやすい穏やかな立ち上がりです。",
    "preview.round2.badge": "Round 2",
    "preview.round2.title": "スピードアップ",
    "preview.round2.desc": "落下速度と横揺れが一気に強くなります。",
    "preview.round3.badge": "Round 3",
    "preview.round3.title": "ランキング勝負",
    "preview.round3.desc": "きれいな移動がそのままスコア差になります。",
    "preview.round4.badge": "Round 4",
    "preview.round4.title": "月夜のラッシュ",
    "preview.round4.desc": "最後の20秒は速く、密度も高く、かなり厳しくなります。",

    "guide.title": "アイテム",
    "guide.lead": "おやつを取り、トラップを避けましょう。",
    "guide.group.iroha": "いろは",
    "guide.group.snack": "おやつ",
    "guide.group.special": "スペシャル",
    "guide.group.trap": "トラップ",

    "item.iroha": "いろは",
    "item.iroha.points": "+50",
    "item.snack1": "いちごケーキ",
    "item.snack2": "いちごパンケーキ",
    "item.snack3": "チャーハン",
    "item.snack4": "ブルーソーダ",
    "item.snack5": "オムライス",
    "item.special1": "満月",
    "item.special1.effect": "+20s",
    "item.heal1": "やちよ人形",
    "item.heal1.effect": "+1HP",
    "item.danger1": "月のエージェント",
    "item.danger2": "水っぽいパンケーキ",
    "item.danger3": "ミカド",

    "ranking.title": "ランキング",
    "ranking.refresh": "更新",
    "ranking.viewAll": "全て見る",
    "ranking.allTitle": "全ランキング",
    "ranking.close": "閉じる",
    "ranking.currentSeasonBadge": "シーズン2",
    "ranking.season1Label": "シーズン1",
    "ranking.season2Label": "シーズン2",
    "ranking.seasonLive": "開催中",
    "ranking.seasonEnded": "終了",
    "ranking.season1ArchiveTitle": "シーズン1の記録",
    "ranking.season1ArchivePeriod": "2025.03 — 2025.06",
    "ranking.season1ArchiveBody": "終了したシーズンの最終記録です。",
    "ranking.loading": "読み込み中...",
    "ranking.expandAll": "11位からすべて表示",
    "ranking.collapseAll": "Top 10のみ表示",
    "ranking.saved": "新しいベストを保存しました",
    "ranking.kept": "以前のベストを維持しました",
    "ranking.best": "ランキング",
    "ranking.empty": "記録なし",
    "ranking.failed": "読み込み失敗",
    "ranking.norecords": "まだ記録がありません。",
    "ranking.pts": " pts",

    "result.eyebrow": "結果",
    "result.title": "ゲーム終了",
    "result.score": "スコア",
    "result.rank": "順位",
    "result.restart": "もう一度",
    "result.lobby": "ロビー",
    "result.saving": "保存中",
    "result.fail": "保存失敗",
    "result.newBest": "新記録",
    "result.rankOne": "1位",
    "result.newBestTop": "新記録 / 1位",

    "mobile.left": "<",
    "mobile.right": ">",
    "mobile.jump": "^",
    "audio.on": "音楽オン",
    "audio.off": "音楽オフ",

    "boot.loading.title": "かぐや スナックラッシュ",
    "boot.loading.button": "読み込み中",
    "boot.ready.title": "かぐや スナックラッシュ",
    "boot.ready.button": "ゲーム開始",
    "boot.error.title": "読み込み失敗",
    "boot.error.button": "エラー",
    "boot.error.status": "ゲームデータを読み込めませんでした。",

    "hud.score": "スコア",
    "hud.time": "残り時間",
    "hud.seconds": "秒",

    "round.1.label": "Round 1",
    "round.2.label": "Round 2",
    "round.3.label": "Round 3",
    "round.4.label": "Round 4",
    "round.1.transition": "ゆっくりスタート",
    "round.2.transition": "スピードアップ",
    "round.3.transition": "上級者ゾーン",
    "round.4.transition": "最終ラッシュ"
  }
};

Object.assign(TRANSLATIONS.ko, {
  "auth.resetPasswordHint": "이메일은 비밀번호 찾기할 때만 쓰여요. 가입한 이메일로 비밀번호 재설정 링크를 보내드려요.",
  "ranking.currentSeasonBadge": "시즌 1",
  "ranking.season1Label": "프리시즌",
  "ranking.season2Label": "시즌 1",
  "ranking.season1ArchiveTitle": "프리시즌 기록",
  "ranking.season1ArchivePeriod": "2026.03.31",
  "ranking.season1ArchiveBody": "오픈 기념 프리시즌의 최종 기록입니다.",
  "profile.season1RecordTitle": "프리시즌 내 기록",
  "profile.season1Top10Title": "프리시즌 Top 10",
  "profile.season1Top10Body": "프리시즌 최종 Top 10 기록입니다.",
  "profile.editNickname": "닉네임 수정",
  "profile.nicknameField": "현재 닉네임",
  "profile.nicknameHint": "프로필 닉네임은 바로 바뀌고, 랭킹 표시는 다음 점수 저장부터 반영돼요.",
  "profile.saveNickname": "저장",
  "profile.cancelNicknameEdit": "취소"
});

Object.assign(TRANSLATIONS.en, {
  "auth.resetPasswordHint": "Your email is only used when you need to recover your password. We will send a reset link to the email you signed up with.",
  "ranking.currentSeasonBadge": "Season 1",
  "ranking.season1Label": "Preseason",
  "ranking.season2Label": "Season 1",
  "ranking.season1ArchiveTitle": "Preseason Records",
  "ranking.season1ArchivePeriod": "2026.03.31",
  "ranking.season1ArchiveBody": "These are the final standings from the opening preseason.",
  "profile.season1RecordTitle": "My Preseason Record",
  "profile.season1Top10Title": "Preseason Top 10",
  "profile.season1Top10Body": "These are the final Top 10 standings from the preseason.",
  "profile.editNickname": "Edit Nickname",
  "profile.nicknameField": "Current Nickname",
  "profile.nicknameHint": "Your profile nickname updates right away, and ranking names change the next time you save a score.",
  "profile.saveNickname": "Save",
  "profile.cancelNicknameEdit": "Cancel"
});

Object.assign(TRANSLATIONS.ja, {
  "auth.resetPasswordHint": "メールアドレスはパスワードを忘れたときにだけ使います。登録したメールアドレスに再設定リンクを送信します。",
  "ranking.currentSeasonBadge": "シーズン1",
  "ranking.season1Label": "プレシーズン",
  "ranking.season2Label": "シーズン1",
  "ranking.season1ArchiveTitle": "プレシーズン記録",
  "ranking.season1ArchivePeriod": "2026.03.31",
  "ranking.season1ArchiveBody": "オープン記念プレシーズンの最終記録です。",
  "profile.season1RecordTitle": "プレシーズンの自分の記録",
  "profile.season1Top10Title": "プレシーズン Top 10",
  "profile.season1Top10Body": "プレシーズン最終 Top 10 記録です。",
  "profile.editNickname": "ニックネーム変更",
  "profile.nicknameField": "現在のニックネーム",
  "profile.nicknameHint": "プロフィールのニックネームはすぐ変わり、ランキング表示は次にスコアを保存したときから反映されます。",
  "profile.saveNickname": "保存",
  "profile.cancelNicknameEdit": "キャンセル"
});

const storage = typeof localStorage !== "undefined" ? localStorage : null;
let currentLang = storage?.getItem("lang") || "ko";

export function t(key) {
  return TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!TRANSLATIONS[lang]) {
    return;
  }

  currentLang = lang;
  storage?.setItem("lang", lang);

  if (typeof document !== "undefined") {
    document.documentElement.lang = lang;
    applyTranslations();
  }

  if (typeof window !== "undefined" && typeof CustomEvent !== "undefined") {
    window.dispatchEvent(new CustomEvent("langchange", { detail: { lang } }));
  }
}

function applyTranslations() {
  for (const element of document.querySelectorAll("[data-i18n]")) {
    const key = element.dataset.i18n;
    const attr = element.dataset.i18nAttr;

    if (attr) {
      element.setAttribute(attr, t(key));
      continue;
    }

    element.textContent = t(key);
  }

  for (const button of document.querySelectorAll(".lang-btn")) {
    button.classList.toggle("lang-btn--active", button.dataset.lang === currentLang);
  }
}

export function initI18n() {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.lang = currentLang;
  applyTranslations();

  for (const button of document.querySelectorAll(".lang-btn")) {
    button.addEventListener("click", () => setLang(button.dataset.lang));
  }
}
