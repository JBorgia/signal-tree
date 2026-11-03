/** Private sparse adjacency preparation. Missing rows are explicit absence. */
export type EntityPlacement<K> =
  | { present: false }
  | { present: true; key: K; beforeSubject?: number; afterSubject?: number };
export type PreparedPlacementEntries<K> = readonly (readonly [
  number,
  Readonly<EntityPlacement<K>>
])[];

export class EntityPlacementStage<K> {
  readonly patch = new Map<number, EntityPlacement<K>>();
  constructor(
    readonly base: (subject: number) => EntityPlacement<K>,
    public head: number | undefined,
    public tail: number | undefined
  ) {}
  /** One immutable enumeration of a completed preparation, not a stored index. */
  capturePatch(): PreparedPlacementEntries<K> {
    const entries: Array<readonly [number, Readonly<EntityPlacement<K>>]> = [];
    // Map iteration creates this tuple; it is not the Map's stored row.
    for (const entry of this.patch) {
      entry[1] = Object.freeze({ ...entry[1] });
      entries.push(Object.freeze(entry));
    }
    return Object.freeze(entries);
  }
  read(subject: number): EntityPlacement<K> {
    return this.patch.get(subject) ?? this.base(subject);
  }
  private change(
    subject: number,
    change: { beforeSubject?: number; afterSubject?: number }
  ): void {
    const row = this.read(subject);
    if (!row.present) throw new Error('Placement neighbor is absent');
    this.patch.set(subject, { ...row, ...change });
  }
  remove(subject: number): void {
    const row = this.read(subject);
    if (!row.present) return;
    if (row.beforeSubject === undefined) this.head = row.afterSubject;
    else this.change(row.beforeSubject, { afterSubject: row.afterSubject });
    if (row.afterSubject === undefined) this.tail = row.beforeSubject;
    else this.change(row.afterSubject, { beforeSubject: row.beforeSubject });
    this.patch.set(subject, { present: false });
  }
  insert(
    subject: number,
    key: K,
    beforeSubject?: number,
    afterSubject?: number
  ): void {
    this.remove(subject);
    const after =
      afterSubject === undefined ? undefined : this.read(afterSubject);
    const before =
      beforeSubject === undefined ? undefined : this.read(beforeSubject);
    if (after?.present) beforeSubject = after.beforeSubject;
    else if (before?.present) afterSubject = before.afterSubject;
    else {
      beforeSubject = this.tail;
      afterSubject = undefined;
    }
    if (beforeSubject === undefined) this.head = subject;
    else this.change(beforeSubject, { afterSubject: subject });
    if (afterSubject === undefined) this.tail = subject;
    else this.change(afterSubject, { beforeSubject: subject });
    this.patch.set(subject, {
      present: true,
      key,
      beforeSubject,
      afterSubject,
    });
  }
  snapshot(): readonly number[] {
    const subjects: number[] = [];
    const seen = new Set<number>();
    let subject = this.head;
    while (subject !== undefined) {
      if (seen.has(subject)) throw new Error('Prepared placement cycle');
      seen.add(subject);
      subjects.push(subject);
      const row = this.read(subject);
      if (!row.present)
        throw new Error('Prepared placement contains absent lifetime');
      subject = row.afterSubject;
    }
    return Object.freeze(subjects);
  }
  orderDomain(subjects: readonly number[]): readonly number[] {
    const domain = new Set(subjects);
    if (domain.size !== subjects.length)
      throw new Error('Prepared order domain repeats a lifetime');
    for (const subject of subjects)
      if (!this.read(subject).present)
        throw new Error('Prepared order domain contains absent lifetime');
    const current = this.snapshot();
    let index = 0;
    const ordered = Object.freeze(
      current.map((subject) =>
        domain.has(subject) ? subjects[index++] : subject
      )
    );
    this.order(ordered);
    // Capture consumes the sequence just validated and installed privately,
    // rather than traversing that same stage again.
    return ordered;
  }
  rekey(subject: number, key: K): void {
    const row = this.read(subject);
    if (!row.present) throw new Error('Placement rekey lifetime is absent');
    this.patch.set(subject, { ...row, key });
  }
  order(subjects: readonly number[]): void {
    for (let i = 0; i < subjects.length; i++) {
      const row = this.read(subjects[i]);
      if (!row.present) throw new Error('Order lifetime is absent');
      this.patch.set(subjects[i], {
        ...row,
        beforeSubject: subjects[i - 1],
        afterSubject: subjects[i + 1],
      });
    }
    this.head = subjects[0];
    this.tail = subjects.at(-1);
  }
}
