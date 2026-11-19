from pathlib import Path
import subprocess,json
r=Path(__file__).resolve().parent
kernel=['scalar-completion-precedence','entity-registration-original','entity-registration-lifecycle','entity-registration-receipts','scalar-frame-publication','transaction-observer-failure','transaction-safety','tree-realization-adapter','rich-source-completion-boundary','native-group-error-boundary','native-adapter-flush-error','native-epoch-error-drain','realization-admission-metadata','scalar-responsibility-lifecycle','initializer-owned-cleanup','initializer-attachment-independent','dynamic-realization-composition-independent','scalar-native-support','effective-presence-install-reentry']
jobs=[('kernel-controls',['nx','test','kernel',*kernel,'--skip-nx-cache','--maxWorkers=1'])]
for project in ['angular','react','vue','solid']:
 names=['scalar-frame-publication','whole-value-new-keys','entity-native-obligation-composition']
 if project=='react':names+=['branch-declaration-qualification']
 if project=='solid':names+=['native-publication-error-boundary']
 jobs.append((project+'-controls',['nx','test',project,*names,'--skip-nx-cache','--maxWorkers=1']))
jobs += [('source-types',['exec','tsc','--noEmit','-p','tsconfig.typecheck-all.json']),('public-types',['exec','tsc','--noEmit','-p','packages/kernel/tsconfig.typecheck.json']),('spec-types',['exec','node','tools/check-spec-types.mjs'])]
paths=json.loads((r/'AFFECTED-LINT.json').read_text())+['packages/kernel/src/lib/experimental-publication/entity.ts','packages/kernel/src/lib/link.ts','packages/kernel/src/lib/entity-registration-original.spec.ts','packages/kernel/src/lib/entity-registration-lifecycle.spec.ts','packages/kernel/src/lib/entity-registration-receipts.spec.ts','tools/experiments/entity-registration/receipt-cases.ts']+['packages/kernel/src/lib/internals/scalar-completion-precedence.spec.ts','packages/kernel/src/lib/internals/dynamic-realization-composition-independent.spec.ts'];jobs+=[('affected-lint',['exec','eslint',*paths])]
(r/'QUALIFICATION-SCOPE.json').write_text(json.dumps(jobs,indent=2))
for name,args in jobs:
 print('START',name,flush=True)
 with (r/(name+'-runner.log')).open('x') as out:p=subprocess.run(['python3',str(r/'run.py'),'candidate',name,*args],stdout=out,stderr=subprocess.STDOUT)
 result=json.loads((r/'runs'/name/'RESULT.json').read_text());print('END',name,json.dumps(result),flush=True)
 if result['timeout'] or not result['sourceUnchanged']:break
