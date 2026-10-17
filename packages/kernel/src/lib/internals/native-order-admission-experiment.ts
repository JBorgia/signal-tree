/** Private operation intent: baseline order is inverse data, never authorship. */
export type NativeOrderIntent = {
  kind: 'exact' | 'front' | 'append';
  subjects: readonly number[];
};
type Contribution = {
  author: number | undefined;
  sequence: number;
  exact?: readonly number[];
  front: readonly number[];
  back: readonly number[];
  requires: ReadonlyMap<number, number>;
};
export type NativeOrderAdmission = {
  baseline: readonly number[];
  contributions: readonly Contribution[];
};
const apply = (order: readonly number[], contribution: Contribution) => {
  if (contribution.exact) return [...contribution.exact];
  const selected = new Set([...contribution.front, ...contribution.back]);
  return [
    ...contribution.front,
    ...order.filter((subject) => !selected.has(subject)),
    ...contribution.back,
  ];
};
const merge = (earlier: Contribution, later: Contribution): Contribution => {
  if (later.exact) return later;
  const requires = new Map(earlier.requires);
  for (const [subject, sequence] of later.requires)
    requires.set(subject, sequence);
  if (earlier.exact)
    return { ...later, exact: apply(earlier.exact, later), requires };
  const selected = new Set([...later.front, ...later.back]);
  return {
    ...later,
    front: [...later.front, ...earlier.front.filter((s) => !selected.has(s))],
    back: [...earlier.back.filter((s) => !selected.has(s)), ...later.back],
    requires,
  };
};
const normalize = (contributions: readonly Contribution[]) => {
  const result: Contribution[] = [];
  for (const contribution of contributions) {
    const previous = result[result.length - 1];
    if (previous && previous.author === contribution.author)
      result[result.length - 1] = merge(previous, contribution);
    else result.push(contribution);
  }
  // Only a committed exact order irreversibly supersedes preceding facts.
  // Pending exact orders must leave those facts revealable on rejection.
  let first = 0;
  for (let i = 0; i < result.length; i++)
    if (result[i].author === undefined && result[i].exact) first = i;
  return result.slice(first);
};
export function admitNativeOrder(
  previous: NativeOrderAdmission | undefined,
  baseline: readonly number[],
  intent: NativeOrderIntent,
  author: number | undefined,
  sequence: number
): NativeOrderAdmission {
  // A same-owner exact replaces its own earlier operation facts. Other pending
  // authors remain available if this exact is rejected.
  const contributions = (previous?.contributions ?? []).filter(
    (fact) => intent.kind !== 'exact' || fact.author !== author
  );
  contributions.push({
    author,
    sequence,
    exact: intent.kind === 'exact' ? [...intent.subjects] : undefined,
    front: intent.kind === 'front' ? [...intent.subjects] : [],
    back: intent.kind === 'append' ? [...intent.subjects] : [],
    requires: new Map(intent.subjects.map((subject) => [subject, sequence])),
  });
  return {
    baseline: previous?.baseline ?? baseline,
    contributions: normalize(contributions),
  };
}
export function settleNativeOrder(
  state: NativeOrderAdmission,
  author: number,
  accept: boolean
): NativeOrderAdmission {
  return {
    baseline: state.baseline,
    contributions: normalize(
      state.contributions.flatMap((fact) =>
        fact.author !== author
          ? [fact]
          : accept
          ? [{ ...fact, author: undefined }]
          : []
      )
    ),
  };
}
/** Committed exact is irreversible; pending exact can only hide older authors. */
const live = (state: NativeOrderAdmission) => {
  let floor = 0;
  for (const fact of state.contributions)
    if (fact.author === undefined && fact.exact) floor = fact.sequence;
  return state.contributions.filter((fact) => fact.sequence >= floor);
};
export function projectNativeOrder(
  state: NativeOrderAdmission
): readonly number[] {
  let order = state.baseline;
  for (const contribution of live(state)) order = apply(order, contribution);
  return order;
}
export function nativeOrderRequires(
  state: NativeOrderAdmission,
  subject: number,
  absenceSequence: number
): boolean {
  return live(state).some(
    (fact) => (fact.requires.get(subject) ?? -1) > absenceSequence
  );
}
export function retainNativeOrder(
  state: NativeOrderAdmission,
  pendingMembership: (subject: number) => boolean
): boolean {
  return (
    state.contributions.some((fact) => fact.author !== undefined) ||
    live(state).some((fact) =>
      [...fact.requires.keys()].some(pendingMembership)
    )
  );
}
export function nativeOrderDetails(
  state: NativeOrderAdmission,
  author: number
) {
  const facts = state.contributions.filter((fact) => fact.author === author);
  if (!facts.length) return undefined;
  const active = live(state);
  const lastExact =
    [...active].reverse().find((fact) => fact.exact)?.sequence ?? 0;
  return facts.some(
    (fact) => active.includes(fact) && fact.sequence >= lastExact
  )
    ? ('current' as const)
    : ('superseded' as const);
}
