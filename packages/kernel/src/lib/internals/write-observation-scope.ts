/** Declared synchronous scope membership, not exclusive cause or read dependencies. */
export interface DeclaredWriteScopes {
  readonly tokens: readonly string[];
  readonly includesUnscoped: boolean;
  readonly omitted: boolean;
}

const maxTokens = 8;
let active = new Map<number, DeclaredWriteScopes>();

const freeze = (
  tokens: string[], includesUnscoped: boolean, omitted: boolean
): DeclaredWriteScopes => Object.freeze({
  tokens: Object.freeze(tokens), includesUnscoped, omitted,
});

/**
 * Run once with a tooling declaration for this runtime owner. A promise does
 * not extend the scope. Invalid diagnostic identifiers are ignored; enclosing valid scopes remain.
 * Diagnostics must not suppress application work. Tokens must be nonempty and <=256
 * UTF-16 code units. Consumers own token uniqueness and label retention.
 */
export function withWriteObservationScope<T>(
  ownerId: number, token: string, write: () => T
): T {
  if (!Number.isSafeInteger(ownerId) || ownerId < 1 ||
      typeof token !== 'string' || !token.length || token.length > 256) {
    return write();
  }
  const previous = active.get(ownerId);
  const tokens = [...(previous?.tokens ?? [])];
  const additional = !tokens.includes(token);
  const omitted = previous?.omitted === true || (additional && tokens.length === maxTokens);
  if (additional && tokens.length < maxTokens) tokens.push(token);
  active.set(ownerId, freeze(tokens, false, omitted));
  try {
    return write();
  } finally {
    if (previous) active.set(ownerId, previous);
    else active.delete(ownerId);
  }
}

/** Snapshot only at write creation, never at deferred delivery. */
export function currentWriteObservationScopes(ownerId?: number): DeclaredWriteScopes | undefined {
  return ownerId === undefined ? undefined : active.get(ownerId);
}

/** Independent of mutation metadata: disagreement must not discard declarations. */
export function mergeWriteObservationScopes(
  left?: DeclaredWriteScopes, right?: DeclaredWriteScopes
): DeclaredWriteScopes | undefined {
  if (!left && !right) return undefined;
  const tokens = [...(left?.tokens ?? [])];
  let omitted = left?.omitted === true || right?.omitted === true;
  for (const token of right?.tokens ?? []) {
    if (tokens.includes(token)) continue;
    if (tokens.length < maxTokens) tokens.push(token);
    else omitted = true;
  }
  return freeze(tokens, !left || !right || left.includesUnscoped || right.includesUnscoped, omitted);
}

/** Delivery is not application scope; explicit new scopes in subscribers still work. */
export function withoutWriteObservationScopes<T>(deliver: () => T): T {
  if (active.size === 0) return deliver();
  const previous = active;
  active = new Map();
  try {
    return deliver();
  } finally {
    active = previous;
  }
}
