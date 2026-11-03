import {expect,it} from 'vitest';
import {entityMap,restoration,signalTree,transactions,undoable} from '../index';
const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
type Row={id:string|number;name:string};
it('public undo/redo removes numeric destination before restoring rekey; string key remains independent',async()=>{
 const t=signalTree({rows:entityMap<Row,string|number>()},{enhancers:[restoration()]});
 try{
 t.$.rows.addOne({id:2,name:'original'});t.$.rows.addOne({id:'2',name:'string'});await drain();
 const original=t.$.rows.byIdOrFail(2),string=t.$.rows.byIdOrFail('2');
 undoable(()=>{t.$.rows.changeId(2,1);t.$.rows.addOne({id:2,name:'new'});});await drain();
 const added=t.$.rows.byIdOrFail(2);expect(t.$.rows.ids()).toEqual([1,'2',2]);expect(added).not.toBe(original);
 t.undo();await drain();expect(t.$.rows.ids()).toEqual([2,'2']);expect(t.$.rows.byIdOrFail(2)).toBe(original);expect(original.name()).toBe('original');expect(t.$.rows.byIdOrFail('2')).toBe(string);expect(string.name()).toBe('string');expect(added()).toBeUndefined();expect(t.canRedo()).toBe(true);
 t.redo();await drain();expect(t.$.rows.ids()).toEqual([1,'2',2]);expect(t.$.rows.byIdOrFail(1)).toBe(original);expect(t.$.rows.byIdOrFail(2)).toBe(added);expect(added.name()).toBe('new');expect(t.$.rows.byIdOrFail('2')).toBe(string);
 }finally{t.destroy();}
});
it('public rollback removes numeric destination before restoring rekey; string key remains independent',async()=>{
 const t=signalTree({rows:entityMap<Row,string|number>()},{enhancers:[transactions()]});
 try{
 t.$.rows.addOne({id:2,name:'original'});t.$.rows.addOne({id:'2',name:'string'});await drain();
 const original=t.$.rows.byIdOrFail(2),string=t.$.rows.byIdOrFail('2');
 const p=t.transact(()=>{t.$.rows.changeId(2,1);t.$.rows.addOne({id:2,name:'new'});});await drain();
 const added=t.$.rows.byIdOrFail(2);expect(t.$.rows.ids()).toEqual([1,'2',2]);
 p.rollback();await drain();expect(t.$.rows.ids()).toEqual([2,'2']);expect(t.$.rows.byIdOrFail(2)).toBe(original);expect(original.name()).toBe('original');expect(t.$.rows.byIdOrFail('2')).toBe(string);expect(string.name()).toBe('string');expect(added()).toBeUndefined();
 }finally{t.destroy();}
});
