# System Structure

현재 기준은 `설정`, `전처리`, `프런트엔드`, `앱 서버`, `랭킹 서버`, `데이터`를 분리해서 수정 범위를 좁히는 것이다.

## 목적

- 게임 규칙 수정과 서버 수정이 서로 덜 얽히게 만든다.
- 크로마키 기준이 코드 안에 흩어지지 않게 한다.
- 랭킹 서버만 따로 온라인 배포할 수 있게 만든다.

## 자산 분류 기준

- `scene/`
  - 원본 장면 이미지
  - 현재: `c.png`, `c2.png`, `5.png`
- `character/`
  - 플레이어 상태별 원본 스프라이트
- `item/`
  - 떨어지는 아이템 원본 스프라이트
- `processed-assets/`
  - 크로마키 전처리 후 생성되는 결과물
  - 직접 수정하지 않고 스크립트로 다시 만든다

## 설정과 전처리

- `config/chroma-key.config.mjs`
  - 크로마키 기준값 단일 소스
- `scripts/chroma-key.mjs`
  - PNG 전처리 스크립트
  - `processed-assets/` 생성
- `public/game/config/assets.js`
  - 게임에서 쓰는 자산 목록과 크로마키 적용 여부
- `public/game/config/progression.js`
  - 라운드 전환 시점과 배경, 스폰 속도, 낙하 속도 기준

## 프런트엔드 분류 기준

- `public/index.html`
  - `public/` 안에 유지한다
  - CSS, JS는 상대 경로로 연결해서 정적 서버와 앱 서버 둘 다 대응한다
- `public/game.js`
  - 진입점
- `public/game/config/runtime.js`
  - 랭킹 서버 주소 같은 런타임 설정 읽기
- `public/game/assets.js`
  - 처리된 자산 로드
- `public/game/logic.js`
  - 게임 규칙과 랭킹 요청
- `public/game/render.js`
  - 캔버스 렌더링
- `public/game/ui.js`
  - DOM UI 출력

## 서버 분류 기준

- `servers/app-server.mjs`
  - 게임 화면, 원본 자산, 처리된 자산, 런타임 설정 제공
- `servers/ranking-server.mjs`
  - `/api/rankings` 전용 서버
  - CORS 허용으로 외부 앱 서버 연결 가능
- `server.mjs`
  - 로컬 개발용 통합 시작점
  - 앱 서버와 랭킹 서버를 같이 띄움

## 데이터 분류 기준

- `data/rankings.json`
  - 랭킹 저장 데이터
- `processed-assets/chroma-key-report.json`
  - 최근 크로마키 전처리 보고서

## 수정할 때 기준

- 자산 파일이 바뀌면 먼저 `public/game/config/assets.js`와 `scripts/chroma-key.mjs` 흐름을 본다.
- 크로마키 기준을 바꾸면 `config/chroma-key.config.mjs`만 수정한다.
- 온라인 랭킹 주소를 바꾸면 앱 서버의 `RANKING_API_BASE_URL` 환경 변수를 사용한다.
- 랭킹 규칙을 바꾸면 `servers/shared/rankings-store.mjs`를 먼저 수정한다.
