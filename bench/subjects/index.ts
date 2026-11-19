import type { StoreSubject } from './types.ts';

export interface SubjectEntry {
  load(): Promise<StoreSubject>;
  /** angular.json build configuration(s) that build the reference app against this subject. */
  readonly angularConfiguration: string;
}

/** Every subject the harness can run. Add the new core's subject here when it exists. */
export const SUBJECTS: Readonly<Record<string, SubjectEntry>> = {
  'v15-shim': {
    load: async () => (await import('./v15-shim.ts')).v15Shim,
    angularConfiguration: 'bench',
  },
};

export const DEFAULT_SUBJECT = 'v15-shim';

export async function loadSubject(id: string): Promise<StoreSubject> {
  const entry = SUBJECTS[id];
  if (!entry) throw new Error(`unknown subject "${id}"; known: ${Object.keys(SUBJECTS).join(', ')}`);
  return entry.load();
}
