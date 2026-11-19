from pathlib import Path
root=Path('/private/tmp/st-packet-index-admission-r1/candidate/packages/kernel/src/lib')
f=root/'experimental-publication/entity.ts';s=f.read_text();a=s.index('/** Check only source-owned');b=s.index('/** Only current support',a);s=s[:a]+s[b:]
s=s.replace('      const validateAdmission=captureAdmissionStructure(packet);\n','').replace('      validateAdmission();\n','').replace('        validateAdmission();\n','')
s=s.replace('const ordinaryEdits=packet.steps?entityPublicationOrdinary(packet):packet.ordinary.slice();','const ordinaryEdits=entityPublicationOrdinary(packet);')
s=s.replace('const lastOrdinaryBySubject=new Map<number,EntityPublicationEdit>();\n      for(const edit of ordinaryEdits)lastOrdinaryBySubject.set(edit.subject,edit);\n      const ordinarySubjects=[...lastOrdinaryBySubject.keys()];','const singleton=ordinaryEdits.length===1?ordinaryEdits[0]:undefined;\n      const lastOrdinaryBySubject=singleton?undefined:new Map<number,EntityPublicationEdit>();\n      if(lastOrdinaryBySubject)for(const edit of ordinaryEdits)lastOrdinaryBySubject.set(edit.subject,edit);')
s=s.replace('const edit=lastOrdinaryBySubject.get(subject);','const edit=singleton?.subject===subject?singleton:lastOrdinaryBySubject?.get(subject);')
s=s.replace('...ordinarySubjects','...(singleton?[singleton.subject]:lastOrdinaryBySubject!.keys())')
f.write_text(s)
f=root/'internals/entity-publication.ts';s=f.read_text();pos=s.index('/** Opaque source-issued support;')
helper='''/** Private ownership boundary: metadata is source-owned, row payloads and proof
 * objects are not. Weak marks avoid reprocessing queued point fragments; they
 * contain no values, certificates or revision authority and do not retain keys.
 */
class AdmissionMetadata {
  private readonly edits = new WeakSet<EntityPublicationEdit>();
  private readonly arrays = new WeakSet<readonly EntityPublicationEdit[]>();
  private readonly packets = new WeakSet<EntityPublicationPacket>();
  private edit(edit: EntityPublicationEdit): void {
    if (this.edits.has(edit)) return;
    // Native producers supply mutable shells. Copy shared metadata before locking
    // that same edit identity. Already frozen private shells transfer ownership
    // of their metadata too; no public API accepts publication packets.
    if (!Object.isFrozen(edit)) {
      if (edit.fields) Object.defineProperty(edit,'fields',{value:Object.freeze([...edit.fields]),enumerable:true});
      if (edit.structural) Object.defineProperty(edit,'structural',{value:Object.freeze({...edit.structural}),enumerable:true});
    } else {
      if (edit.fields) Object.freeze(edit.fields);
      if (edit.structural) Object.freeze(edit.structural);
    }
    Object.freeze(edit);
    this.edits.add(edit);
  }
  private array(edits: readonly EntityPublicationEdit[]): readonly EntityPublicationEdit[] {
    if (this.arrays.has(edits)) return edits;
    for (const edit of edits) this.edit(edit);
    const result=Object.freeze([...edits]);
    this.arrays.add(result);
    return result;
  }
  prepare(packet:EntityPublicationPacket):EntityPublicationPacket {
    if(this.packets.has(packet))return packet;
    const steps=packet.steps?.map(step=>{
      if(step.authoredRemoval)this.edit(step.authoredRemoval);
      const footprint=step.authoredFootprint;
      return Object.freeze({...step,
        authoredFootprint:footprint?Object.freeze(footprint.kind==='fields'?{...footprint,fields:Object.freeze([...footprint.fields])}:{...footprint}):undefined,
        ordinary:this.array(step.ordinary),physical:step.physical?this.array(step.physical):undefined});
    });
    const result=Object.freeze({...packet,ordinary:this.array(packet.ordinary),physical:this.array(packet.physical),
      steps:steps?Object.freeze(steps):undefined,
      ordinaryOrder:packet.ordinaryOrder?Object.freeze([...packet.ordinaryOrder]):undefined,
      physicalOrder:packet.physicalOrder?Object.freeze([...packet.physicalOrder]):undefined});
    this.packets.add(result);
    return result;
  }
}
'''
s=s[:pos]+helper+s[pos:];s=s.replace('  private native: EntityPublicationParticipant | undefined;','  private readonly admission = new AdmissionMetadata();\n  private native: EntityPublicationParticipant | undefined;')
s=s.replace('    group.state.packets.push(packet);return group.publication;','    group.state.packets.push(this.admission.prepare(packet));return group.publication;')
s=s.replace('    const native = this.nativeParticipant();\n    const nativeUnit', '    packet=this.admission.prepare(packet);\n    const native = this.nativeParticipant();\n    const nativeUnit')
f.write_text(s)
