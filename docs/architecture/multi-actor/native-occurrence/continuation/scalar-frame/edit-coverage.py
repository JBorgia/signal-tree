from pathlib import Path
r=Path('/private/tmp/st-scalar-frame-publication-successor/candidate/packages/kernel/src/lib')
def edit(p,f):
 q=r/p;q.write_text(f(q.read_text()))
(r/'internals/scalar-publication-coverage.ts').write_text('''import type { WriteMetadata } from '../mutation-types';
import type { ScalarSlotCommitResult } from './tree-scalar-slot-runtime';

// A receipt of recipient participation, never publication permission.
const COVERAGE = Symbol('ScalarPublicationCoverage');
type Covered = WriteMetadata & { readonly [COVERAGE]?: readonly object[] };
export function withScalarPublicationCoverage(meta: WriteMetadata | undefined, recipients: readonly object[] | undefined): WriteMetadata {
  return {...meta, [COVERAGE]: recipients};
}
export function scalarPublicationCovers(meta: WriteMetadata | undefined, channel: object): boolean {
  return (meta as Covered | undefined)?.[COVERAGE]?.includes(channel) === true;
}
export function mergeScalarPublicationCoverage(left: WriteMetadata, right: WriteMetadata, merged: WriteMetadata): WriteMetadata {
  const a = (left as Covered)[COVERAGE], b = (right as Covered)[COVERAGE];
  // Every coalesced contribution must be covered for a recipient. Undefined
  // is an uncovered contribution, not an empty list that can be discarded.
  return withScalarPublicationCoverage(merged, a && b ? a.filter(channel => b.includes(channel)) : undefined);
}
export function scalarFrameMetadata(result: ScalarSlotCommitResult | undefined, slot: number | undefined, meta: WriteMetadata): WriteMetadata {
  return withScalarPublicationCoverage(meta, slot === undefined ? undefined : result?.publication?.coverage.get(slot));
}
''')
# direct source setters stamp their own completed installation, never ambient state
edit('internals/location-runtime.ts',lambda s:s.replace("if (observer) observer({intent:'replace',before:before as T,after:changed ? next : before as T,changed});", "if (observer) observer({intent:'replace',before:before as T,after:changed ? next : before as T,changed,coveredRecipients:unit?.coveredRecipients});").replace("mutationSource2.observer?.({intent:'derive',before,after:changed ? next : before,changed});", "mutationSource2.observer?.({intent:'derive',before,after:changed ? next : before,changed,coveredRecipients:unit?.coveredRecipients});"))
edit('internals/native-tree-scalar-leaf-runtime.ts',lambda s:s.replace('changed: changed || dormant,','changed: changed || dormant,\n              coveredRecipients: unit?.coveredRecipients,'))
edit('internals/intercept-leaf-signals.ts',lambda s:"import { withScalarPublicationCoverage } from './scalar-publication-coverage';\n"+s.replace('withMutationIntent(getActiveWriteContext(), mutation.intent),','withScalarPublicationCoverage(withMutationIntent(getActiveWriteContext(), mutation.intent), mutation.coveredRecipients),'))
edit('internals/owned-mutation.ts',lambda s:"import { withScalarPublicationCoverage } from './scalar-publication-coverage';\n"+s.replace('mutationIntent: OwnedMutationIntent\n): void', 'mutationIntent: OwnedMutationIntent,\n  coveredRecipients?: readonly object[]\n): void').replace('''    {
      ...(getActiveWriteContext() ?? {}),
      mutationIntent,
    },''','''    withScalarPublicationCoverage({
      ...(getActiveWriteContext() ?? {}),
      mutationIntent,
    }, coveredRecipients),'''))
edit('internals/observation-substrate.ts',lambda s:s.replace('mutation.intent\n        );','mutation.intent,\n          mutation.coveredRecipients\n        );'))
edit('path-notifier.ts',lambda s:"import { mergeScalarPublicationCoverage } from './internals/scalar-publication-coverage';\n"+s.replace('return mergeEntityValueTransition(\n      left,','return mergeScalarPublicationCoverage(left, right, mergeEntityValueTransition(\n      left,',1).replace(': merged\n    );',': merged\n    ));',1))
edit('link.ts',lambda s:"import { scalarPublicationCovers } from './internals/scalar-publication-coverage';\n"+s.replace('if (disposed || !endpoint.set) return;\n      if(entityValueTransition', 'if (disposed || !endpoint.set) return;\n      if (scalarPublicationCovers(meta, consequenceKey)) { dirty = true; observeLink(); return; }\n      if(entityValueTransition',1))
# Frame events use the installed frame's exact slot coverage. Reconstruction keeps publication.
edit('internals/plain-branch-membership.ts',lambda s:"import { scalarFrameMetadata } from './scalar-publication-coverage';\n"+s.replace('[value.position],\n            meta,','[value.position],\n            scalarFrameMetadata(installed, slot, meta),'))
edit('internals/causal-runtime/tree-realization-adapter.ts',lambda s:"import { scalarFrameMetadata } from '../scalar-publication-coverage';\n"+s.replace("[effect.owner],{...getActiveWriteContext(),intent:'system',participation:'realized'}", "[effect.owner],scalarFrameMetadata(scalarResult,slots.resolveScalarSlot(effect.owner),{...getActiveWriteContext(),intent:'system',participation:'realized'})",1).replace('''              {
                ...(getActiveWriteContext() ?? {}),
                intent: 'system',
                participation: 'realized',
              }''','''              scalarFrameMetadata(installedScalars, slots.resolveScalarSlot(effect.owner), {
                ...(getActiveWriteContext() ?? {}),
                intent: 'system',
                participation: 'realized',
              })''',1).replace('''      install();

      for (const effect of effects)''','''      const installedScalars = install();

      for (const effect of effects)''',1).replace('''          {
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          }
        );''','''          scalarFrameMetadata(installedScalars, scalarSlotRuntime.resolveScalarSlot(effect.owner), {
            ...(getActiveWriteContext() ?? {}),
            intent: 'system',
            participation: 'realized',
          })
        );''',1))
