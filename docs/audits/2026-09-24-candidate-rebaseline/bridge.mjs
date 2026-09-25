// Shared protocol bridge: presents a transaction-options PROTOCOL model as a
// SEMANTICS-2 SemanticCandidate + Fixture, so the frozen cases run unchanged
// against any candidate. One bridge, all candidates; the candidates need no new
// code.
//
// WHY THIS IS NOT ADAPTER THEATER
// The SEMANTICS-2 cases never touch a tree inside a contribution. Every
// contribution body in the scalar, structural and authority suites (37/37,
// counted against the raw `beginContribution(` count per file) is built only
// from fixture-supplied seams, and those seams are one-to-one with PROTOCOL's
// five recorded operation kinds. So the bridge RECORDS what the case asks for
// rather than pretending to capture arbitrary user callbacks.
//
// HONESTY RULES (frozen before this ran; each is a throw, never a guess)
//   1. Non-uniform per-operation dispositions are NOT flattened to one
//      transaction-level disposition by precedence. Unsupported.
//   2. 'conflicted' is never synthesized from 'refused' or from a mixed
//      disposition merely because it sounds close. Unsupported.
//   3. confirmedCount() is unsupported. stats().history is NOT a confirmed-turn
//      count and that inference is not made.
//   4. linkName() is unsupported. PROTOCOL disclaims links outright; a
//      synchronous imitation would change the program under test.
// The composition suite is NOT bridged at all; see the disposition audit.

// The contract's OWN UnsupportedSemantic must be used. A look-alike class
// defined here fails the frozen runner's `instanceof` check, and every honest
// refusal is then miscounted as an execution error instead of `unsupported` --
// a bridge defect that inflates errors and destroys the signal. The runner
// injects the real class; this fallback exists only for standalone use.
export class UnsupportedSemantic extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedSemantic';
  }
}
let Unsupported = UnsupportedSemantic;
export const useContractUnsupported = (cls) => {
  if (typeof cls === 'function') Unsupported = cls;
};
const no = (message) => {
  throw new Unsupported(message);
};
/**
 * PROTOCOL models throw their own `Unsupported` (name === 'Unsupported') for a
 * declared capability gap. That is the same semantic fact as the contract's
 * UnsupportedSemantic, so it is translated rather than escaping as an error.
 * Anything else is a genuine execution error and is rethrown untouched.
 */
const translate = (error) => {
  if (error instanceof Unsupported) throw error;
  if (error && error.name === 'Unsupported') throw new Unsupported(error.message);
  throw error;
};
const via = (fn) => {
  try {
    return fn();
  } catch (error) {
    return translate(error);
  }
};

/** PROTOCOL Result -> SEMANTICS-2 SettlementResult, with no widening. */
const settlementResult = (result) => {
  if (!result || typeof result !== 'object') return no('Model returned no Result');
  switch (result.status) {
    case 'settled':
      return { status: 'settled' };
    case 'refused':
      return { status: 'refused', reason: result.reason };
    case 'already-settled':
      return { status: 'already-settled' };
    case 'unsupported':
      return no(`Model reports unsupported: ${result.reason ?? ''}`);
    default:
      return no(`Unrecognized Result status ${String(result.status)}`);
  }
};

/**
 * Rule 1 + 2. PROTOCOL reports dispositions PER OPERATION; SEMANTICS-2 asks for
 * ONE disposition per contribution. Collapsing is only honest when every
 * operation agrees, and the frozen contract defines no aggregation for the
 * mixed case.
 */
const collapseDisposition = (state) => {
  const many = state?.dispositions;
  if (!Array.isArray(many) || many.length === 0)
    return no('Model exposes no per-operation dispositions');
  const distinct = [...new Set(many)];
  if (distinct.length > 1)
    return no(
      `Non-uniform per-operation dispositions [${many.join(
        ', '
      )}] have no contract-defined aggregation`
    );
  const only = distinct[0];
  if (only === 'conflicted')
    return no('Model reports conflicted; not representable from this protocol');
  return only;
};

/** PROTOCOL Snapshot -> SEMANTICS-2 Snapshot (Record keyed by location name). */
const projectValues = (snapshot) => {
  const out = {};
  for (const { path, value } of snapshot?.values ?? []) out[path.join('.')] = value;
  return out;
};

/**
 * The frozen fixtures (makeCurrent / makeStructural) start from
 * {x:0, y:0, z:0} with an EMPTY entity map. PROTOCOL's DEFAULT seed instead
 * carries one entity at key 'A'. Using the protocol default makes every
 * membership-count assertion off by one and makes a case's own add collide
 * with 'Business key occupied' -- a bridge defect, not candidate behaviour.
 * The bridge therefore reproduces the fixture's starting state.
 */
const fixtureSeed = () => ({
  values: ['x', 'y', 'z'].map((key) => ({ path: [key], value: 0 })),
  entities: [],
});

