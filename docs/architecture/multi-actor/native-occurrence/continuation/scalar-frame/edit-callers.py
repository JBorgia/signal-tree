from pathlib import Path
r=Path('/private/tmp/st-scalar-frame-publication-successor/candidate/packages/kernel/src')
def edit(p,f):
 q=r/p;q.write_text(f(q.read_text()))
edit('lib/internals/causal-runtime/target-transition.ts',lambda s:s.replace('target: ReadonlyMap<PositionId, PlainBranchMemberTransitionTarget>\n  ):','target: ReadonlyMap<PositionId, PlainBranchMemberTransitionTarget>,\n    scalars?: ReadonlyMap<PositionId, unknown>,\n    turns?: ReadonlyMap<PositionId, number>\n  ):').replace('readonly staged?: ReadonlyMap<PositionId, number>;','readonly staged?: ReadonlyMap<PositionId, number>;\n    readonly includesScalars?: boolean;').replace('memberBinding.prepareTarget(target.plainBranchMembers)','memberBinding.prepareTarget(target.plainBranchMembers, target.scalars, target.scalarTurns)').replace('scalars = withoutSupersededScalars(', 'scalars = members.includesScalars ? new Map() : withoutSupersededScalars(',1))
for p in ['enhancers/transactions/transactions.ts','enhancers/restoration/restoration.ts']:
 def change(s):
  s=s.replace('''prepareTarget: (members) =>
          preparePlainBranchMembers(tree.$ as object, members),''','''prepareTarget: (members, scalars, turns) => ({
          ...preparePlainBranchMembers(tree.$ as object, members, [...(scalars ?? [])].map(([owner,after])=>({owner,after,turn:turns?.get(owner)}))),
          includesScalars: true,
        }),''')
  s=s.replace('''prepareTarget: (members) =>
              preparePlainBranchMembers(tree.$ as object, members),''','''prepareTarget: (members, scalars, turns) => ({
              ...preparePlainBranchMembers(tree.$ as object, members, [...(scalars ?? [])].map(([owner,after])=>({owner,after,turn:turns?.get(owner)}))),
              includesScalars: true,
            }),''')
  return s
 edit(p,change)
edit('enhancers/restoration/restoration.ts',lambda s:s.replace('''                  let result: ReturnType<typeof frame.commit> | undefined;
                  return {''','''                  const install = frame.prepareCommit?.({advanceRevision:false,publish:false});
                  if (!install) throw new Error('Declarative scalar preparation unavailable');
                  let result: ReturnType<typeof frame.commit> | undefined;
                  return {''',1).replace('''result = frame.commit({
                        advanceRevision: false,
                        publish: false,
                      });''','result = install();',1).replace('''        const prepared = prepareDeclarativeTransitionInstallation(
          target,''','''        const prepared = withWriteContext(
          {origin:'restoration', ownerId:getPositionRegistry(tree.$)?.id},
          () => prepareDeclarativeTransitionInstallation(
          target,''',1).replace('''              includesScalars: true,
            }),
          }
        );''','''              includesScalars: true,
            }),
          }
        ));''',1))
edit('enhancers/transactions/transactions.ts',lambda s:"import { scalarFrameMetadata } from '../../lib/internals/scalar-publication-coverage';\n"+s.replace(''': () =>
                    frame.commit({ advanceRevision: false, publish: false });''',''': undefined;
              if (!install) throw new Error('Transaction scalar preparation unavailable');''',1).replace('''                        {
                          ...getActiveWriteContext(),
                          intent: 'system',
                          participation: 'realized',
                        },''','''                        scalarFrameMetadata(result, scalarSlotRuntime.resolveScalarSlot(effect.owner), {
                          ...getActiveWriteContext(),
                          intent: 'system',
                          participation: 'realized',
                        }),''',1))
# Legacy atomically-applied member + scalar path uses the same final frame.
edit('lib/internals/causal-runtime/tree-realization-adapter.ts',lambda s:s.replace('''preparePlainBranchMembers(options.tree.$, memberTargets)
        : undefined;''','''preparePlainBranchMembers(options.tree.$, memberTargets, authoredValueEffects.filter(effect=>
            !effect.structural && effect.subjectId===undefined && effect.subjectFieldSegments===undefined &&
            !hasInlineScopedAddress(effect) && !hasInlineSubjectAddress(effect) &&
            scalarSlotRuntime?.resolveScalarSlot(effect.owner)!==undefined).map(effect=>({owner:effect.owner,after:effect.after,turn:effect.turn})))
        : undefined;''',1).replace('''      const valueEffects = staged?.size
        ? authoredValueEffects.filter(''','''      const remainingValueEffects = members ? authoredValueEffects.filter(effect=>
        effect.structural || effect.subjectId!==undefined || effect.subjectFieldSegments!==undefined ||
        hasInlineScopedAddress(effect) || hasInlineSubjectAddress(effect) ||
        scalarSlotRuntime?.resolveScalarSlot(effect.owner)===undefined) : authoredValueEffects;
      const valueEffects = staged?.size
        ? remainingValueEffects.filter(''',1).replace('''        : authoredValueEffects;
      const apply =''','''        : remainingValueEffects;
      const apply =''',1))
