import type { EnhancerMeta } from '../enhancer-types';

/**
 * VALIDATE THE CONFIGURATION, NOT THE TYPING ORDER.
 *
 * The chained builder validated `requires` at each `.with()` call, against the
 * capabilities provided by enhancers applied *so far*. That made this an error:
 *
 *     .with(consumerRequiring('x')).with(providerOf('x'))
 *
 * even though the configuration as a whole is satisfiable — the developer just
 * typed the calls in an order the validator disliked. With the whole enhancer
 * set supplied declaratively, order is not information: requirements resolve
 * against the union of everything configured, and the planner reorders.
 *
 * ⚠️ The reason this module exists rather than the check simply moving: the
 * ordering pass (`resolveEnhancerOrder`) does NOT detect an unsatisfied
 * requirement. It builds edges only where a provider exists, so an enhancer
 * requiring something nobody provides gets no incoming edge and is ordered
 * anywhere, silently. Dropping the eager check without replacing it would trade
 * a loud error for a misconfigured tree.
 *
 * Every problem is reported together. A configuration is a set, so its failures
 * are a set; fixing them one construction error at a time is a worse loop than
 * seeing all of them at once.
 */

interface UnsatisfiedEnhancerRequirement {
  readonly who: string;
  readonly capability: string;
}

interface DuplicateEnhancer {
  readonly name: string;
  readonly count: number;
}

export interface EnhancerConfigurationProblems {
  readonly unsatisfied: readonly UnsatisfiedEnhancerRequirement[];
  readonly duplicates: readonly DuplicateEnhancer[];
}

const describe = (meta: EnhancerMeta | undefined): string =>
  meta?.name ? `"${meta.name}"` : 'an unnamed enhancer';

/**
 * Collect every problem in one pass. Requirements resolve against the union of
 * all `provides` in the configuration, so declaration order cannot cause a
 * false negative or a false positive.
 */
export function findEnhancerConfigurationProblems(
  metas: readonly (EnhancerMeta | undefined)[]
): EnhancerConfigurationProblems {
  const provided = new Set<string>();
  for (const meta of metas) {
    for (const capability of meta?.provides ?? []) {
      provided.add(capability);
    }
  }

  const unsatisfied: UnsatisfiedEnhancerRequirement[] = [];
  for (const meta of metas) {
    for (const capability of meta?.requires ?? []) {
      if (!provided.has(capability)) {
        unsatisfied.push({ who: describe(meta), capability });
      }
    }
  }

  // Named enhancers appearing twice. Anonymous ones are not comparable, so they
  // are exempt rather than guessed at.
  const seen = new Map<string, number>();
  for (const meta of metas) {
    if (!meta?.name) continue;
    seen.set(meta.name, (seen.get(meta.name) ?? 0) + 1);
  }
  const duplicates: DuplicateEnhancer[] = [];
  for (const [name, count] of seen) {
    if (count > 1) duplicates.push({ name, count });
  }

  return { unsatisfied, duplicates };
}

/** Throw once, listing everything wrong with the configuration. */
export function assertEnhancerConfigurationValid(
  metas: readonly (EnhancerMeta | undefined)[]
): void {
  const { unsatisfied, duplicates } = findEnhancerConfigurationProblems(metas);
  if (unsatisfied.length === 0 && duplicates.length === 0) return;

  const lines: string[] = [];
  for (const problem of unsatisfied) {
    lines.push(
      `  - ${problem.who} requires capability "${problem.capability}", ` +
        `but no configured enhancer provides it.`
    );
  }
  for (const duplicate of duplicates) {
    lines.push(
      `  - enhancer "${duplicate.name}" is configured ${duplicate.count} times; ` +
        `each enhancer may appear once.`
    );
  }

  throw new Error(
    `SignalTree could not finalize the enhancer configuration:\n${lines.join(
      '\n'
    )}`
  );
}
