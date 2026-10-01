/** Canonical JSON: object keys sorted, so key order never affects the digest. */
export function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const obj = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonical(obj[k]))
      .join(',') +
    '}'
  );
}

/**
 * Running hash of saved editor results: two FNV-1a 32-bit lanes. Holds two numbers, never the
 * results themselves, so saving an editor retains nothing per cycle.
 */
export class RunningHash {
  private a = 0x811c9dc5;
  private b = 0x01000193 ^ 0xdeadbeef;

  fold(text: string): void {
    let a = this.a;
    let b = this.b;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ (c + 31), 0x85ebca77) >>> 0;
    }
    // separator so [x][y] differs from [xy]
    a = Math.imul(a ^ 0xff, 0x01000193) >>> 0;
    b = Math.imul(b ^ 0xff, 0x85ebca77) >>> 0;
    this.a = a;
    this.b = b;
  }

  value(): string {
    return (
      this.a.toString(16).padStart(8, '0') +
      this.b.toString(16).padStart(8, '0')
    );
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (x) =>
    x.toString(16).padStart(2, '0')
  ).join('');
}
