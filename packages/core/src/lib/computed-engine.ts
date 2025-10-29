import { computed, Signal } from '@angular/core';

/**
 * ComputedSignalsEngine - Built-in computed signal support
 */

export interface ComputedOptions {
  lazy?: boolean;
  cache?: boolean;
}

export interface ComputedConfig<T> {
  [key: string]:
    | (() => any)
    | {
        fn: () => any;
        options?: ComputedOptions;
      };
}

export class ComputedSignalsEngine {
  private computedSignals = new Map<string, Signal<any>>();
  private dependencies = new Map<string, Set<string>>();

  createComputed<T>(
    id: string,
    fn: () => T,
    options: ComputedOptions = {}
  ): Signal<T> {
    // Use Angular's computed
    const computedSignal = computed(fn) as Signal<T>;
    this.computedSignals.set(id, computedSignal as Signal<any>);
    return computedSignal;
  }

  createMany<T extends Record<string, any>>(
    computedMap: ComputedConfig<T>
  ): Record<string, Signal<any>> {
    const results: Record<string, Signal<any>> = {};

    for (const [key, config] of Object.entries(computedMap)) {
      if (typeof config === 'function') {
        results[key] = this.createComputed(key, config as () => any);
      } else {
        results[key] = this.createComputed(
          key,
          (config as any).fn,
          (config as any).options
        );
      }
    }

    return results;
  }

  invalidate(id?: string): void {
    if (id) {
      // Angular's computed signals auto-invalidate
      // This is a no-op but kept for API compatibility
      return;
    }
    // No-op for entire set as Angular manages computed signals lifecycle
  }

  getStats(): Record<string, any> {
    return {
      totalComputed: this.computedSignals.size,
      // Angular signals don't expose internal stats
    };
  }
}
