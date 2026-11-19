# Run once after instrument.py in a fresh allocation-final copy.
from pathlib import Path
f=Path(__file__).parent/'optimized/packages/kernel/src/lib/experimental-publication/entity.ts';s=f.read_text()
s=s.replace('stepOrder=steps?.slice();',"stepOrder=steps?countedArray('admission-step-order',steps.slice()):undefined;")
s=s.replace('entries=original?.slice()??[];',"entries=countedArray('admission-edit-membership',original?.slice()??[]);")
s=s.replace('const removals=stepOrder?.map(step=>{',"const removals=stepOrder?countedArray('admission-removals',stepOrder.map(step=>{")
s=s.replace('    return removal;\n  });','    return removal;\n  })):undefined;\n  countedArray(\'admission-array-descriptors\',arrays);')
s=s.replace('entityPublicationOrdinary(packet):packet.ordinary.slice();',"entityPublicationOrdinary(packet):countedArray('ordinary-point-copy',packet.ordinary.slice());")
s=s.replace('const ordinarySubjects=[...lastOrdinaryBySubject.keys()];',"const ordinarySubjects=countedArray('ordinary-subjects',[...lastOrdinaryBySubject.keys()]);")
f.write_text(s)
