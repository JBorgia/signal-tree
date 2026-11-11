type Key = string | number;
const EMPTY: readonly number[] = [];

/**
 * Eligible addresses retain the subject Map's insertion order. Inspection can
 * leave several eligible lifetimes at the same address, so this is an ordered
 * bucket index, never a unique address-to-subject map.
 *
 * Only structural interpretation requests the index. Installing a prepared
 * projection clears and copies the authoritative Map, leaving the live map
 * unindexed; ordinary point writes need no address index maintenance. Rekeying
 * an existing subject invalidates the index because appending it to a new
 * bucket would lose its original Map position.
 */
export class EntityEgressKeys extends Map<number, Key> {
  private byKey: Map<Key, number[]> | undefined;

  override set(subject: number, key: Key): this {
    if (this.byKey) {
      if (this.has(subject)) {
        if (this.get(subject) !== key) this.byKey = undefined;
      } else if (key === key) {
        // Map canonicalizes a -0 subject key to +0 before iteration.
        const canonicalSubject = subject === 0 ? 0 : subject;
        const bucket = this.byKey.get(key);
        if (bucket) bucket.push(canonicalSubject);
        else this.byKey.set(key, [canonicalSubject]);
      }
    }
    return super.set(subject, key);
  }

  override delete(subject: number): boolean {
    const key = this.get(subject);
    if (!super.delete(subject)) return false;
    if (this.byKey && key !== undefined) {
      const bucket = this.byKey.get(key);
      if (bucket) {
        // Map subject equality is SameValueZero, even though address matching
        // below deliberately preserves the original strict-equality contract.
        const at = bucket.findIndex(
          (held) => held === subject || (held !== held && subject !== subject)
        );
        if (at !== -1) bucket.splice(at, 1);
        if (!bucket.length) this.byKey.delete(key);
      }
    }
    return true;
  }

  override clear(): void {
    super.clear();
    this.byKey = undefined;
  }

  subjectsAt(key: Key | undefined): readonly number[] {
    // The original loops compare addresses with ===. Map itself would match
    // NaN to NaN; that would silently change reconciliation behavior.
    if (key === undefined || key !== key) return EMPTY;
    if (!this.byKey) {
      this.byKey = new Map();
      for (const [subject, held] of this) {
        if (held !== held) continue;
        const bucket = this.byKey.get(held);
        if (bucket) bucket.push(subject);
        else this.byKey.set(held, [subject]);
      }
    }
    return this.byKey.get(key) ?? EMPTY;
  }
}
