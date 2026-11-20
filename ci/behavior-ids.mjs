// The behavior IDs of BRIEF.md 5.1, 5.2 and 12.4, in table order. Every list
// of IDs in ci/ comes from here; behavior-ids.spec.ts checks it against the
// tables in BRIEF.md, so a new row cannot be missed in one place.
export const BEHAVIOR_IDS = [
  // 5.1
  'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10',
  'R1', 'R2', 'R3', 'R4', 'E1', 'E2', 'L1', 'L2', 'L3', 'X1', 'X2',
  // 5.2
  'W1', 'W2', 'W3', 'W4',
  // 12.4
  'O1', 'O2', 'O3', 'O4', 'X3', 'D1', 'D2', 'W5', 'H1',
];

/** A fresh global pattern for a bracketed behavior ID in a test title, for example `[T3]`. Longest IDs first, so T10 is not read as T1. */
export function behaviorIdPattern() {
  const alternatives = [...BEHAVIOR_IDS].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  return new RegExp(`\\[(${alternatives.join('|')})\\]`, 'g');
}
