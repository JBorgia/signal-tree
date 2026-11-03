import type {
  EntityPlacementStage,
  PreparedPlacementEntries,
} from './entity-placement-stage';
type Direction = 'before' | 'after';
type Run = { ids: number[]; size: number; counts: number[] };
/** Transient query index over one fixed physical preparation, never state authority. */
export function createPreparedPlacementVisibility<K>(
  physical: EntityPlacementStage<K>,
  isVisible: (subject: number) => boolean,
  entries?: PreparedPlacementEntries<K>
) {
  const overrides = new Map<number, boolean>();
  const positions = new Map<number, { run: Run; at: number }>();
  let built = false;
  const visible = (id: number) => overrides.get(id) ?? isVisible(id);
  function build() {
    if (built) return;
    built = true;
    const present = new Map(
      (entries ?? [...physical.patch]).filter(
        (
          entry
        ): entry is readonly [
          number,
          Extract<(typeof entry)[1], { present: true }>
        ] => entry[1].present
      )
    );
    const visited = new Set<number>();
    for (const [id, row] of present) {
      if (
        visited.has(id) ||
        (row.beforeSubject !== undefined && present.has(row.beforeSubject))
      )
        continue;
      const ids: number[] = [];
      let next: number | undefined = id;
      while (next !== undefined && present.has(next) && !visited.has(next)) {
        visited.add(next);
        ids.push(next);
        next = present.get(next)?.afterSubject;
      }
      let size = 1;
      while (size < ids.length) size *= 2;
      const run: Run = { ids, size, counts: new Array(size * 2).fill(0) };
      ids.forEach((subject, at) => {
        positions.set(subject, { run, at });
        run.counts[size + at] = Number(visible(subject));
      });
      for (let i = size - 1; i > 0; i--)
        run.counts[i] = run.counts[i * 2] + run.counts[i * 2 + 1];
    }
    // Components without a start are cyclic: preserve original guarded traversal.
  }
  function find(
    run: Run,
    lo: number,
    hi: number,
    reverse: boolean,
    node = 1,
    left = 0,
    right = run.size - 1
  ): number | undefined {
    if (lo > right || hi < left || run.counts[node] === 0) return undefined;
    if (left === right) return left;
    const mid = (left + right) >>> 1;
    const first = reverse
      ? find(run, lo, hi, reverse, node * 2 + 1, mid + 1, right)
      : find(run, lo, hi, reverse, node * 2, left, mid);
    return (
      first ??
      (reverse
        ? find(run, lo, hi, reverse, node * 2, left, mid)
        : find(run, lo, hi, reverse, node * 2 + 1, mid + 1, right))
    );
  }
  return {
    setVisible(subject: number, value: boolean) {
      overrides.set(subject, value);
      const at = positions.get(subject);
      if (!at) return;
      let n = at.run.size + at.at;
      at.run.counts[n] = Number(value);
      while (n > 1) {
        n >>>= 1;
        at.run.counts[n] = at.run.counts[n * 2] + at.run.counts[n * 2 + 1];
      }
    },
    resolve(
      start: number | undefined,
      direction: Direction,
      excluded?: number
    ): number | undefined {
      build();
      let subject = start;
      const seen = new Set<number>();
      while (
        subject !== undefined &&
        subject !== excluded &&
        !seen.has(subject)
      ) {
        seen.add(subject);
        const indexed = positions.get(subject);
        if (indexed) {
          const { run, at } = indexed;
          const stop =
            excluded === undefined ? undefined : positions.get(excluded);
          const reverse = direction === 'before';
          const bound = stop?.run === run ? stop.at : undefined;
          const lo = reverse
            ? bound !== undefined && bound <= at
              ? bound + 1
              : 0
            : at;
          const hi = reverse
            ? at
            : bound !== undefined && bound >= at
            ? bound - 1
            : run.ids.length - 1;
          const found = find(run, lo, hi, reverse);
          if (found !== undefined) return run.ids[found];
          if (bound !== undefined && (reverse ? bound <= at : bound >= at))
            return undefined;
          const edge = physical.patch.get(
            run.ids[reverse ? 0 : run.ids.length - 1]
          );
          subject = edge?.present
            ? reverse
              ? edge.beforeSubject
              : edge.afterSubject
            : undefined;
        } else {
          if (visible(subject)) return subject;
          const row = physical.read(subject);
          if (!row.present) return undefined;
          subject =
            direction === 'before' ? row.beforeSubject : row.afterSubject;
        }
      }
      return undefined;
    },
  };
}
