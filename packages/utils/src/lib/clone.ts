/**
 * Shared deepClone / deepEqual helpers extracted from time-travel for reuse.
 * Keep implementation identical to avoid behavioral changes.
 */
// Lightweight default implementations (kept as the primary runtime functions)
function deepCloneLight<T>(obj: T): T {
  if (typeof (globalThis as any).structuredClone === 'function') {
    try {
      return (globalThis as any).structuredClone(obj) as T;
    } catch (err) {
      void err;
    }
  }

  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as T;
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags) as T;
  if (obj instanceof Array) return obj.map((item) => deepCloneLight(item)) as T;
  if (obj instanceof Set)
    return new Set(Array.from(obj).map(deepCloneLight)) as T;
  if (obj instanceof Map)
    return new Map(
      Array.from(obj).map(([k, v]) => [deepCloneLight(k), deepCloneLight(v)])
    ) as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as any)[key] = deepCloneLight((obj as any)[key]);
    }
  }
  return cloned;
}

function deepEqualLight<T>(a: T, b: T): boolean {
  if (a === b) return true;

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return a === b;

  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();

  if (a instanceof RegExp && b instanceof RegExp)
    return a.toString() === b.toString();

  if (a instanceof Array && b instanceof Array) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++)
      if (!deepEqualLight(a[i], b[i])) return false;
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const value of a) if (!b.has(value)) return false;
    return true;
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqualLight(value, b.get(key))) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqualLight((a as any)[key], (b as any)[key])) return false;
  }
  return true;
}

// Exported functions (default to lightweight impl)
export function deepClone<T>(obj: T): T {
  return deepCloneLight(obj);
}

export function deepEqual<T>(a: T, b: T): boolean {
  return deepEqualLight(a, b);
}

/**
 * Optional helper to load a heavier clone/equality implementation at runtime.
 * Callers can await loadHeavyClone() and then use the returned implementations
 * if they want a separate chunk for heavy cloning logic.
 */
export async function loadHeavyClone() {
  const mod = await import('./clone.impl');
  return {
    deepClone: mod.deepCloneImpl as typeof deepClone,
    deepEqual: mod.deepEqualImpl as typeof deepEqual,
  };
}
