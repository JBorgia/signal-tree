/** Internal comparison of transported natural values, never causal identity.
 * Map/Set iteration order is significant. Objects ignore property insertion order.
 * Refuse unsupported values and excessive work; callers must require `equal`.
 */
export type ValueComparison = 'equal' | 'different' | 'unknown';

export function compareTransportedValues(left: unknown, right: unknown): ValueComparison {
  let visits = 0;
  let bytes = 0;
  const forward = new Map<object, object>();
  const reverse = new Map<object, object>();
  const charge = (amount = 32) => {
    bytes += amount;
    if (++visits > 4096 || bytes > 1024 * 1024) throw new Error('comparison-budget');
  };
  const keysOf = (value: object, array: boolean): string[] => {
    const keys = Reflect.ownKeys(value);
    if (keys.length > 4096) throw new Error('comparison-budget');
    const result: string[] = [];
    for (const key of keys) {
      if (array && key === 'length') continue;
      if (typeof key !== 'string') throw new Error('unsupported-symbol-key');
      charge(key.length * 2 + 16);
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) throw new Error('unsupported-property');
      result.push(key);
    }
    return result;
  };
  const compare = (a: unknown, b: unknown, depth: number): boolean => {
    charge();
    if (depth > 64) throw new Error('comparison-budget');
    if (typeof a !== typeof b) return false;
    if (typeof a === 'function' || typeof a === 'symbol') throw new Error('unsupported-value');
    if (typeof a === 'string') charge((a.length + (b as string).length) * 2);
    if (typeof a === 'bigint') {
      const bound = BigInt(1) << BigInt(4096);
      if (a >= bound || a <= -bound || (b as bigint) >= bound || (b as bigint) <= -bound) throw new Error('comparison-budget');
    }
    if (a === null || b === null || typeof a !== 'object') return Object.is(a, b);
    const other = b as object;
    if (forward.has(a) || reverse.has(other)) return forward.get(a) === other && reverse.get(other) === a;
    forward.set(a, other);
    reverse.set(other, a);
    const protoA = Object.getPrototypeOf(a);
    const protoB = Object.getPrototypeOf(other);
    const plainA = protoA === Object.prototype || protoA === null;
    const plainB = protoB === Object.prototype || protoB === null;
    if (plainA !== plainB) return false;
    if (!plainA && protoA !== protoB) throw new Error('unsupported-prototype');
    if (protoA === Date.prototype) {
      if (Reflect.ownKeys(a).length || Reflect.ownKeys(other).length) throw new Error('unsupported-properties');
      return Object.is(Date.prototype.getTime.call(a), Date.prototype.getTime.call(other));
    }
    if (protoA === Map.prototype || protoA === Set.prototype) {
      if (Reflect.ownKeys(a).length || Reflect.ownKeys(other).length) throw new Error('unsupported-properties');
      const map = protoA === Map.prototype;
      const aIterator = map ? Map.prototype.entries.call(a) : Set.prototype.values.call(a);
      const bIterator = map ? Map.prototype.entries.call(other) : Set.prototype.values.call(other);
      while (true) {
        charge();
        const x = aIterator.next(); const y = bIterator.next();
        if (x.done || y.done) return x.done === y.done;
        if (map) {
          if (!compare(x.value[0], y.value[0], depth + 1) || !compare(x.value[1], y.value[1], depth + 1)) return false;
        } else if (!compare(x.value, y.value, depth + 1)) return false;
      }
    }
    const array = Array.isArray(a);
    if (!plainA && !(array && protoA === Array.prototype)) throw new Error('unsupported-value');
    if (array !== Array.isArray(other)) return false;
    if (array && a.length !== (other as unknown[]).length) return false;
    const aKeys = keysOf(a, array); const bKeys = keysOf(other, array);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(other, key);
      if (!descriptor) return false;
      if (!compare(Object.getOwnPropertyDescriptor(a, key)!.value, descriptor.value, depth + 1)) return false;
    }
    return true;
  };
  try { return compare(left, right, 0) ? 'equal' : 'different'; }
  catch { return 'unknown'; }
}
