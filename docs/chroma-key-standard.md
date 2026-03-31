# Chroma Key Standard

현재 기준은 `브라우저 런타임 처리`가 아니라 `PNG 전처리 스크립트`로 크로마키를 먼저 적용하는 것이다.

## 기준값

- 대상 배경 힌트: `green-screen`
- 최소 녹색값: `100`
- 녹색 우세 비율: `green > max(red, blue) * 1.28`
- 완전 투명 기준 거리: `90`
- 알파 감소 배수: `3`

## 적용 대상

- `character/*.png`
- `item/*.png`
- `scene/5.png`

`scene/c.png` 같은 배경 이미지는 크로마키 대상이 아니다.

## 실행 방법

```bash
npm run chroma:key
```

실행 결과:

- `processed-assets/character/...`
- `processed-assets/item/...`
- `processed-assets/scene/5.png`
- `processed-assets/chroma-key-report.json`

## 수정 기준

- 녹색이 덜 지워지면 `dominanceRatio`를 낮추기 전에 `minGreen`을 먼저 본다.
- 머리카락이나 외곽선이 같이 날아가면 `fullTransparentDistance`를 높이거나 `fadeMultiplier`를 낮춘다.
- 새 스프라이트를 추가하면 `public/game/config/assets.js`에 넣어야 스크립트와 게임이 같이 인식한다.
