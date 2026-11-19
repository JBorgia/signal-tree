import {signalTree,entityMap,transactions} from '@signal-tree/kernel';
export const tree=signalTree({rows:entityMap()},{enhancers:[transactions()]});
tree.$.rows.setAll([{id:'r',x:0}]);
export const row=tree.$.rows.byIdOrFail('r');
export const pending=tree.transact(()=>row.x(7));
