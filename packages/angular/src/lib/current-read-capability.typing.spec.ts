import type {Signal} from '@angular/core';
import {entityMap, signalTree} from '../index';
const tree = signalTree({rows:entityMap<{id:string}, string>()});
const id: Signal<string | undefined> = tree.$.rows.activeId;
const rows: Signal<readonly {id:string}[]> = tree.$.rows.all;
void id; void rows; tree.destroy();
