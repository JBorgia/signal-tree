from pathlib import Path
import shutil
c=Path('/private/tmp/st-c24-equal-owner/candidate/packages/kernel/src'); archive=Path('/private/tmp/st-c24-equal-owner/unexecuted-late-capture-draft');archive.mkdir()
for rel in ['lib/experimental-publication/private.ts','lib/internals/intrinsic-mutation.ts','lib/internals/tree-scalar-slot-runtime.ts','lib/internals/native-scalar-selection.ts','lib/internals/causal-runtime/tree-realization-adapter.ts','enhancers/transactions/transactions.ts']:
 d=archive/rel;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(c/rel,d)
p=c/'lib/internals/intrinsic-mutation.ts';s=p.read_text().replace('export interface TerminalRecordPlan {','export interface TerminalRecordPlan {\n  readonly scalarAdmission?: { readonly effect:object; readonly operationEffect:object };',1).replace("export interface IntrinsicMutation<T> {","export interface IntrinsicMutation<T> {\n  readonly preparedTerminal?: TerminalRecordPlan;",1);p.write_text(s)
p=c/'lib/internals/tree-scalar-slot-runtime.ts';s=p.read_text().replace('prepareScalarSourcePublication(source,mutation);','prepareScalarSourcePublication(source,{...mutation,preparedTerminal:terminal});');p.write_text(s)
p=c/'enhancers/transactions/transactions.ts';s=p.read_text();start=s.index('    return {endpoint,record:{writes:[{map:{set(){');end=s.index('\n  }):undefined;',start)
s=s[:start]+'''    const admission=mutation.preparedTerminal?.scalarAdmission;
    if(!admission)throw new Error('Scalar selection requires prepared admission');
    // These are this attempt's detached effect objects, not installed bucket state.
    bindFieldEndpoints(admission.effect,pair);
    bindFieldEndpoints(admission.operationEffect,{before,after});
    return {endpoint};'''+s[end:]
# only terminal callback return
idx=s.index('          terminalRecord: (');pos=s.index('            return {\n              writes,',idx);s=s[:pos]+s[pos:].replace('            return {\n              writes,','            return {\n              scalarAdmission:{effect:combined,operationEffect:operation.effects[0]!},\n              writes,',1);p.write_text(s)
p=c/'lib/internals/location-runtime.ts';s=p.read_text();s=s.replace('let unit: PreparedPublicationUnit | undefined;\n        const preparePublication', 'let unit: PreparedPublicationUnit | undefined;\n        let terminal: TerminalRecordPlan | undefined;\n        const preparePublication');s=s.replace("after:changed ? next : retained,changed}","after:changed ? next : retained,changed,preparedTerminal:terminal}");s=s.replace("mutationSource2.prepareTerminal?.({intent:","terminal = mutationSource2.prepareTerminal?.({intent:")
# verify TerminalRecordPlan imported
p.write_text(s)
p=c/'lib/internals/native-tree-scalar-leaf-runtime.ts';s=p.read_text();s=s.replace('let unit: PreparedPublicationUnit | undefined;\n      const preparePublication','let unit: PreparedPublicationUnit | undefined;\n      let terminal: TerminalRecordPlan | undefined;\n      const preparePublication');s=s.replace('          changed,\n        });','          changed,\n          preparedTerminal:terminal,\n        });',1);s=s.replace('            changed,\n          },\n          publicationInput','            changed,\n            preparedTerminal:terminal,\n          },\n          publicationInput');s=s.replace('              mutationSource.prepareTerminal?.({','              terminal = mutationSource.prepareTerminal?.({');p.write_text(s)
