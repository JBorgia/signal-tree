from pathlib import Path
p=Path(__file__).parent/'optimized/packages/kernel/src/lib'
f=p/'allocation-diagnostic.ts';s=f.read_text();s+='''\n// Additional ownership-site counts. Reflection here is diagnostic only.
export function ownedArray<T>(site:string,value:T[]):T[]{return countedArray('ownership-copy:'+site,value);}
export function sealed<T extends object>(value:T):Readonly<T>{
 const c=at('ownership-sealing') as Counts & {operations:number;slots:number};
 c.operations=(c.operations??0)+1;c.slots=(c.slots??0)+Reflect.ownKeys(value).length;
 return Object.freeze(value);
}
export function ownershipMark(site:string):void{const c=at('ownership-mark:'+site) as Counts & {operations:number};c.operations=(c.operations??0)+1;}
''';f.write_text(s)
f=p/'internals/entity-publication.ts';s=f.read_text();start=s.index('class AdmissionMetadata');end=s.index('/** Opaque source-issued support;',start);part=s[start:end]
part=part.replace('Object.freeze(', 'sealed(')
part=part.replace('[...edit.fields]',"ownedArray('fields',[...edit.fields])").replace('[...edits]',"ownedArray('membership',[...edits])").replace('[...footprint.fields]',"ownedArray('footprint-fields',[...footprint.fields])").replace('[...packet.ordinaryOrder]',"ownedArray('ordinary-order',[...packet.ordinaryOrder])").replace('[...packet.physicalOrder]',"ownedArray('physical-order',[...packet.physicalOrder])")
part=part.replace('const steps=packet.steps?.map(step=>{',"const steps=packet.steps?ownedArray('steps',packet.steps.map(step=>{").replace('    });\n    const result=', '    })):undefined;\n    const result=')
for op in ['edits.has(edit)','edits.add(edit)','arrays.has(edits)','arrays.add(result)','packets.has(packet)','packets.add(result)']:
 part=part.replace('this.'+op, "(ownershipMark('"+op.split('(')[0]+"'),this."+op+")")
part=part.replace('  private readonly edits',"  constructor(){ownershipMark('weakset-constructor');ownershipMark('weakset-constructor');ownershipMark('weakset-constructor');}\n  private readonly edits")
s=s[:start]+part+s[end:];s="import {ownedArray,sealed,ownershipMark} from '../allocation-diagnostic';\n"+s;f.write_text(s)
