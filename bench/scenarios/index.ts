import type { AnyDefinition } from '../runner/types.ts';
import { M1 } from './m1-leaf-write.ts';
import { M2 } from './m2-held-read.ts';
import { M3 } from './m3-build.ts';
import { S1 } from './s1-form-edit.ts';
import { S2 } from './s2-live-grid.ts';
import { S3 } from './s3-bulk-replace.ts';
import { S4a, S4b, S4c } from './s4-agent.ts';
import { S5 } from './s5-soak.ts';
import { S6a, S6b, S6c } from './s6-scoped-opt-in.ts';
import { S7 } from './s7-contention.ts';

/** Every gate of BRIEF 6.3 (as modified by the rulings) the harness knows, in report order. */
export const DEFINITIONS: readonly AnyDefinition[] = [
  { kind: 'scenario', ...M1 },
  { kind: 'scenario', ...M2 },
  { kind: 'scenario', ...M3 },
  { kind: 'scenario', ...S1 },
  { kind: 'scenario', ...S2 },
  { kind: 'scenario', ...S3 },
  { kind: 'scenario', ...S4a },
  { kind: 'scenario', ...S4b },
  { kind: 'scenario', ...S4c },
  { kind: 'scenario', ...S5 },
  { kind: 'external', ...S6a },
  { kind: 'composite', ...S6b },
  { kind: 'external', ...S6c },
  { kind: 'scenario', ...S7 },
  { kind: 'external', id: 'Q1', title: 'Correctness', owner: 'ported tests, the oracle and the adapter suites' },
];

export function findDefinition(id: string): AnyDefinition {
  const found = DEFINITIONS.find((definition) => definition.id === id);
  if (!found) throw new Error(`no scenario "${id}"; known: ${DEFINITIONS.map((d) => d.id).join(', ')}`);
  return found;
}
