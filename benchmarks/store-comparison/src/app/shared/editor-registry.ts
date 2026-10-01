import { Injectable, signal } from '@angular/core';
import type { EditorSeed, EditorStore } from '../contract';

export interface OpenEditor {
  readonly key: number;
  readonly seed: EditorSeed;
}

/** Host-scoped state of the editor stack: which editors are open and their live stores. */
@Injectable()
export class EditorRegistry {
  readonly stack = signal<readonly OpenEditor[]>([]);
  /** Live stores by editor key, registered by each editor component for the driver. */
  readonly stores = new Map<number, EditorStore>();
  private nextKey = 1;

  open(seed: EditorSeed): number {
    const key = this.nextKey++;
    this.stack.update((s) => [...s, { key, seed }]);
    return key;
  }
  closeAll(): void {
    this.stack.set([]);
  }
}
