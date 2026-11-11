/** Exact numeric addresses, packed only when adjacent values are equivalent.
 * Iteration follows subject order. This is not an insertion-ordered Map.
 * A distinct value at every address deliberately remains a distinct run.
 */
export class ExactSubjectRuns<T> {
  private readonly ranges: Array<{ first: number; last: number; value: T }> = [];
  private subjects = 0;

  constructor(private readonly same: (left: T, right: T) => boolean) {}

  get size(): number { return this.subjects; }
  get runCount(): number { return this.ranges.length; }

  private at(subject: number): number {
    let low = 0, high = this.ranges.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (this.ranges[middle].last < subject) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  get(subject: number): T | undefined {
    if (!Number.isSafeInteger(subject) || subject < 0) return undefined;
    const range = this.ranges[this.at(subject)];
    return range && range.first <= subject ? range.value : undefined;
  }

  /** Admit append-ordered runs and either direction within the last batch.
   * Out-of-order distinct values stay in the caller's ordinary Map; compaction
   * never shifts a growing sorted array merely to store an uncompressible ID.
   */
  tryAppend(subject: number, value: T): boolean {
    if (!Number.isSafeInteger(subject) || subject < 0) return false;
    const last = this.ranges[this.ranges.length - 1];
    if (!last || subject > last.last) {
      if (last?.last === subject - 1 && this.same(last.value, value)) last.last = subject;
      else this.ranges.push({ first: subject, last: subject, value });
    } else {
      const before = this.ranges[this.ranges.length - 2];
      if (subject !== last.first - 1 || before && before.last >= subject || !this.same(last.value, value)) return false;
      last.first = subject;
      if (before?.last === subject - 1 && this.same(before.value, value)) {
        before.last = last.last;
        this.ranges.pop();
      }
    }
    this.subjects++;
    return true;
  }

  delete(subject: number): boolean {
    if (!Number.isSafeInteger(subject) || subject < 0) return false;
    const index = this.at(subject), range = this.ranges[index];
    if (!range || range.first > subject) return false;
    if (range.first === range.last) this.ranges.splice(index, 1);
    else if (range.first === subject) range.first++;
    else if (range.last === subject) range.last--;
    else {
      const last = range.last;
      range.last = subject - 1;
      this.ranges.splice(index + 1, 0, { first: subject + 1, last, value: range.value });
    }
    this.subjects--;
    return true;
  }

  *entries(): IterableIterator<readonly [number, T]> {
    for (const range of this.ranges)
      for (let subject = range.first; subject <= range.last; subject++) yield [subject, range.value];
  }

  *keys(): IterableIterator<number> {
    for (const range of this.ranges)
      for (let subject = range.first; subject <= range.last; subject++) yield subject;
  }
}
