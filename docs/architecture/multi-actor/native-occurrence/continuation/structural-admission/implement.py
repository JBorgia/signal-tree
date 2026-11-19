from pathlib import Path
r=Path('/private/tmp/st-structural-admission-successor/candidate')
p=r/'packages/kernel/src/lib/entity-signal.ts';s=p.read_text();at='  function prepareOrdinaryRealization(\n';assert s.count(at)==1
s=s.replace(at,'''  /** Validate semantic endpoints against the effective ordinary view, before
   * physical address substitution. This stage has no install or callbacks. */
  function validateOrdinaryStructure(
    effects: readonly import('./internals/causal-runtime/causal-types').ReversalEffect[]
  ): boolean {
    const base = ordinaryTopology.preparePlacement(structuralStore.preparePlacement());
    type Presence = { present: false } | { present: true; key: K };
    const subjects = new Map<number, Presence>();
    const keys = new Map<K, number | undefined>();
    const read = (subject: number): Presence => subjects.get(subject) ?? base.read(subject);
    const atKey = (key: K): number | undefined => {
      if (keys.has(key)) return keys.get(key);
      const subject = ordinaryTopology.atKey(key) ?? structuralStore.subjectIdForKey(key);
      if (subject === undefined) return undefined;
      const state = read(subject);
      // A physical candidate can occupy an inspection-only address. Recheck
      // its effective ordinary key; sparse exceptions alone are not a view.
      return state.present && state.key === key ? subject : undefined;
    };
    const write = (subject: number, next: Presence): void => {
      const prior = read(subject);
      if (prior.present) keys.set(prior.key, undefined);
      subjects.set(subject, next);
      if (next.present) keys.set(next.key, subject);
    };
    for (const effect of effects) {
      if (!effect.structural || typeof effect.subjectId !== 'number') continue;
      const subject = effect.subjectId, prior = read(subject);
      if (effect.structural === 'remove') {
        // Existing removal semantics resolve by lifetime, not recorded key.
        if (!prior.present) return false;
        write(subject, { present: false });
      } else if (effect.structural === 'rekey') {
        if (!prior.present || prior.key !== effect.before || atKey(effect.after as K) !== undefined) return false;
        write(subject, { present: true, key: effect.after as K });
      } else {
        if (prior.present || atKey(effect.after as K) !== undefined) return false;
        write(subject, { present: true, key: effect.after as K });
      }
    }
    return true;
  }

'''+at)
at="  Object.defineProperty(api, '__prepareOrdinaryRealization', {";assert s.count(at)==1
s=s.replace(at,"  Object.defineProperty(api, '__validateOrdinaryStructure', {\n    value: validateOrdinaryStructure,\n    enumerable: false,\n  });\n"+at);p.write_text(s)
p=r/'packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts';s=p.read_text();s=s.replace('type CollectionNode = {','type CollectionNode = {\n  __validateOrdinaryStructure?(effects: readonly ReversalEffect[]): boolean;',1)
at='  const structuralOwnerPaths = indexStructuralOwnerPaths(options.tree.$);\n'
assert s.count(at)==1
s=s.replace(at,at+'''  // The exact returned array is an invocation-local admitted operation, not a
  // reusable current-key rewrite. Legacy unlowered callers retain validation.
  const admissions = new WeakMap<readonly ReversalEffect[], {
    valid: boolean; revision: number | undefined; consumed: boolean;
  }>();
  const admissionCurrent = (effects: readonly ReversalEffect[]): boolean => {
    const admission = admissions.get(effects);
    return !admission || (admission.valid && !admission.consumed &&
      admission.revision === physicalCommitClock?.revision());
  };
''')
start=s.index('    prepareOrdinaryEffects(effects) {');end=s.index('    validateEffects(effects) {',start)
s=s[:start]+'''    prepareOrdinaryEffects(effects) {
      const revision = physicalCommitClock?.revision();
      const groups = new Map<PositionId, ReversalEffect[]>();
      for (const effect of effects) {
        if (!effect.structural || typeof effect.subjectId !== 'number') continue;
        let group = groups.get(effect.owner);
        if (!group) groups.set(effect.owner, group = []);
        group.push(effect);
      }
      let valid = true;
      for (const [owner, group] of groups) {
        const node = resolveCollectionNode(options.tree, options.descriptors.get(owner), structuralOwnerPaths, group[0]);
        // Original add backing/restore evidence is checked before a physical
        // transfer can replace that add. No absent binding grants permission.
        if (!node?.__validateOrdinaryStructure ||
          group.some(effect => effect.structural === 'add' &&
            (!node.__restoreOne || !getStructuralAddEffect(options.descriptors.get(owner), effect))) ||
          !node.__validateOrdinaryStructure(group)) {
          valid = false;
          break;
        }
      }
      const byOwner = new Map(effects.map(effect => [effect.owner, effect]));
      // Failed semantic admission is returned for the existing typed refusal
      // path; it must not be lowered or partially installed.
      const physical = valid ? prepareOrdinaryRealization(effects, (owner, subject) => {
        const effect = byOwner.get(owner);
        return effect ? resolveCollectionNode(options.tree, options.descriptors.get(owner), structuralOwnerPaths, effect)?.__findKeyBySubjectId?.(subject) : undefined;
      }).physical : Object.freeze([...effects]);
      admissions.set(physical, { valid: valid && revision === physicalCommitClock?.revision(), revision, consumed: false });
      return physical;
    },
'''+s[end:]
s=s.replace('    validateEffects(effects) {\n','    validateEffects(effects) {\n      if (!admissionCurrent(effects)) return { kind: \'structural-drift\' };\n',1)
s=s.replace('    applyAtomically(effects) {\n','''    applyAtomically(effects) {
      const admission = admissions.get(effects);
      if (admission) {
        if (!admissionCurrent(effects) || !buildPreparedRealizationContext(
          options.tree, options.descriptors, structuralOwnerPaths, scalarSlotRuntime, effects
        )) throw new Error('Ordinary structural admission refused at structural-drift');
        admission.consumed = true;
      }
''',1)
s=s.replace('const heterogeneousFrame = valueEffects.length\n','const heterogeneousFrame = valueEffects.length || ordinaryRealization(effects)?.ordinary.some(effect => !!effect.structural)\n',1)
# An all-physical-no-op semantic removal still owns an ordinary installation.
start=s.index('function planHeterogeneousFrame(');a=s[:start];b=s[start:];b=b.replace('    effects.length === 0 ||\n    !effects.some(','    !(ordinaryEffects ?? effects).some(',1);s=a+b
# Source preparation may execute callbacks; admission cannot survive a reentrant
# independent install between entry and the first member installation.
s=s.replace('        members?.install();\n','''        if (admission && admission.revision !== physicalCommitClock?.revision())
          throw new Error('Ordinary structural admission revision is stale');
        members?.install();
''',1)
p.write_text(s)
