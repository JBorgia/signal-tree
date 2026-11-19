import {computed,signal} from '@angular/core';
import {createWatch} from '@angular/core/primitives/signals';
import {computed as vc,shallowRef,watchEffect,effectScope} from 'vue';
import {ANGULAR_OBSERVATION_ADAPTER} from '../packages/angular/src/lib/observation-adapter.ts';
import {createVueObservationAdapter} from '../packages/vue/src/lib/vue-observation.ts';
for (const framework of ['angular','vue']) for (const mode of ['native','current']) {
  let failed = false, calls = 0, delivered: string[] = [];
  const a = signal(0), v = shallowRef(0);
  const recipe = () => {calls++; if (framework==='angular') a(); else void v.value; if (failed) throw new Error('recipe'); return calls;};
  const adapter = framework==='angular' ? ANGULAR_OBSERVATION_ADAPTER : createVueObservationAdapter();
  const nativeA = computed(recipe), nativeV = vc(recipe);
  const current = adapter.createCurrentReadonlyCell!(recipe);
  const read = mode==='current' ? current : framework==='angular' ? nativeA : () => nativeV.value;
  const queued = new Set<ReturnType<typeof createWatch>>();
  const consume = () => {try {read();delivered.push('value');}catch {delivered.push('error');}};
  const scope = effectScope();
  const watcher = framework==='angular' ? createWatch(consume,w=>queued.add(w),false) : undefined;
  if (watcher) watcher.run(); else scope.run(()=>watchEffect(consume,{flush:'sync'}));
  const publish=()=>{if(framework==='angular'){a.update(n=>n+1);for(const w of queued)w.run();queued.clear();}else v.value++;};
  const cold=calls; failed=true; let before=calls,escaped=false;
  try{publish();}catch{escaped=true;}
  const failure=calls-before;failed=false;
  before=calls;publish();const recovery=calls-before;
  watcher?.destroy();scope.stop();
  console.log(JSON.stringify({framework,mode,cold,failure,recovery,escaped,delivered}));
}
