/**
 * Fixed-capacity row storage for the common narrow, freshly populated row.
 * A point can replace a field in place. Growing beyond capacity must promote
 * during preparation so the terminal install stays callback- and copy-free.
 */
export class PackedFieldRow<T extends object> {
  private key0: string | undefined;
  private key1: string | undefined;
  private key2: string | undefined;
  private value0: T | undefined;
  private value1: T | undefined;
  private value2: T | undefined;
  size = 0;

  constructor(fields: ReadonlyMap<string, T>) {
    for (const [key, value] of fields) this.set(key, value);
  }

  get(key: string): T | undefined {
    if (key === this.key0) return this.value0;
    if (key === this.key1) return this.value1;
    if (key === this.key2) return this.value2;
    return undefined;
  }

  canSet(key: string): boolean {
    return this.size < 3 || this.get(key) !== undefined;
  }

  set(key: string, value: T): void {
    if (key === this.key0 || this.key0 === undefined) {
      this.value0 = value;
      if (this.key0 === undefined) { this.key0 = key; this.size++; }
    } else if (key === this.key1 || this.key1 === undefined) {
      this.value1 = value;
      if (this.key1 === undefined) { this.key1 = key; this.size++; }
    } else if (key === this.key2 || this.key2 === undefined) {
      this.value2 = value;
      if (this.key2 === undefined) { this.key2 = key; this.size++; }
    } else {
      throw new Error('Packed entity field row must promote before installation');
    }
  }

  *values(): IterableIterator<T> {
    if (this.value0 !== undefined) yield this.value0;
    if (this.value1 !== undefined) yield this.value1;
    if (this.value2 !== undefined) yield this.value2;
  }

  *[Symbol.iterator](): IterableIterator<[string, T]> {
    if (this.key0 !== undefined && this.value0 !== undefined) {
      yield [this.key0, this.value0];
    }
    if (this.key1 !== undefined && this.value1 !== undefined) {
      yield [this.key1, this.value1];
    }
    if (this.key2 !== undefined && this.value2 !== undefined) {
      yield [this.key2, this.value2];
    }
  }
}
