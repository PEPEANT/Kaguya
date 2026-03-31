# Firebase Ranking Prep

Current gameplay still uses the REST ranking server.

## Purpose

Prepare the client so ranking storage can switch from the local REST server to Firebase without rewriting game flow code.

## Current Prep State

- `public/app-config.js`
  - now exposes `rankingProvider`
  - includes a Firebase config placeholder object
- `public/game/ranking-service.js`
  - routes ranking calls through a provider layer
- `public/game/services/rest-ranking.js`
  - keeps the existing REST implementation
- `public/game/services/firebase-ranking.js`
  - is a safe placeholder for the upcoming Firebase implementation

## Recommended Firebase Direction

Use Firebase Auth anonymous sign-in first.

- Score ownership should be tied to `uid`, not nickname
- Nickname should stay as display-only profile data
- Best score should be stored once per `uid`
- Later, anonymous accounts can be linked to Google or other login providers

## Next Steps

1. Add Firebase Auth anonymous login on boot
2. Create a Firestore ranking collection keyed by `uid`
3. Replace the placeholder Firebase provider with real read/write logic
4. Add duplicate-account rules and security rules
5. Retire the local ranking server after migration is complete
