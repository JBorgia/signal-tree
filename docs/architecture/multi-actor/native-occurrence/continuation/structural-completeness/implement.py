from pathlib import Path
p=Path(__file__).parent/'candidate/packages/kernel/src/lib/internals/causal-runtime/tree-realization-adapter.ts'
s=p.read_text();s=s.replace('''      let valid = true;
      for (const [owner, group] of groups) {''','''      let valid = true;
      // Retain the authentic recipe resolved at admission. Physical lowering
      // must not erase an ordinary contribution or defer descriptor lookup.
      const resolved = new Map<ReversalEffect, ReversalEffect>();
      for (const [owner, group] of groups) {''',1)
a='''        // Original add backing/restore evidence is checked before a physical
        // transfer can replace that add. No absent binding grants permission.
        if (!node?.__validateOrdinaryStructure ||
          group.some(effect => effect.structural === 'add' &&
            (!node.__restoreOne || !getStructuralAddEffect(options.descriptors.get(owner), effect))) ||
          !node.__validateOrdinaryStructure(group)) {
          valid = false;
          break;
        }
'''
b='''        if (!node?.__validateOrdinaryStructure ||
          !node.__prepareOrdinaryRealization ||
          !node.__validateOrdinaryStructure(group)) {
          valid = false;
          break;
        }
        for (const effect of group) {
          if (effect.structural === 'rekey') continue;
          const context = effect.structural === 'add'
            ? getStructuralAddEffect(options.descriptors.get(owner), effect)
            : effect.structuralContext;
          // The existing ordinary installer requires an existence recipe.
          // Without it, refuse the entire paired operation before lowering.
          // Legacy unlowered physical routes retain subject-based removal.
          if (!context || context.kind === 'rekey' ||
            context.subject !== effect.subjectId ||
            !Object.prototype.hasOwnProperty.call(context, 'value') ||
            (effect.structural === 'add' && !node.__restoreOne)) {
            valid = false;
            break;
          }
          resolved.set(effect, context === effect.structuralContext ? effect :
            Object.freeze({ ...effect, structuralContext: context }));
        }
        if (!valid) break;
'''
assert a in s;s=s.replace(a,b,1)
s=s.replace('''      const physical = valid ? prepareOrdinaryRealization(effects, (owner, subject) => {''','''      const ordinary = effects.map(effect => resolved.get(effect) ?? effect);
      const physical = valid ? prepareOrdinaryRealization(ordinary, (owner, subject) => {''',1)
p.write_text(s)
