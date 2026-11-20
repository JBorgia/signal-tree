// Subjects selectable on the command line. Each loader imports its
// implementation lazily so a run only loads what it replays. The published
// kernels are replay targets only (BRIEF.md 12.1.4): their outcomes are checked
// against the behavior properties, never used as expected values. packages/core
// joins here in Phase 1 as one more entry, judged by `violates.core == 0`.
import type { Subject } from '../subject.js';
import { kernelSubject, type KernelModule } from './kernel.js';

export const SUBJECTS: Readonly<Record<string, () => Promise<Subject>>> = {
  v15: async () =>
    kernelSubject((await import('kernel-v15')) as unknown as KernelModule, {
      name: 'v15',
      description: '@signal-tree/kernel@15.4.9',
      transactVerb: 'transaction',
      inspect: false,
      declare: false,
    }),
  v16: async () =>
    kernelSubject((await import('kernel-v16')) as unknown as KernelModule, {
      name: 'v16',
      description: '@signal-tree/kernel@16.0.0-rc.1',
      transactVerb: 'transact',
      inspect: true,
      declare: true,
    }),
};

/** Subjects `generate` replays when none are named. */
export const DEFAULT_SUBJECTS = ['v15', 'v16'] as const;

export async function loadSubject(name: string): Promise<Subject> {
  const load = SUBJECTS[name];
  if (!load) throw new Error(`unknown subject "${name}"; known: ${Object.keys(SUBJECTS).join(', ')}`);
  return load();
}
