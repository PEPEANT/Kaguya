export const FINAL_BOSS_PREP_CONFIG = Object.freeze({
  enabled: true,
  scoreThreshold: 10000,
  bonusTime: 15,
  minimumTimeLeft: 60,
  backgroundKey: "backgroundRound6",
  labelKey: "round.5.label",
  transitionKey: "round.5.transition",
  musicTrackKey: "bossPrep",
  backgroundFadeDuration: 5.5,
  difficultyRampDuration: 28,
  presentation: Object.freeze({
    rampDuration: 1.8,
    worldScale: 0.92,
    playerScale: 0.84,
    itemCollisionScale: 0.94,
    movementSpeedMultiplier: 1.2
  }),
  spawnDistribution: Object.freeze({
    balanceDangerItems: true,
    laneCount: 5,
    recentMemory: 4,
    laneJitter: 0.22
  }),
  effects: Object.freeze({
    moonMask: Object.freeze({
      centerX: 0.06,
      centerY: 0.1,
      radius: 0.21,
      color: Object.freeze([65, 42, 56]),
      bandColor: Object.freeze([40, 25, 38]),
      highlightColor: Object.freeze([255, 183, 121])
    }),
    cueEvents: Object.freeze([
      Object.freeze({
        id: "flash-25",
        time: 25,
        flash: Object.freeze({
          duration: 0.42,
          intensity: 0.62,
          color: Object.freeze([255, 244, 214])
        })
      }),
      Object.freeze({
        id: "flash-28",
        time: 28,
        flash: Object.freeze({
          duration: 0.54,
          intensity: 0.78,
          color: Object.freeze([255, 236, 196])
        })
      }),
      Object.freeze({
        id: "highlight-35",
        time: 35,
        flash: Object.freeze({
          duration: 0.95,
          intensity: 0.98,
          color: Object.freeze([255, 232, 180])
        }),
        particles: Object.freeze({
          count: 28,
          durationMin: 1.15,
          durationMax: 2.15,
          originX: 0.52,
          originY: 0.25,
          spreadX: 0.3,
          spreadY: 0.14,
          speedX: 150,
          speedYMin: 70,
          speedYMax: 220,
          sizeMin: 8,
          sizeMax: 20,
          colors: Object.freeze([
            Object.freeze([255, 238, 194]),
            Object.freeze([255, 206, 133]),
            Object.freeze([255, 249, 232]),
            Object.freeze([255, 156, 96])
          ])
        })
      }),
      Object.freeze({
        id: "highlight-46",
        time: 46,
        flash: Object.freeze({
          duration: 0.88,
          intensity: 0.92,
          color: Object.freeze([255, 228, 174])
        }),
        particles: Object.freeze({
          count: 26,
          durationMin: 1.25,
          durationMax: 2.3,
          originX: 0.48,
          originY: 0.24,
          spreadX: 0.32,
          spreadY: 0.16,
          speedX: 165,
          speedYMin: 80,
          speedYMax: 230,
          sizeMin: 9,
          sizeMax: 22,
          colors: Object.freeze([
            Object.freeze([255, 243, 216]),
            Object.freeze([255, 205, 139]),
            Object.freeze([255, 248, 233]),
            Object.freeze([255, 163, 104])
          ])
        })
      }),
      Object.freeze({
        id: "big-particles-58",
        time: 58,
        particles: Object.freeze({
          count: 16,
          durationMin: 1.8,
          durationMax: 3.2,
          originX: 0.5,
          originY: 0.22,
          spreadX: 0.34,
          spreadY: 0.16,
          speedX: 190,
          speedYMin: 90,
          speedYMax: 240,
          sizeMin: 22,
          sizeMax: 48,
          colors: Object.freeze([
            Object.freeze([255, 247, 224]),
            Object.freeze([255, 214, 148]),
            Object.freeze([255, 171, 112]),
            Object.freeze([255, 238, 193])
          ])
        })
      }),
      Object.freeze({
        id: "highlight-70",
        time: 70,
        flash: Object.freeze({
          duration: 1.04,
          intensity: 1,
          color: Object.freeze([255, 234, 184])
        }),
        particles: Object.freeze({
          count: 30,
          durationMin: 1.3,
          durationMax: 2.45,
          originX: 0.5,
          originY: 0.23,
          spreadX: 0.34,
          spreadY: 0.16,
          speedX: 175,
          speedYMin: 85,
          speedYMax: 235,
          sizeMin: 10,
          sizeMax: 24,
          colors: Object.freeze([
            Object.freeze([255, 244, 214]),
            Object.freeze([255, 210, 146]),
            Object.freeze([255, 249, 232]),
            Object.freeze([255, 168, 108])
          ])
        })
      }),
      Object.freeze({
        id: "flash-80-big-particles",
        time: 80,
        flash: Object.freeze({
          duration: 1.08,
          intensity: 0.96,
          color: Object.freeze([255, 230, 178])
        }),
        particles: Object.freeze({
          count: 14,
          durationMin: 2.1,
          durationMax: 3.5,
          originX: 0.5,
          originY: 0.22,
          spreadX: 0.36,
          spreadY: 0.18,
          speedX: 205,
          speedYMin: 90,
          speedYMax: 250,
          sizeMin: 24,
          sizeMax: 52,
          colors: Object.freeze([
            Object.freeze([255, 247, 227]),
            Object.freeze([255, 214, 149]),
            Object.freeze([255, 180, 120]),
            Object.freeze([255, 240, 205])
          ])
        })
      }),
      Object.freeze({
        id: "ambient-90-100",
        time: 90,
        ambientParticles: Object.freeze({
          duration: 10,
          interval: 0.22,
          count: 2,
          durationMin: 1.2,
          durationMax: 2.2,
          originX: 0.5,
          originY: 0.28,
          spreadX: 0.38,
          spreadY: 0.16,
          speedX: 92,
          speedYMin: 52,
          speedYMax: 130,
          sizeMin: 5,
          sizeMax: 12,
          colors: Object.freeze([
            Object.freeze([255, 242, 218]),
            Object.freeze([255, 213, 160]),
            Object.freeze([255, 247, 233])
          ])
        })
      })
    ])
  }),
  roundOverride: Object.freeze({
    speedMin: 455,
    speedMax: 660,
    speedVariance: 28,
    driftMin: -58,
    driftMax: 58,
    spawnMin: 0.24,
    spawnMax: 0.36,
    maxActiveItems: 8
  })
});
