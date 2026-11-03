import type {ComputedRef} from 'vue';
import {entityMap, signalTree} from '../index';
const tree = signalTree({rows:entityMap<{id:string}, string>()});
const id: ComputedRef<string | undefined> = tree.$.rows.activeId;
const rows: ComputedRef<readonly {id:string}[]> = tree.$.rows.all;
void id.effect; void rows.effect; tree.destroy();
