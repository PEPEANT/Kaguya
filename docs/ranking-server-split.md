# Ranking Server Split

현재 구조는 `앱 서버`와 `랭킹 서버`를 분리해서, 랭킹 서버만 따로 온라인 배포할 수 있게 만든 상태다.

## 서버 역할

- 앱 서버
  - 정적 페이지 제공
  - 원본 자산과 처리된 자산 제공
  - 프런트에 랭킹 서버 주소 주입
- 랭킹 서버
  - 랭킹 조회와 저장만 담당
  - CORS 허용으로 외부 앱 서버에서 접근 가능

## 로컬 실행

```bash
npm start
```

기본 포트:

- 앱 서버: `3000`
- 랭킹 서버: `4000`

정적 서버 테스트:

- 프로젝트 루트 기준 정적 서버를 띄우고 `http://127.0.0.1:5500/public/index.html`로 열어도 된다.
- 이 경우에도 랭킹 서버는 `4000` 포트로 따로 켜져 있어야 한다.

## 단독 실행

```bash
npm run start:app
npm run start:ranking
```

## 환경 변수

- `APP_PORT`
  - 로컬 앱 서버 포트
- `RANKING_PORT`
  - 로컬 랭킹 서버 포트
- `RANKING_API_BASE_URL`
  - 앱 서버가 프런트에 알려줄 랭킹 서버 주소
  - 예: `https://my-ranking.example.com`
- `RANKING_CORS_ORIGIN`
  - 랭킹 서버 CORS 허용 출처
  - 기본값: `*`

## 배포 기준

1. 앱 서버는 게임 화면만 배포한다.
2. 랭킹 서버는 별도 주소로 배포한다.
3. 앱 서버 환경 변수 `RANKING_API_BASE_URL`을 랭킹 서버 주소로 맞춘다.
4. 필요하면 랭킹 서버 `RANKING_CORS_ORIGIN`을 앱 도메인으로 제한한다.
