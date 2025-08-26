/**
 * Heavy clone implementation - identical behavior but can be split into a separate chunk
 * This file exists so callers can lazy-load a heavier implementation if desired.
 */
export function deepCloneImpl<T>(obj: T): T {
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
  if (obj instanceof Array) return obj.map((item) => deepCloneImpl(item)) as T;
  if (obj instanceof Set)
    return new Set(Array.from(obj).map(deepCloneImpl)) as T;
  if (obj instanceof Map)
    return new Map(
      Array.from(obj).map(([k, v]) => [deepCloneImpl(k), deepCloneImpl(v)])
    ) as T;

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (cloned as any)[key] = deepCloneImpl((obj as any)[key]);
    }
  }
  return cloned;
}

export function deepEqualImpl<T>(a: T, b: T): boolean {
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
      if (!deepEqualImpl(a[i], b[i])) return false;
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
      if (!b.has(key) || !deepEqualImpl(value, b.get(key))) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqualImpl((a as any)[key], (b as any)[key])) return false;
  }
  return true;
}
