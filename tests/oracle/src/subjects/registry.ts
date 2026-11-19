// Subjects selectable with --a / --b. Each loader imports its implementation
// lazily so a run only loads what it compares. packages/core joins here in
// Phase 1 as one more entry.
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

/**
 * Where a behavior is covered by v16.0.0-rc.1, v16 is the authority; other
 * subjects are compared against it, not trusted.
 */
export const AUTHORITY = 'v16';

export async function loadSubject(name: string): Promise<Subject> {
  const load = SUBJECTS[name];
  if (!load) throw new Error(`unknown subject "${name}"; known: ${Object.keys(SUBJECTS).join(', ')}`);
  return load();
}
