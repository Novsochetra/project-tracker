// Mirrors the motion tokens in tokens.css for animations driven from JavaScript.
export const DURATION = {
  press: 100,
  handle: 120,
  fast: 160,
  fade: 200,
  base: 240,
  spring: 260,
  rise: 300,
  sheetIn: 340,
  sheetOut: 220,
  grow: 700,
  flash: 1400,
  toast: 2200,
  toastUndo: 4000,
} as const;

export const EASE = {
  out: [0.22, 1, 0.36, 1],
  in: [0.4, 0, 1, 1],
  spring: [0.34, 1.36, 0.64, 1],
} as const;
