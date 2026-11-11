/** Flat publication slots with an index for one entity lifetime's slots.
 *
 * A lifetime can retain negative, field-only or placement-only support after its
 * row disappears. Presence of a membership slot is therefore not a safe proxy
 * for presence of support. Index actual keys on the first lifetime deletion.
 * Structural drafts need that lookup repeatedly; the installed recipient map
 * is cleared and copied from the draft, so it need not retain the draft's index
 * or maintain it for ordinary terminal point writes. Direct projection users
 * still get correct indexing after their first deletion.
 */
export class EntityContributorMap extends Map<string, object> {
  private subjectKeys: Map<string, Set<string>> | undefined;

  constructor(entries?: ReadonlyMap<string, object>) {
    // Keep construction independent of an override called by Map(entries).
    super();
    for (const [key, value] of entries ?? []) this.set(key, value);
  }

  override set(key: string, value: object): this {
    if (this.subjectKeys && !this.has(key)) {
      const prefix = key.slice(0, key.indexOf(':') + 1);
      let keys = this.subjectKeys.get(prefix);
      if (!keys) this.subjectKeys.set(prefix, (keys = new Set()));
      keys.add(key);
    }
    return super.set(key, value);
  }

  override delete(key: string): boolean {
    if (!super.delete(key)) return false;
    if (this.subjectKeys) {
      const prefix = key.slice(0, key.indexOf(':') + 1);
      const keys = this.subjectKeys.get(prefix);
      keys?.delete(key);
      if (keys?.size === 0) this.subjectKeys.delete(prefix);
    }
    return true;
  }

  override clear(): void {
    super.clear();
    this.subjectKeys = undefined;
  }

  deleteSubject(subject: number): void {
    if (!this.subjectKeys) {
      this.subjectKeys = new Map();
      for (const key of this.keys()) {
        const prefix = key.slice(0, key.indexOf(':') + 1);
        let keys = this.subjectKeys.get(prefix);
        if (!keys) this.subjectKeys.set(prefix, (keys = new Set()));
        keys.add(key);
      }
    }
    const prefix = `${subject}:`;
    const keys = this.subjectKeys.get(prefix);
    if (!keys) return;
    for (const key of keys) super.delete(key);
    this.subjectKeys.delete(prefix);
  }
}
