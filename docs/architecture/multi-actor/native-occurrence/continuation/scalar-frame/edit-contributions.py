from pathlib import Path
r=Path('/private/tmp/st-scalar-frame-publication-successor/candidate/packages/kernel/src/lib')
p=r/'internals/scalar-publication-coverage.ts';s=p.read_text().replace("const COVERAGE = Symbol('ScalarPublicationCoverage');", "const COVERAGE = Symbol('ScalarPublicationCoverage');\nconst CONTRIBUTIONS = Symbol('ScalarNotificationContributions');\nexport type ScalarNotificationContribution = Readonly<{meta:WriteMetadata; value:unknown; revision:number}>;").replace('readonly [COVERAGE]?: readonly object[]','readonly [COVERAGE]?: readonly object[]; readonly [CONTRIBUTIONS]?: readonly ScalarNotificationContribution[]')
s=s.replace('return withScalarPublicationCoverage(merged, a && b ? a.filter(channel => b.includes(channel)) : undefined);','''const result: Covered = withScalarPublicationCoverage(merged, a && b ? a.filter(channel => b.includes(channel)) : undefined);
  const l=(left as Covered)[CONTRIBUTIONS], r=(right as Covered)[CONTRIBUTIONS];
  return l && r ? {...result,[CONTRIBUTIONS]:[...l,...r]} : result;''')
s+='''
/** Capture before batching; values are notification payloads, never late reads. */
export function stampScalarNotification(meta:WriteMetadata|undefined,value:unknown,revision:number):WriteMetadata {
  const original:Covered={...meta};
  delete (original as {[CONTRIBUTIONS]?:unknown})[CONTRIBUTIONS];
  const result:Covered={...original,[CONTRIBUTIONS]:[{meta:original,value,revision}]};
  return result;
}
export function scalarNotificationContributions(meta:WriteMetadata|undefined):readonly ScalarNotificationContribution[]|undefined {
  return (meta as Covered|undefined)?.[CONTRIBUTIONS];
}
''';p.write_text(s)
p=r/'experimental-publication/private.ts';s="import { stampScalarNotification } from '../internals/scalar-publication-coverage';\n"+p.read_text();s=s.replace('const facts=new WeakSet<object>();','const facts=new WeakSet<object>();\nconst scalarFacts=new WeakSet<object>();',1).replace('mutation.publicationPredecessors?.set(channel,fact);','scalarFacts.add(fact);\n mutation.publicationPredecessors?.set(channel,fact);',1).replace('):WriteMetadata{return {...meta};}','):WriteMetadata{return stampScalarNotification(meta,_payload,serial);}',1)
s+='''
/** A later installed fact for this exact source contribution supersedes an
 * older legacy ping. Aggregate/current revisions and sibling writes do not. */
export function scalarContributionIsCurrent(channel:object,relative:readonly string[],observedRevision:number):boolean {
 const b=bindings.get(channel);if(!b)return false;
 const field=b.aggregate?fieldAt(b.fieldTrie,relative)?.field:undefined;
 const fact=b.aggregate?(field?b.fieldFacts.get(field):undefined):b.valueFact;
 return !fact || !scalarFacts.has(fact) || fact.revision<=observedRevision;
}
'''
s=s.replace('b.current=fact;b.projected=Object.freeze({fact,payload,changed:true});','b.current=fact;b.projected=Object.freeze({fact,payload:b.aggregate?maskPayload(b):payload,changed:true});',1);p.write_text(s)
p=r/'link.ts';s=p.read_text().replace('import { scalarPublicationCovers }','import { scalarPublicationCovers, scalarNotificationContributions }',1)
s=s.replace('''      researchFact =
        relative.length === 0 ? research.evidence(meta) : undefined;
      eligible = applyAtRelativePath(eligible, relative, v);
      researchFact = research.project(consequenceKey, meta, eligible, relative);
      dirty = true;
      observeLink();''','''      const contributions=scalarNotificationContributions(meta);
      if(contributions){
        for(const contribution of contributions){
          if(scalarPublicationCovers(contribution.meta,consequenceKey) ||
             !research.scalarContributionIsCurrent(consequenceKey,relative,contribution.revision))continue;
          eligible=applyAtRelativePath(eligible,relative,contribution.value);
          researchFact=research.project(consequenceKey,contribution.meta,eligible,relative);
        }
      }else{
        researchFact = relative.length === 0 ? research.evidence(meta) : undefined;
        eligible = applyAtRelativePath(eligible, relative, v);
        researchFact = research.project(consequenceKey, meta, eligible, relative);
      }
      dirty = true;
      observeLink();''',1);p.write_text(s)
