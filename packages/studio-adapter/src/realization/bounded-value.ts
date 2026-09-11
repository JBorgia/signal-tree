import { type CapturedValue } from './types';

/** Conservative retained-size accounting, not a measurement of engine heap bytes.
 * Clone while traversing a bounded graph; never clone an unchecked source.
 * Accessors and exotic objects refuse rather than running application getters.
 */
export function captureBoundedValue(value: unknown, limit: number): { value: CapturedValue; bytes: number } {
  let bytes = 0;
  let visits = 0;
  const seen = new Map<object, unknown>();
  const charge = (size: number) => {
    bytes += size;
    if (bytes > limit || ++visits > 2048) throw new RangeError('capture-budget');
  };
  const clone = (input: unknown, depth = 0): unknown => {
    if (depth > 32) throw new RangeError('capture-budget');
    charge(typeof input === 'string' ? 16 + input.length * 2 : 32);
    if (input === null || input === undefined || typeof input === 'string' ||
        typeof input === 'number' || typeof input === 'boolean') return input;
    if (typeof input === 'bigint') {
      // Bound magnitude before any decimal conversion (including downstream codec
      // conversion). BigInt comparison does not allocate a decimal representation.
      const bits = Math.max(1, Math.min(4096, Math.floor(limit / 4)));
      const boundary = BigInt(1) << BigInt(bits);
      if (input >= boundary || input <= -boundary) throw new RangeError('capture-budget');
      charge(32 + bits * 2);
      return input;
    }
    if (typeof input !== 'object') throw new TypeError('unsupported-value');
    if (seen.has(input)) return seen.get(input);
    if (input instanceof Date) {
      const result = new Date(Date.prototype.getTime.call(input));
      seen.set(input, result);
      return result;
    }
    if (input instanceof Map) {
      const result = new Map<unknown, unknown>();
      seen.set(input, result);
      for (const [key, entry] of Map.prototype.entries.call(input)) {
        result.set(clone(key, depth + 1), clone(entry, depth + 1));
      }
      return result;
    }
    if (input instanceof Set) {
      const result = new Set<unknown>();
      seen.set(input, result);
      for (const entry of Set.prototype.values.call(input)) result.add(clone(entry, depth + 1));
      return result;
    }
    const array = Array.isArray(input);
    if (!array && Object.getPrototypeOf(input) !== Object.prototype && Object.getPrototypeOf(input) !== null) {
      throw new TypeError('unsupported-value');
    }
    if (array) charge(input.length * 8);
    const result: Record<string, unknown> = array ? [] as unknown as Record<string, unknown> : {};
    seen.set(input, result);
    for (const key in input) {
      if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
      charge(32 + key.length * 2);
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor)) throw new TypeError('accessor-value');
      Object.defineProperty(result, key, {
        value: clone(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true,
      });
    }
    if (array) (result as unknown as unknown[]).length = input.length;
    return result;
  };
  try {
    return { value: { kind: 'value', value: clone(value) }, bytes };
  } catch (error) {
    const budget = error instanceof RangeError;
    return { value: {
      kind: 'unserializable',
      valueType: budget ? 'capture-budget' : typeof value,
      preview: budget ? 'Value exceeds capture byte or traversal budget' : 'Value cannot be safely captured',
    }, bytes: 256 };
  }
}
