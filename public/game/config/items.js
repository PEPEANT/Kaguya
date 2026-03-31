export const ITEM_TYPES = [
  { key: "snack1", points: 18, weight: 0.24, size: 122, radius: 38, color: "#fff6e0" },
  { key: "snack2", points: 32, weight: 0.15, size: 138, radius: 44, color: "#fff6e0" },
  { key: "snack3", points: 26, weight: 0.13, size: 144, radius: 48, color: "#fff6e0" },
  { key: "snack4", points: 14, weight: 0.11, size: 108, radius: 36, color: "#fff6e0" },
  { key: "snack5", points: 24, weight: 0.09, size: 136, radius: 44, color: "#fff3da" },
  {
    key: "special1",
    points: 0,
    timeBonus: 14,
    weight: 0.022,
    size: 126,
    radius: 38,
    color: "#d8f2ff",
    maxActive: 1,
    spawnCooldown: 9,
    sourceCrop: { x: 386, y: 120, width: 590, height: 566 }
  },
  { key: "danger1", points: -32, damage: 2, weight: 0.085, size: 110, radius: 42, color: "#ff8b89" },
  { key: "danger2", points: -20, damage: 1, weight: 0.095, size: 118, radius: 46, color: "#ffb3ae" },
  { key: "danger3", points: -26, damage: 1, weight: 0.075, size: 104, radius: 40, color: "#ff9d96" }
];
