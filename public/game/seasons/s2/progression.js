const SCORE_STAGE_FADE_DURATION = 2.8;

// Placeholder copy of s1 values. Safe starting point for season 2 tuning.
export const ROUND_DEFINITIONS = [
  {
    round: 1,
    startsAt: 0,
    labelKey: "round.1.label",
    transitionKey: "round.1.transition",
    backgroundKey: "backgroundRound1",
    bonusTime: 0,
    transitionDuration: SCORE_STAGE_FADE_DURATION,
    speedMin: 112,
    speedMax: 202,
    speedVariance: 12,
    driftMin: -14,
    driftMax: 14,
    spawnMin: 0.94,
    spawnMax: 1.28,
    maxActiveItems: 4
  },
  {
    round: 2,
    startsAt: 25,
    labelKey: "round.2.label",
    transitionKey: "round.2.transition",
    backgroundKey: "backgroundRound2",
    bonusTime: 5,
    transitionDuration: SCORE_STAGE_FADE_DURATION,
    speedMin: 184,
    speedMax: 306,
    speedVariance: 16,
    driftMin: -28,
    driftMax: 28,
    spawnMin: 0.62,
    spawnMax: 0.92,
    maxActiveItems: 5
  },
  {
    round: 3,
    startsAt: 50,
    labelKey: "round.3.label",
    transitionKey: "round.3.transition",
    backgroundKey: "backgroundRound3",
    bonusTime: 6,
    transitionDuration: SCORE_STAGE_FADE_DURATION,
    speedMin: 278,
    speedMax: 372,
    speedVariance: 18,
    driftMin: -34,
    driftMax: 34,
    spawnMin: 0.42,
    spawnMax: 0.66,
    maxActiveItems: 6
  },
  {
    round: 4,
    startsAt: 70,
    labelKey: "round.4.label",
    transitionKey: "round.4.transition",
    backgroundKey: "backgroundRound4",
    bonusTime: 8,
    transitionDuration: SCORE_STAGE_FADE_DURATION,
    speedMin: 334,
    speedMax: 462,
    speedVariance: 22,
    driftMin: -46,
    driftMax: 46,
    spawnMin: 0.34,
    spawnMax: 0.52,
    maxActiveItems: 7
  }
];

export const BACKGROUND_SCORE_STAGES = [
  { minScore: 5200, backgroundKey: "backgroundRound5", bonusTime: 8, transitionDuration: SCORE_STAGE_FADE_DURATION },
  { minScore: 8000, backgroundKey: "backgroundRound5", bonusTime: 10, transitionDuration: SCORE_STAGE_FADE_DURATION },
  { minScore: 10000, backgroundKey: "backgroundRound6", bonusTime: 0, transitionDuration: SCORE_STAGE_FADE_DURATION }
];
