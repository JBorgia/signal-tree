export function equal<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) return false;
  if (typeA !== 'object') return false;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp)
    return a.source === b.source && a.flags === b.flags;
  if (a instanceof Map && b instanceof Map) {
    if ((a as any).size !== (b as any).size) return false;
    for (const [key, value] of a as any) {
      if (!b.has(key) || !equal(value, b.get(key))) return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if ((a as any).size !== (b as any).size) return false;
    for (const value of a as any) {
      if (!b.has(value)) return false;
    }
    return true;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || (a as any).length !== (b as any).length)
      return false;
    return (a as any).every((item: any, index: number) =>
      equal(item, (b as any)[index])
    );
  }
  if (Array.isArray(b)) return false;
  const objA = a as Record<string, unknown>;
  const objB = b as Record<string, unknown>;
  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) => key in objB && equal(objA[key] as any, objB[key] as any)
  );
}
