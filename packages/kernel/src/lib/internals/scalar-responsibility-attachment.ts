import { scalarAdmissionMetadata } from './scalar-admission-metadata';
import { prepareTerminalMutations } from './intrinsic-mutation';
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
   scalarAdmissionMetadata(getActiveWriteContext(),mutation),
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
