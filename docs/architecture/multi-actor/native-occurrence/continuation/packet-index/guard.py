from pathlib import Path
p=Path('/private/tmp/st-packet-index-successor/candidate/packages/kernel/src/lib/experimental-publication/entity.ts');s=p.read_text().replace('type EntityPublicationEdit }','type EntityPublicationEdit, type EntityPublicationPacket }')
anchor='/** Only current support identities; values and placement remain native kernel truth. */'
helper='''/** Check only source-owned admission structure, never caller payloads or proof cells.
 * Private callbacks may read the packet; changing its membership/subject/kind
 * invalidates preparation rather than letting a lookup outlive its authority.
 */
function captureAdmissionStructure(packet:EntityPublicationPacket):()=>void {
  const steps=packet.steps,stepOrder=steps?.slice();
  const arrays:{read:()=>readonly EntityPublicationEdit[]|undefined; original:readonly EntityPublicationEdit[]|undefined; entries:readonly EntityPublicationEdit[]}[]=[];
  const edits=new Map<EntityPublicationEdit,{subject:number;structural:EntityPublicationEdit['structural'];kind:EntityPublicationEdit['structural'] extends infer _T ? string|undefined : never}>();
  const remember=(edit:EntityPublicationEdit)=>{if(!edits.has(edit))edits.set(edit,{subject:edit.subject,structural:edit.structural,kind:edit.structural?.kind});};
  const array=(read:()=>readonly EntityPublicationEdit[]|undefined)=>{
    const original=read(),entries=original?.slice()??[];
    arrays.push({read,original,entries});for(const edit of entries)remember(edit);
  };
  array(()=>packet.ordinary);array(()=>packet.physical);
  const removals=stepOrder?.map(step=>{
    array(()=>step.ordinary);array(()=>step.physical);
    const removal=step.authoredRemoval;if(removal)remember(removal);
    return removal;
  });
  return ()=>{
    const changed=()=>{throw new Error('Entity publication admission structure changed during preparation');};
    if(packet.steps!==steps||steps?.length!==stepOrder?.length)changed();
    for(let i=0;i<(stepOrder?.length??0);i++)if(steps![i]!==stepOrder![i]||stepOrder![i].authoredRemoval!==removals![i])changed();
    for(const {read,original,entries}of arrays){
      const current=read();if(current!==original||current?.length!==(original===undefined?undefined:entries.length))changed();
      for(let i=0;i<entries.length;i++)if(current![i]!==entries[i])changed();
    }
    for(const [edit,fact]of edits)if(edit.subject!==fact.subject||edit.structural!==fact.structural||edit.structural?.kind!==fact.kind)changed();
  };
}

'''
helper=helper.replace("EntityPublicationEdit['structural'] extends infer _T ? string|undefined : never","string|undefined")
s=s.replace(anchor,helper+anchor)
s=s.replace('      const ordinaryEdits=entityPublicationOrdinary(packet);', '''      const validateAdmission=captureAdmissionStructure(packet);
      // With steps, the helper already owns its new sequence. Without steps,
      // copy the source array so delayed support cannot observe later mutation.
      const ordinaryEdits=packet.steps?entityPublicationOrdinary(packet):packet.ordinary.slice();''')
s=s.replace('      const selectedFields=new Map<number,Map<string,NativeFieldEndpoint>>();','      const ordinarySubjects=[...lastOrdinaryBySubject.keys()];\n      const selectedFields=new Map<number,Map<string,NativeFieldEndpoint>>();')
s=s.replace('      const responsibility=packet.prepareResponsibility?.(selections);','      const responsibility=packet.prepareResponsibility?.(selections);\n      validateAdmission();')
s=s.replace('...ordinaryEdits.map(edit=>edit.subject)','...ordinarySubjects')
s=s.replace('      return {record:combineTerminalRecords(responsibility,prepared?.record,{writes,deletes,adds:[]})!,completion:inspection?{}:{requirement,support,facts:selected},finalize:prepared?()=>lifecycle.finalizeNativeRequirement(requirement):undefined};', '''      validateAdmission();
      return {record:combineTerminalRecords(responsibility,prepared?.record,{writes,deletes,adds:[]})!,completion:inspection?{}:{requirement,support,facts:selected},finalize:()=>{
        validateAdmission();
        if(prepared)lifecycle.finalizeNativeRequirement(requirement);
        validateAdmission();
      }};''')
p.write_text(s)
