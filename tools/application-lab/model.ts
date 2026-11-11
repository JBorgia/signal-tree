// Non-shipping application fixture. These types describe user-visible work,
// not a library's transactions, receipts, subscriptions or storage layout.
export interface Job {
  readonly id: string;
  readonly instance: string;
  title: string;
  owner: string;
  status: 'queued' | 'active' | 'done';
  active: boolean;
  ownerRevision: number;
}

export interface Editor {
  rename(title: string): void;
}

export interface Inventory {
  readonly kind: string;
  query(): string;
  selected(): string | null;
  error(): string | null;
  total(): number;
  matched(): number;
  visible(): readonly Job[];
  row(id: string): Job | undefined;
  filter(query: string): void;
  select(id: string | null): void;
  rename(id: string, title: string): void;
  toggle(id: string): void;
  add(title: string): string | null;
  remove(id: string): void;
  // Remove then add a new entity instance at the end; replacement.id === id.
  // Clear selection of the removed instance. This is not an in-place update.
  replace(id: string, replacement: Job): void;
  openEditor(id: string): Editor;
  destroy(): void | Promise<void>;
}

export const VISIBLE_ROWS = 40;
export const normalizeTitle = (title: string): string => title.trim();
export const titleError = 'Enter a title.';
export const matches = (job: Job, query: string): boolean =>
  job.title.toLowerCase().includes(query.trim().toLowerCase());

// Seed generation is common and is timed separately from store construction.
export function seedJobs(count: number): Job[] {
  if (!Number.isSafeInteger(count) || count < 4)
    throw new Error('Invalid row count');
  return Array.from({ length: count }, (_, index) => ({
    id: `J-${index}`,
    instance: `initial-${index}`,
    title: `Inspect ${index % 3 === 0 ? 'pump' : 'valve'} ${index}`,
    owner: `Operator ${index % 10}`,
    status: 'queued',
    active: index % 2 === 0,
    ownerRevision: 10,
  }));
}

export function addedJob(id: string, title: string): Job {
  return {
    id,
    instance: `added-${id}`,
    title,
    owner: 'Unassigned',
    status: 'queued',
    active: true,
    ownerRevision: 0,
  };
}

export type InventoryFactory = (rows: readonly Job[]) => Inventory;
