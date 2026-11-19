from pathlib import Path
r=Path('/private/tmp/st-c28-r3-dynamic-admission-repair/candidate/packages/kernel/src')
p=r/'lib/internals/mutation-capture-runtime.ts';s=p.read_text();anchor='export interface MutationCaptureRuntime {';s=s.replace(anchor,'''/** Existing scalar authority producer; ordinary source attachment owns routing only. */
export type ScalarResponsibilityPreparer = (
 path:string,next:unknown,prev:unknown,meta?:WriteMetadata,ownerPath?:string,
 subjectIds?:number[],positionIds?:number[]
) => TerminalRecordPlan | undefined;

'''+anchor+'\n  prepareScalarResponsibility?: ScalarResponsibilityPreparer;');p.write_text(s)
p=r/'lib/internals/scalar-responsibility-attachment.ts';p.write_text('''import { prepareTerminalMutations } from './intrinsic-mutation';
import type { MutationCaptureRuntime, ScalarResponsibilityPreparer } from './mutation-capture-runtime';
import { getOwnedOwnerPath, getOwnedPositionIds, getOwnedSubjectIds } from './owned-metadata';
import { getActiveWriteContext } from '../write-context';

/** An absent provider must not reserve the source's single terminal slot. */
export function attachScalarResponsibility(
 node:object,runtime:MutationCaptureRuntime|undefined,path:string,
 isActive?:()=>boolean,ownerPathOverride?:string
): (()=>void)|undefined {
 if(!runtime?.prepareScalarResponsibility)return;
 const release=prepareTerminalMutations(node,mutation=>{
  if(!mutation.changed||(isActive&&!isActive()))return;
  const prepare=runtime.prepareScalarResponsibility;
  if(!prepare)return;
  return prepare(path,mutation.after,mutation.before,
   {...(getActiveWriteContext()??{}),mutationIntent:mutation.intent},
   ownerPathOverride??getOwnedOwnerPath(node)??path,getOwnedSubjectIds(node),getOwnedPositionIds(node));
 });
 if(!release)throw new Error('Scalar responsibility source is not registered');
 let active=true;
 return ()=>{if(!active)return;active=false;release();};
}

export function registerScalarResponsibility(
 runtime:MutationCaptureRuntime,prepare:ScalarResponsibilityPreparer
):()=>void {
 if(runtime.prepareScalarResponsibility)throw new Error('Scalar responsibility provider already owned');
 runtime.prepareScalarResponsibility=prepare;
 let active=true;
 return ()=>{if(!active)return;active=false;if(runtime.prepareScalarResponsibility===prepare)delete runtime.prepareScalarResponsibility;};
}
''')
p=r/'lib/internals/owned-mutation.ts';s=p.read_text();s="import { attachScalarResponsibility } from './scalar-responsibility-attachment';\n"+s
s=s.replace('  return releaseIntrinsicObserver;\n}', '''  let releaseTerminal:(()=>void)|undefined;
  try { releaseTerminal=attachScalarResponsibility(leaf as object,options.captureRuntime,options.path,hooks.isActive); }
  catch(error){releaseIntrinsicObserver();throw error;}
  let active=true;
  return ()=>{if(!active)return;active=false;try{releaseTerminal?.();}finally{releaseIntrinsicObserver();}};
}''');p.write_text(s)
p=r/'lib/internals/intercept-leaf-signals.ts';s=p.read_text();s="import { attachScalarResponsibility } from './scalar-responsibility-attachment';\nimport type { MutationCaptureRuntime } from './mutation-capture-runtime';\n"+s
s=s.replace('options: { maxDepth?: number;', 'options: { scalarResponsibility?: MutationCaptureRuntime; maxDepth?: number;')
start=s.index('    const release = normal ? observeIntrinsicMutations');end=s.index('\n  };',start);body=s[start:end]
body=body.replace('restorers.push(', 'attached.push(')
# Own each observer immediately, so any later attachment failure can unwind it.
body=body.replace('    const terminalRecord = options.terminalRecord;', '''    if(release)attached.push(release);
    const scalarRelease=attachScalarResponsibility(node,options.scalarResponsibility,path,undefined,ownerPathOverride);
    if(scalarRelease)attached.push(scalarRelease);
    const terminalRecord = options.terminalRecord;''')
body=body.replace('    if (release) attached.push(release);','')
s=s[:start]+'''    const attached:Array<()=>void>=[];
    try {
'''+body+'''
      restorers.push(...attached);
    } catch(error){for(const release of attached.reverse())release();throw error;}
'''+s[end:]
s=s.replace('  } catch {\n    // Ignore traversal errors; partial interception is still useful.', '''  } catch(error) {
    if(options.scalarResponsibility){
      for(const restore of restorers.reverse())restore();
      restorers.length=0;
      throw error;
    }
    // Ignore traversal errors; partial interception is still useful.''')
p.write_text(s)
p=r/'enhancers/transactions/transactions.ts';s=p.read_text();s="import { registerScalarResponsibility } from '../../lib/internals/scalar-responsibility-attachment';\nimport type { ScalarResponsibilityPreparer } from '../../lib/internals/mutation-capture-runtime';\n"+s
start=s.index('          terminalRecord: (');end=s.index('          beforePublication:',start);block=s[start:end];fn=block[len('          terminalRecord: '):].rstrip();assert fn.endswith(',');fn=fn[:-1]
s=s[:start]+'          scalarResponsibility: sourceCaptureRuntime,\n'+s[end:]
anchor='      restoreLeafInterceptors = interceptLeafSignals('
s=s.replace(anchor,'''      const prepareScalarResponsibility:ScalarResponsibilityPreparer = '''+fn+''';
      let releaseScalarResponsibility:(()=>void)|undefined;
      try {
        if(sourceCaptureRuntime)releaseScalarResponsibility=registerScalarResponsibility(sourceCaptureRuntime,prepareScalarResponsibility);
'''+anchor)
anchor="\n      if (typeof notifier.onFlush === 'function') {"
s=s.replace(anchor,'''\n        if(releaseScalarResponsibility)tree.registerCleanup(releaseScalarResponsibility);
      }catch(error){scalarAttachmentFailed=true;releaseScalarResponsibility?.();throw error;}
'''+anchor,1)
s=s.replace('  let restoreLeafInterceptors: (() => void) | null = null;', '  let restoreLeafInterceptors: (() => void) | null = null;\n  let scalarAttachmentFailed=false;')
s=s.replace('  } catch {\n    // fall through without capture support', '  } catch(error) {\n    if(scalarAttachmentFailed)throw error;\n    // fall through without capture support')
p.write_text(s)