export function createBridge(create, options = {}) {
  // The native fixtures differ BY ROLE: makeCurrent projects scalars only,
  // makeStructural additionally merges `entities` into the snapshot. A single
  // bridge cannot infer the role, so the caller states it. Getting this wrong
  // silently drops entities from every mixed scalar+entity comparison --
  // calibration caught it as 16 rows where native was `unsupported` and the
  // bridge manufactured a `violated`.
  const { projectEntities = false, ...modelOptions } = options;
  const model = create({ seed: fixtureSeed(), ...modelOptions });
  const recorder = { ops: null };
  const record = (op) => {
    if (recorder.ops === null)
      // Outside a contribution the case is making an ORDINARY write, which is
      // a local-context protocol write, not part of any contribution.
      return via(() => settlementResult(model.write([op], { context: 'local' })));
    recorder.ops.push(op);
    return undefined;
  };

  // Entity refs are opaque to the case and are labels to the model, exactly as
  // PROTOCOL specifies ("test-held opaque handles supplied as labels").
  const labels = new Map();
  let nextLabel = 0;
  const labelOf = (ref) => {
    const label = labels.get(ref);
    return label ?? no('Unknown entity ref for this model');
  };

  const handles = new Map();
  const idOf = (handle) => {
    const id = handles.get(handle);
    return id === undefined ? no('Unknown contribution handle') : id;
  };

  const capture = (fn) => {
    if (recorder.ops !== null) no('Nested contribution recording is not representable');
    const ops = [];
    recorder.ops = ops;
    try {
      fn();
    } finally {
      recorder.ops = null;
    }
    return ops;
  };

  const entitiesOf = (snapshot) => snapshot?.entities ?? [];
  /** Mirrors the native fixture's snapshot shape for this role. */
  const snapshotOf = (snapshot) => {
    const out = projectValues(snapshot);
    if (projectEntities)
      out.entities = entitiesOf(snapshot).map((e) => ({
        key: e.key,
        value: { ...e.fields },
      }));
    return out;
  };

  const candidate = {
    beginContribution(fn) {
      const ops = capture(fn);
      const id = via(() => model.begin(ops));
      const handle = { __brand: 'contribution' };
      handles.set(handle, id);
      return handle;
    },
    settleAccept: (handle) => via(() => settlementResult(model.accept(idOf(handle)))),
    settleReject: (handle) => via(() => settlementResult(model.reject(idOf(handle)))),

    applyAuthority(event) {
      const ops = event.truth ? capture(event.truth) : [];
      const relations =
        event.settlement === undefined
          ? []
          : Array.isArray(event.settlement)
          ? event.settlement
          : [event.settlement];
      const settlements = [];
      for (const relation of relations) {
        if (relation.kind === 'none') continue;
        settlements.push({ kind: relation.kind, id: idOf(relation.contribution) });
      }
      const result = via(() =>
        model.authority({
          ops,
          order: event.order,
          ...(settlements.length ? { settlements } : {}),
        })
      );
      // applyAuthority returns void; a refusal is still a semantic fact the
      // case may not be able to see, so surface it rather than swallowing it.
      if (result && result.status === 'unsupported')
        no(`Model cannot apply this authority event: ${result.reason ?? ''}`);
      return undefined;
    },

    readCanonical: () => via(() => snapshotOf(model.canonical())),
    readVisible: () => via(() => snapshotOf(model.read())),

    readSettlementState(handle) {
      // The whole READ is wrapped, not just the call. A model may return a lazy
      // object whose property access throws -- current.mjs exposes
      // `dispositions` as a getter -- so wrapping only model.state() leaves the
      // real throw outside the translator. Found by calibration.
      return via(() => {
        const state = model.state(idOf(handle));
        if (!state || typeof state !== 'object') return no('Model exposes no settlement state');
        // Order matters and is NOT arbitrary: the native adapter validates the
        // handle/authority BEFORE reading a disposition, so checking
        // dispositions first changes which refusal fires and turns a native
        // `unsupported` into a bridged `violated`. Calibration caught exactly
        // that regression.
        if (typeof state.authority !== 'boolean')
          return no('Model exposes no boolean settlement authority');
        const retainsAuthority = state.authority;
        return { disposition: collapseDisposition(state), retainsAuthority };
      });
    },

    observeVisible(cb) {
      // Same role-aware shape as the direct reads; an observer that drops
      // entities manufactures a violation in every mixed-state callback.
      return model.observe(() => cb(snapshotOf(model.read())));
    },
  };

  const domain = {
    add(key, value) {
      const ref = { kind: 'held-entity' };
      const label = `bridge-${nextLabel++}`;
      labels.set(ref, label);
      record({ kind: 'add', ref: label, key, fields: { ...value } });
      return ref;
    },
    lookup(key) {
      for (const entry of via(() => entitiesOf(model.read()))) {
        if (entry.key === key)
          for (const [ref, label] of labels) if (label === entry.ref) return ref;
      }
      return undefined;
    },
    remove: (ref) => void record({ kind: 'remove', ref: labelOf(ref) }),
    rekey: (ref, key) => void record({ kind: 'rekey', ref: labelOf(ref), key }),
    field: (ref, change) =>
      void record({
        kind: 'field',
        ref: labelOf(ref),
        field: change.field,
        value: change.value,
      }),
    heldRead(ref) {
      const label = labelOf(ref);
      const found = via(() => entitiesOf(model.read())).find((entry) => entry.ref === label);
      return found ? { ...found.fields } : undefined;
    },
    entries: () =>
      via(() => entitiesOf(model.read())).map((entry) => ({
        key: entry.key,
        value: { ...entry.fields },
      })),
    // Rule 4.
    linkName: () =>
      no('PROTOCOL disclaims links; a synchronous imitation would change the test'),
  };

  return {
    candidate,
    write: (key, value) => void record({ kind: 'set', path: [key], value }),
    flush: async () => {
      model.flush();
    },
    dispose: () => model.destroy(),

    hasPendingAuthority(handle) {
      return via(() => {
        const state = model.state(idOf(handle));
        if (typeof state?.authority !== 'boolean')
          return no('Model exposes no boolean settlement authority');
        return state.authority;
      });
    },
    // Rule 3.
    confirmedCount: () =>
      no('stats().history is not a confirmed-turn count; that inference is not made'),
    domain,
    // Composition is deliberately absent, not stubbed: two of its seven bodies
    // defeat a recorder outright.
  };
}
