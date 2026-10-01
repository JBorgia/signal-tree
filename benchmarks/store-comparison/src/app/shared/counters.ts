import type { RenderCounters } from '../contract';

/**
 * Module-level render counters. Components call `tick*()` from a template binding, so it runs
 * once per template evaluation of that view (not per signal write).
 */
const state = { rows: 0, footer: 0, editors: 0 };

export function tickRow(): number {
  state.rows++;
  return 0;
}
export function tickFooter(): number {
  state.footer++;
  return 0;
}
export function tickEditor(): number {
  state.editors++;
  return 0;
}
export function readCounters(): RenderCounters {
  return { rows: state.rows, footer: state.footer, editors: state.editors };
}
export function resetCounters(): void {
  state.rows = 0;
  state.footer = 0;
  state.editors = 0;
}
export function diffCounters(
  a: RenderCounters,
  b: RenderCounters
): RenderCounters {
  return {
    rows: b.rows - a.rows,
    footer: b.footer - a.footer,
    editors: b.editors - a.editors,
  };
}
export function addCounters(
  a: RenderCounters,
  b: RenderCounters
): RenderCounters {
  return {
    rows: a.rows + b.rows,
    footer: a.footer + b.footer,
    editors: a.editors + b.editors,
  };
}
