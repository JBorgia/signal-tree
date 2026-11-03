// Shared data-boundary utility only; no workflow/state-machine implementation.
export function frozen(value) {
  const seen = new Set();
  function visit(v) {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return v;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (!v || typeof v !== 'object' || seen.has(v)) throw new Error('Non-JSON or cyclic data');
    if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype) throw new Error('Non-plain data');
    seen.add(v);
    const out = Array.isArray(v) ? [] : {};
    for (const key of Reflect.ownKeys(v)) {
      if (Array.isArray(v) && key === 'length') continue;
      const d = Object.getOwnPropertyDescriptor(v, key);
      if (typeof key !== 'string' || !d.enumerable || !Object.hasOwn(d, 'value')) throw new Error('Non-data property');
      Object.defineProperty(out, key, { value: visit(d.value), enumerable: true });
    }
    seen.delete(v);
    return Object.freeze(out);
  }
  return visit(value);
}
