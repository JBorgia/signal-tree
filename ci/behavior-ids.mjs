// The behavior IDs of BRIEF.md 5.1, 5.2, 12.4 and 12.5, in table order. Every list
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
  // 12.5
  'R5', 'R6', 'R7', 'R8', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8',
  'E3', 'E4', 'L4', 'L5', 'T11', 'T12', 'T13', 'H2', 'X4', 'X5', 'X6', 'F1', 'W6',
];

/** A fresh global pattern for a bracketed behavior ID in a test title, for example `[T3]`. Longest IDs first, so T10 is not read as T1. */
export function behaviorIdPattern() {
  const alternatives = [...BEHAVIOR_IDS].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  return new RegExp(`\\[(${alternatives.join('|')})\\]`, 'g');
}

/**
 * Tags that make a test a spec test without being behavior rows (Jonathan's
 * ruling on test tags, 2026-11-24): the cost rules of BRIEF.md 4.2 and the
 * contracts of 4.3 (adapter contract, conformance kit) and 4.5 (writes that
 * bypass the seam). ci/spec-tests.mjs protects every test carrying a spec tag;
 * ci/done-check.mjs counts coverage of BEHAVIOR_IDS only.
 */
export const COST_RULE_TAGS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
export const CONTRACT_TAGS = ['4.3', '4.5'];
export const SPEC_TAGS = [...BEHAVIOR_IDS, ...COST_RULE_TAGS, ...CONTRACT_TAGS];

/** A fresh global pattern for a bracketed spec tag in a test title, for example `[T3]`, `[C1]` or `[4.3]`. Longest first, so T10 is not read as T1. */
export function specTagPattern() {
  const alternatives = [...SPEC_TAGS].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)).map((tag) => tag.replace('.', '\\.'));
  return new RegExp(`\\[(${alternatives.join('|')})\\]`, 'g');
}
