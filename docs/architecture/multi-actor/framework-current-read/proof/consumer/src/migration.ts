import {createSignalTreeFactory, type ObservationAdapter} from '@signal-tree/kernel/adapter';
import {signalTree as angularTree, entityMap as angularMap} from '@signal-tree/angular';
import {signalTree as vueTree, entityMap as vueMap} from '@signal-tree/vue';
import {signalTree as solidTree, entityMap as solidMap} from '@signal-tree/solid';
import type {Signal} from '@angular/core';
import type {ComputedRef} from 'vue';
import type {Accessor} from 'solid-js';
// Actual emitted adapter declarations, not source paths or re-declared interfaces.
import {ANGULAR_OBSERVATION_ADAPTER} from '../node_modules/@signal-tree/angular/src/lib/observation-adapter.js';
import {createVueObservationAdapter} from '../node_modules/@signal-tree/vue/src/lib/vue-observation.js';
import {createSolidObservationAdapter} from '../node_modules/@signal-tree/solid/src/lib/solid-observation.js';
const token = () => ({observe() {}, invalidate() {}});
const writable = <T>(read: () => T) => Object.assign(() => read(), {
  set: (_value: T) => {}, update: (_fn: (value: T) => T) => {}, asReadonly: () => read,
});
// Legacy adapters remain structurally assignable because the member is optional;
// their full-trio native runtime configuration is deliberately rejected at binding.
const legacy: ObservationAdapter = {
  createToken: token, runInvalidationGroup: run => run(),
  createWritableCell: <T>(read: () => T) => ({cell:writable(read), peek:read, token:token()}),
  createWritableProjection: <T>(read: () => T) => ({cell:writable(read), peek:read}),
  createReadonlyCell: <T>(read: () => T) => read,
};
const legacyFactoryType: () => ReturnType<typeof createSignalTreeFactory> = () => createSignalTreeFactory(legacy);
void legacyFactoryType;
const migrated: ObservationAdapter = {...legacy, createCurrentReadonlyCell: <T>(read: () => T) => read};
const portable: ObservationAdapter = {createToken:token, runInvalidationGroup:run=>run()};
const partial: ObservationAdapter = {...portable, createReadonlyCell: <T>(read: () => T) => read};
createSignalTreeFactory(migrated); createSignalTreeFactory(portable); createSignalTreeFactory(partial);
for (const adapter of [ANGULAR_OBSERVATION_ADAPTER,createVueObservationAdapter(),createSolidObservationAdapter()]) {
  if (!adapter.createCurrentReadonlyCell) throw new Error('missing native capability');
  const cell = adapter.createCurrentReadonlyCell(() => ({id:'A'}));
  const id: string = cell().id; void id;
}
const a = angularTree({rows:angularMap<{id:string},string>()});
const v = vueTree({rows:vueMap<{id:string},string>()});
const s = solidTree({rows:solidMap<{id:string},string>()});
const angularId: Signal<string|undefined> = a.$.rows.activeId;
const vueId: ComputedRef<string|undefined> = v.$.rows.activeId;
const solidId: Accessor<string|undefined> = s.$.rows.activeId;
const angularRows: Signal<readonly {id:string}[]> = a.$.rows.all;
const vueRows: ComputedRef<readonly {id:string}[]> = v.$.rows.all;
void angularId; void solidId; void angularRows; void vueRows.effect;
// Negative readonly checks: failures must remain part of the consumer contract.
// @ts-expect-error readonly Signal has no setter
angularId.set('B');
// @ts-expect-error ComputedRef value is readonly
vueId.value = 'B';
// @ts-expect-error capability must return a callable source-current cell
const invalid: ObservationAdapter = {...portable,createCurrentReadonlyCell: () => ({value:1})};
void invalid;
a.destroy();v.destroy();s.destroy();
