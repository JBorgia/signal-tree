from pathlib import Path
p=Path(__file__).parent/'optimized/packages/kernel/src/lib'
f=p/'allocation-diagnostic.ts';s=f.read_text();s+='''\nexport function defineMetadata(target:object,key:PropertyKey,descriptor:PropertyDescriptor):void{ownedShell('property-descriptor',descriptor);ownershipMark('defineProperty');Object.defineProperty(target,key,descriptor);}\n''';f.write_text(s)
f=p/'internals/entity-publication.ts';s=f.read_text().replace('ownedShell,ownershipMark}', 'ownedShell,ownershipMark,defineMetadata}')
s=s.replace("Object.defineProperty(edit,", "defineMetadata(edit,")
s=s.replace("sealed(footprint.kind==='fields'?{...footprint,fields:sealed(ownedArray('footprint-fields',[...footprint.fields]))}:{...footprint})", "sealed(ownedShell('footprint',footprint.kind==='fields'?{...footprint,fields:sealed(ownedArray('footprint-fields',[...footprint.fields]))}:{...footprint}))")
f.write_text(s)
f=p/'experimental-publication/entity.ts';s=f.read_text().replace('AllocationMap,countedArray}', 'AllocationMap,countedArray,ownershipMark}')
s=s.replace('const proposal=(subject:number,key:string):NativeFieldEndpoint=>{',"const proposal=(subject:number,key:string):NativeFieldEndpoint=>{ownershipMark('proposal-lookup');")
f.write_text(s)
