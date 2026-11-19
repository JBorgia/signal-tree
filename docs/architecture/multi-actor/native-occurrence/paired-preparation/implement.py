from pathlib import Path
b=Path('/private/tmp/st-prepared-paired-successor/candidate/packages/kernel/src')
p=b/'lib/internals/selected-write-operation.ts';s=p.read_text();start=s.index('export interface SelectedRowEdit');end=s.index('export interface SelectedInstallation');s=s[:start]+'''/** Intercepted semantic intent, before producer-owned ordinary composition. */
export interface SelectedRowIntent {
 readonly source:object; readonly subject:number; readonly key:string|number;
 readonly physicalBefore:unknown; readonly physicalAfter:unknown;
 readonly fields:readonly string[] | null;
 readonly selections:ReadonlyMap<string,NativeFieldEndpoint>;
 readonly prepare:(edits:readonly SelectedRowIntent[])=>SelectedInstallation;
}
export interface SelectedRowEdit extends SelectedRowIntent {
 readonly ordinaryBefore:unknown; readonly ordinaryAfter:unknown;
}
'''+s[end:];s=s.replace('stage(edit:SelectedRowEdit)','stage(edit:SelectedRowIntent)');p.write_text(s)
p=b/'lib/internals/causal-runtime/tree-realization-adapter.ts';s=p.read_text().replace('SelectedRowEdit','SelectedRowIntent');p.write_text(s)
p=b/'lib/physical/entity-value-store.ts';s=p.read_text();s=s.replace('edits: readonly EntityRealizationEdit[]\n  ): EntityValueTransition<E>', 'edits: readonly EntityRealizationEdit[],\n    previous?: EntityValueTransition<E>\n  ): EntityValueTransition<E>');s=s.replace('const physicalBefore = this.retainedEntities.get(subject);\n    const ordinaryBefore =\n      this.inspectionBaselines.get(subject) ?? physicalBefore;','const physicalBefore = previous?.physicalAfter ?? this.retainedEntities.get(subject);\n    const ordinaryBefore =\n      previous?.ordinaryAfter ?? this.inspectionBaselines.get(subject) ?? physicalBefore;');p.write_text(s)
p=b/'lib/entity-signal.ts';s=p.read_text();s=s.replace('import type { SelectedRowEdit', 'import type { SelectedRowIntent, SelectedRowEdit') if 'import type { SelectedRowEdit' in s else s
# accommodate actual import formatting
if 'SelectedRowIntent' not in s:
 s=s.replace('SelectedRowEdit,', 'SelectedRowIntent, SelectedRowEdit,',1)
start=s.index('  function prepareSelectedRows(');end=s.index('  /** Existing-lifetime',start)
s=s[:start]+'''  function prepareSelectedRows(operations: readonly SelectedRowIntent[]) {
    const rows = new Map<number,{subjectId:number;key:string|number;value:unknown;edits:EntityRealizationEdit[];transition:EntityValueTransition<E>}>();
    const steps: SelectedRowEdit[] = [];
    for (const operation of operations) {
      const previous=rows.get(operation.subject);
      const before=previous?.transition.physicalAfter ?? operation.physicalBefore;
      const after=(operation.fields===null ? {...(operation.physicalAfter as object)} : {...(before as object)}) as Record<string,unknown>;
      const edits:EntityRealizationEdit[]=[];
      if(operation.fields===null) edits.push({kind:'row',value:after});
      else for(const field of operation.fields){
        const present=Object.prototype.hasOwnProperty.call(operation.physicalAfter,field);
        const value=present?(operation.physicalAfter as Record<string,unknown>)[field]:undefined;
        if(present)Object.defineProperty(after,field,{value,enumerable:true,configurable:true,writable:true});else delete after[field];
        edits.push({kind:'field',field,present,value,selection:operation.selections.get(field)});
      }
      const transition=valueStore.prepareRealizationTransition(operation.subject,after as E,edits,previous?.transition);
      rows.set(operation.subject,{subjectId:operation.subject,key:operation.key,value:after,edits:[...(previous?.edits??[]),...edits],transition});
      steps.push({...operation,physicalBefore:before,physicalAfter:after,ordinaryBefore:transition.ordinaryBefore,ordinaryAfter:transition.ordinaryAfter});
    }
    return preparePointValues([...rows.values()],steps);
  }
  function stageSelected(id:K, before:E, after:E, fields:readonly string[] | null, selection:ClaimedFieldEndpoint):void {
    const selections=selectedInverseField(selection,selection.subject,after,id)!;
    selection.preparation!.stage({source:entityPublication,subject:selection.subject,key:id,physicalBefore:before,physicalAfter:after,fields,selections,prepare:prepareSelectedRows});
  }

'''+s[end:]
s=s.replace('edits: readonly EntityRealizationEdit[];\n    }[],','edits: readonly EntityRealizationEdit[];\n      transition?: EntityValueTransition<E>;\n    }[],',1).replace('values.map(({ subjectId, key, value, edits })','values.map(({ subjectId, key, value, edits, transition })',1).replace('transition: valueStore.prepareRealizationTransition(','transition: transition ?? valueStore.prepareRealizationTransition(',1)
start=s.index('    const publication=prepareEntityPublication(',s.index('function preparePointValues'));end=s.index('    if(selectedSteps)',start)
s=s[:start]+'''    const ordinarySteps=selectedSteps?.map(step=>({subject:step.subject,before:step.ordinaryBefore,after:step.ordinaryAfter,fields:step.fields,restoredFields:step.selections}));
    const publication=prepareEntityPublication(
      prepared.map(row=>({subject:row.subjectId,before:row.before,after:row.after,fields:publicationFields(row.before,row.after)})),
      ordinarySteps ?? prepared.map(row=>({subject:row.subjectId,before:row.transition.ordinaryBefore,after:row.transition.ordinaryAfter,fields:publicationFields(row.transition.ordinaryBefore,row.transition.ordinaryAfter),restoredFields:new Map(row.edits.flatMap(edit=>edit.kind==='field'&&edit.selection?[[edit.field,edit.selection] as const]:[]))})),undefined,undefined,true,
      selectedSteps?.map((step,ordinal)=>({ordinal,authoredFootprint:authoredFootprint(step.fields),physical:[{subject:step.subject,before:step.physicalBefore,after:step.physicalAfter,fields:step.fields}],ordinary:[ordinarySteps![ordinal]!]}))
    );
'''+s[end:]
s=s.replace('for(const field of step.fields)if(Object.prototype.hasOwnProperty.call(step.after,field))','for(const field of step.fields??Object.keys(step.physicalAfter as object))if(Object.prototype.hasOwnProperty.call(step.physicalAfter,field))').replace('(step.after as Record<string,unknown>)','(step.physicalAfter as Record<string,unknown>)').replace('step.after as E','step.physicalAfter as E')
start=s.index('  function replaceOnePrivate');end=s.index('  function validateSelectedEntry',start);part=s[start:end];part=part.replace('let next = entity;', 'let next = entity;\n      let interceptorReplaced = false;').replace('next = value as E;', 'interceptorReplaced = true;\n            next = value as E;');part=part.replace('const fields=[...new Set([...(publicationFields(prev,materialized)??[]),inverseClaim.field])];','// Row-shaped certified removal is not whole authorship. An explicit\n        // public replacement transform retains its whole authored domain.\n        const fields=interceptorReplaced ? null : [inverseClaim.field];');s=s[:start]+part+s[end:];p.write_text(s)
