import { Injectable, signal, type Signal, type WritableSignal } from '@angular/core';
import type { SubjectCollection, SubjectTree } from '../../../../subjects/types.ts';

export type Row = { id: number } & Record<string, number | string>;

export interface FormField {
  readonly id: string;
  readonly leaf: WritableSignal<string>;
}

export interface GridRow {
  readonly id: number;
  readonly cells: readonly Signal<unknown>[];
}

/** State shared by the scenario views and the page API (window.__bench). */
@Injectable({ providedIn: 'root' })
export class BenchHost {
  readonly view = signal<'none' | 'form' | 'grid'>('none');
  readonly form = signal<readonly FormField[]>([]);
  readonly grid = signal<readonly GridRow[]>([]);
  tree: SubjectTree | undefined;
  collection: SubjectCollection<Row, number> | undefined;
}
