from pathlib import Path
root=Path(__file__).parent/'candidate/packages/kernel/src'
def edit(p,fn):
 f=root/p;s=f.read_text();n=fn(s);assert n!=s,p;f.write_text(n)
# One internal preparation option, on both transport layers and both call variants.
for p in ['lib/internals/tree-scalar-slot-port.ts','lib/internals/tree-scalar-leaf-runtime.ts','lib/internals/native-tree-scalar-leaf-runtime.ts','lib/internals/tree-scalar-slot-runtime.ts']:
 def change(s):
  s=s.replace('advanceRevision?: boolean; publicationPhase?: PublicationPreparation', "advanceRevision?: boolean; publicationPhase?: PublicationPreparation; admissionParticipation?: 'realized'")
  s=s.replace('advanceRevision: options?.advanceRevision, publicationPhase: options?.publicationPhase,','advanceRevision: options?.advanceRevision, publicationPhase: options?.publicationPhase, admissionParticipation: options?.admissionParticipation,')
  if p.endswith('tree-scalar-slot-runtime.ts'):
   s=s.replace('options?:{advanceRevision?:boolean}',"options?:{advanceRevision?:boolean; publicationPhase?:PublicationPreparation; admissionParticipation?:'realized'}")
   s=s.replace('const base=getCommittedRevision();\n    const changed=collectSlotChanges(staged);',"// Capture this frame's classification before callback-capable equality.\n    const admissionParticipation=options?.admissionParticipation;\n    const base=getCommittedRevision();\n    const changed=collectSlotChanges(staged);")
   s=s.replace("const mutation = {intent:'replace' as const, before,", "const mutation = {admissionParticipation,intent:'replace' as const, before,")
  return s
 edit(p,change)
edit('lib/internals/intrinsic-mutation.ts',lambda s:s.replace('export interface IntrinsicMutation<T> {',"export interface IntrinsicMutation<T> {\n  /** Classification of this prepared attempt only; never an ambient write scope. */\n  readonly admissionParticipation?: 'realized';"))
(root/'lib/internals/scalar-admission-metadata.ts').write_text('''import type { WriteMetadata } from '../types';
import type { IntrinsicMutation } from './intrinsic-mutation';

/** Derive admission metadata without rebinding context visible to callbacks. */
export function scalarAdmissionMetadata(
  meta: WriteMetadata | undefined,
  mutation: IntrinsicMutation<unknown>
): WriteMetadata {
  return {
    ...(meta ?? {}),
    mutationIntent: mutation.intent,
    ...(mutation.admissionParticipation === 'realized'
      ? { participation: 'realized' as const }
      : {}),
  };
}
''')
edit('lib/internals/intercept-leaf-signals.ts',lambda s:"import { scalarAdmissionMetadata } from './scalar-admission-metadata';\n"+s.replace('withMutationIntent(getActiveWriteContext(),mutation.intent),ownerPathOverride', 'scalarAdmissionMetadata(getActiveWriteContext(),mutation),ownerPathOverride'))
def tx(s):
 s="import { scalarAdmissionMetadata } from '../../lib/internals/scalar-admission-metadata';\n"+s
 s=s.replace('    const recorded = resolveTransactionId(meta);\n    if (','    const recorded = resolveTransactionId(meta);\n    // Realized external input is not authored notification replay.\n    if (\n      getWriteParticipation(meta) !== \'realized\' &&')
 s=s.replace('const meta=getActiveWriteContext(),position=getOwnedPositionIds(node)?.[0];',"const active=getActiveWriteContext();\n    const meta=mutation.admissionParticipation?scalarAdmissionMetadata(active,mutation):active,position=getOwnedPositionIds(node)?.[0];")
 s=s.replace('advanceRevision: false,\n                    publish: false,',"advanceRevision: false,\n                    publish: false,\n                    admissionParticipation: 'realized',")
 s=s.replace('turn:turns?.get(owner)}))),','turn:turns?.get(owner)})),undefined,\'realized\'),')
 return s
edit('enhancers/transactions/transactions.ts',tx)
def adapter(s):
 # Every explicit scalar frame producer; existing endpoint scopes unchanged.
 s=s.replace('advanceRevision:false,publish:false,publicationPhase}',"advanceRevision:false,publish:false,publicationPhase,admissionParticipation:'realized'}")
 s=s.replace('advanceRevision: false, publish: false,publicationPhase }',"advanceRevision: false, publish: false,publicationPhase,admissionParticipation:'realized' }")
 s=s.replace('publish:false,publicationPhase:outerPhase}',"publish:false,publicationPhase:outerPhase,admissionParticipation:'realized'}")
 s=s.replace('turn:effect.turn})), publicationPhase)',"turn:effect.turn})), publicationPhase, 'realized')")
 s=s.replace('memberTargets, scalarEffects, publicationPhase)',"memberTargets, scalarEffects, publicationPhase, 'realized')")
 return s
edit('lib/internals/causal-runtime/tree-realization-adapter.ts',adapter)
edit('lib/internals/plain-branch-membership.ts',lambda s:s.replace('  outerPhase?: PublicationPreparation\n): {',"  outerPhase?: PublicationPreparation,\n  admissionParticipation?: 'realized'\n): {").replace('publish: false, publicationPhase: phase }','publish: false, publicationPhase: phase, admissionParticipation }'))
edit('enhancers/restoration/restoration.ts',lambda s:s.replace('prepareCommit?.({advanceRevision:false,publish:false})',"prepareCommit?.({advanceRevision:false,publish:false,admissionParticipation:'realized'})").replace('turn:turns?.get(owner)}))),',"turn:turns?.get(owner)})),undefined,'realized'),"))
print('implemented explicit preparation metadata; no new ambient scope')
