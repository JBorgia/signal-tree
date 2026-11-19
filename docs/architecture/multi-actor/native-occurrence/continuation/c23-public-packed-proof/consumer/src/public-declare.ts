import * as Kernel from '@signal-tree/kernel';
import * as Angular from '@signal-tree/angular';
import * as React from '@signal-tree/react';
import * as Vue from '@signal-tree/vue';
import * as Solid from '@signal-tree/solid';
type Row = {id:string; x:number};

function checkKernel(owner: Kernel.PendingTransaction) {
 const tree=Kernel.signalTree({x:0,pair:{x:0},rows:Kernel.entityMap<Row,string>()});
 const scalar=Kernel.link(tree.$.x,{set:value=>{const n:number=value;void n;}});
 const receipt:Kernel.PublicationReceipt=scalar.declare({kind:'independent'},()=>{tree.$.x(1);});
 const shared:Kernel.PublicationReceipt=receipt;
 const state:Kernel.PublicationState=shared.read();void state;
 const declaration:Kernel.PublicationDeclaration={kind:'dependent',owners:[owner]};
 scalar.declare(declaration,()=>{tree.$.x(1);});
 scalar.declare({kind:'unknown'},()=>123); // result is discarded
 const branch=Kernel.link(tree.$.pair,{set:value=>{const n:number=value.x;void n;}});
 branch.declare({kind:'independent'},()=>{tree.$.pair.x(1);});
 const rows=Kernel.link(tree.$.rows,{set:value=>{const array:readonly Row[]=value;void array;}});
 rows.declare({kind:'independent'},()=>tree.$.rows.setAll([{id:'a',x:1}]));
 const row=tree.$.rows.byIdOrFail('a');
 const rowLink=Kernel.link(row,{set:value=>{const whole:Row=value;void whole;}});
 rowLink.declare({kind:'independent'},()=>{row.x(1);});
 const field=Kernel.link(row.x,{set:value=>{const n:number=value;void n;}});
 field.declare({kind:'independent'},()=>{row.x(1);});
 const plain=Kernel.signalTree({x:0});
 Kernel.link(plain.$,{set:value=>{const n:number=value.x;void n;}}).declare({kind:'independent'},()=>{plain.$.x(1);});
 // @ts-expect-error marker-bearing root remains rejected
 Kernel.link(tree.$,{set:()=>{}});
 const nested=Kernel.signalTree({box:{rows:Kernel.entityMap<Row,string>()}});
 // @ts-expect-error marker-bearing branch remains rejected
 Kernel.link(nested.$.box,{set:()=>{}});
 // @ts-expect-error marker-bearing rejection includes subscribe-only endpoints
 Kernel.link(tree.$,{subscribe:()=>()=>{}});
 // @ts-expect-error ordinary async Promise callback rejected
 scalar.declare({kind:'independent'},async()=>{tree.$.x(1);});
 // @ts-expect-error possible Promise return rejected
 scalar.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
 // @ts-expect-error dependent owners required
 scalar.declare({kind:'dependent'},()=>{});
 // @ts-expect-error receipt method readonly
 receipt.read=()=>({state:'no-write'});
 // @ts-expect-error immutable status
 receipt.read().state='disposed';
 const error=new Kernel.SignalTreePublicationError('after-callback','async-callback',{cause:owner});
 const code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID'=error.code;void code;
 const errorConstructor:typeof Kernel.SignalTreePublicationError=Kernel.SignalTreePublicationError;void errorConstructor;
 // @ts-expect-error no invented error reasons
 new Kernel.SignalTreePublicationError('before-callback','invented');
 // @ts-expect-error historical non-emitted state is not public
 const invalid:Kernel.PublicationState={state:'eligible',basis:'surviving'};void invalid;
}
void checkKernel;

function checkAngular(owner: Angular.PendingTransaction) {
 const tree=Angular.signalTree({x:0,pair:{x:0},rows:Angular.entityMap<Row,string>()});
 const scalar=Angular.link(tree.$.x,{set:value=>{const n:number=value;void n;}});
 const receipt:Angular.PublicationReceipt=scalar.declare({kind:'independent'},()=>{tree.$.x.set(1);});
 const shared:Kernel.PublicationReceipt=receipt;
 const state:Angular.PublicationState=shared.read();void state;
 const declaration:Angular.PublicationDeclaration={kind:'dependent',owners:[owner]};
 scalar.declare(declaration,()=>{tree.$.x.set(1);});
 scalar.declare({kind:'unknown'},()=>123); // result is discarded
 const branch=Angular.link(tree.$.pair,{set:value=>{const n:number=value.x;void n;}});
 branch.declare({kind:'independent'},()=>{tree.$.pair.x.set(1);});
 const rows=Angular.link(tree.$.rows,{set:value=>{const array:readonly Row[]=value;void array;}});
 rows.declare({kind:'independent'},()=>tree.$.rows.setAll([{id:'a',x:1}]));
 const row=tree.$.rows.byIdOrFail('a');
 const rowLink=Angular.link(row,{set:value=>{const whole:Row=value;void whole;}});
 rowLink.declare({kind:'independent'},()=>{row.x.set(1);});
 const field=Angular.link(row.x,{set:value=>{const n:number=value;void n;}});
 field.declare({kind:'independent'},()=>{row.x.set(1);});
 const plain=Angular.signalTree({x:0});
 Angular.link(plain.$,{set:value=>{const n:number=value.x;void n;}}).declare({kind:'independent'},()=>{plain.$.x.set(1);});
 // @ts-expect-error marker-bearing root remains rejected
 Angular.link(tree.$,{set:()=>{}});
 const nested=Angular.signalTree({box:{rows:Angular.entityMap<Row,string>()}});
 // @ts-expect-error marker-bearing branch remains rejected
 Angular.link(nested.$.box,{set:()=>{}});
 // @ts-expect-error marker-bearing rejection includes subscribe-only endpoints
 Angular.link(tree.$,{subscribe:()=>()=>{}});
 // @ts-expect-error ordinary async Promise callback rejected
 scalar.declare({kind:'independent'},async()=>{tree.$.x.set(1);});
 // @ts-expect-error possible Promise return rejected
 scalar.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
 // @ts-expect-error dependent owners required
 scalar.declare({kind:'dependent'},()=>{});
 // @ts-expect-error receipt method readonly
 receipt.read=()=>({state:'no-write'});
 // @ts-expect-error immutable status
 receipt.read().state='disposed';
 const error=new Angular.SignalTreePublicationError('after-callback','async-callback',{cause:owner});
 const code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID'=error.code;void code;
 const errorConstructor:typeof Kernel.SignalTreePublicationError=Angular.SignalTreePublicationError;void errorConstructor;
 // @ts-expect-error no invented error reasons
 new Angular.SignalTreePublicationError('before-callback','invented');
 // @ts-expect-error historical non-emitted state is not public
 const invalid:Angular.PublicationState={state:'eligible',basis:'surviving'};void invalid;
}
void checkAngular;

function checkReact(owner: React.PendingTransaction) {
 const tree=React.signalTree({x:0,pair:{x:0},rows:React.entityMap<Row,string>()});
 const scalar=React.link(tree.$.x,{set:value=>{const n:number=value;void n;}});
 const receipt:React.PublicationReceipt=scalar.declare({kind:'independent'},()=>{tree.$.x(1);});
 const shared:Kernel.PublicationReceipt=receipt;
 const state:React.PublicationState=shared.read();void state;
 const declaration:React.PublicationDeclaration={kind:'dependent',owners:[owner]};
 scalar.declare(declaration,()=>{tree.$.x(1);});
 scalar.declare({kind:'unknown'},()=>123); // result is discarded
 const branch=React.link(tree.$.pair,{set:value=>{const n:number=value.x;void n;}});
 branch.declare({kind:'independent'},()=>{tree.$.pair.x(1);});
 const rows=React.link(tree.$.rows,{set:value=>{const array:readonly Row[]=value;void array;}});
 rows.declare({kind:'independent'},()=>tree.$.rows.setAll([{id:'a',x:1}]));
 const row=tree.$.rows.byIdOrFail('a');
 const rowLink=React.link(row,{set:value=>{const whole:Row=value;void whole;}});
 rowLink.declare({kind:'independent'},()=>{row.x(1);});
 const field=React.link(row.x,{set:value=>{const n:number=value;void n;}});
 field.declare({kind:'independent'},()=>{row.x(1);});
 const plain=React.signalTree({x:0});
 React.link(plain.$,{set:value=>{const n:number=value.x;void n;}}).declare({kind:'independent'},()=>{plain.$.x(1);});
 // @ts-expect-error marker-bearing root remains rejected
 React.link(tree.$,{set:()=>{}});
 const nested=React.signalTree({box:{rows:React.entityMap<Row,string>()}});
 // @ts-expect-error marker-bearing branch remains rejected
 React.link(nested.$.box,{set:()=>{}});
 // @ts-expect-error marker-bearing rejection includes subscribe-only endpoints
 React.link(tree.$,{subscribe:()=>()=>{}});
 // @ts-expect-error ordinary async Promise callback rejected
 scalar.declare({kind:'independent'},async()=>{tree.$.x(1);});
 // @ts-expect-error possible Promise return rejected
 scalar.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
 // @ts-expect-error dependent owners required
 scalar.declare({kind:'dependent'},()=>{});
 // @ts-expect-error receipt method readonly
 receipt.read=()=>({state:'no-write'});
 // @ts-expect-error immutable status
 receipt.read().state='disposed';
 const error=new React.SignalTreePublicationError('after-callback','async-callback',{cause:owner});
 const code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID'=error.code;void code;
 const errorConstructor:typeof Kernel.SignalTreePublicationError=React.SignalTreePublicationError;void errorConstructor;
 // @ts-expect-error no invented error reasons
 new React.SignalTreePublicationError('before-callback','invented');
 // @ts-expect-error historical non-emitted state is not public
 const invalid:React.PublicationState={state:'eligible',basis:'surviving'};void invalid;
}
void checkReact;

function checkVue(owner: Vue.PendingTransaction) {
 const tree=Vue.signalTree({x:0,pair:{x:0},rows:Vue.entityMap<Row,string>()});
 const scalar=Vue.link(tree.$.x,{set:value=>{const n:number=value;void n;}});
 const receipt:Vue.PublicationReceipt=scalar.declare({kind:'independent'},()=>{tree.$.x.value=1;});
 const shared:Kernel.PublicationReceipt=receipt;
 const state:Vue.PublicationState=shared.read();void state;
 const declaration:Vue.PublicationDeclaration={kind:'dependent',owners:[owner]};
 scalar.declare(declaration,()=>{tree.$.x.value=1;});
 scalar.declare({kind:'unknown'},()=>123); // result is discarded
 const branch=Vue.link(tree.$.pair,{set:value=>{const n:number=value.x;void n;}});
 branch.declare({kind:'independent'},()=>{tree.$.pair.x.value=1;});
 const rows=Vue.link(tree.$.rows,{set:value=>{const array:readonly Row[]=value;void array;}});
 rows.declare({kind:'independent'},()=>tree.$.rows.setAll([{id:'a',x:1}]));
 const row=tree.$.rows.byIdOrFail('a');
 const rowLink=Vue.link(row,{set:value=>{const whole:Row=value;void whole;}});
 rowLink.declare({kind:'independent'},()=>{row.x.value=1;});
 const field=Vue.link(row.x,{set:value=>{const n:number=value;void n;}});
 field.declare({kind:'independent'},()=>{row.x.value=1;});
 const plain=Vue.signalTree({x:0});
 Vue.link(plain.$,{set:value=>{const n:number=value.x;void n;}}).declare({kind:'independent'},()=>{plain.$.x.value=1;});
 // @ts-expect-error marker-bearing root remains rejected
 Vue.link(tree.$,{set:()=>{}});
 const nested=Vue.signalTree({box:{rows:Vue.entityMap<Row,string>()}});
 // @ts-expect-error marker-bearing branch remains rejected
 Vue.link(nested.$.box,{set:()=>{}});
 // @ts-expect-error marker-bearing rejection includes subscribe-only endpoints
 Vue.link(tree.$,{subscribe:()=>()=>{}});
 // @ts-expect-error ordinary async Promise callback rejected
 scalar.declare({kind:'independent'},async()=>{tree.$.x.value=1;});
 // @ts-expect-error possible Promise return rejected
 scalar.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
 // @ts-expect-error dependent owners required
 scalar.declare({kind:'dependent'},()=>{});
 // @ts-expect-error receipt method readonly
 receipt.read=()=>({state:'no-write'});
 // @ts-expect-error immutable status
 receipt.read().state='disposed';
 const error=new Vue.SignalTreePublicationError('after-callback','async-callback',{cause:owner});
 const code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID'=error.code;void code;
 const errorConstructor:typeof Kernel.SignalTreePublicationError=Vue.SignalTreePublicationError;void errorConstructor;
 // @ts-expect-error no invented error reasons
 new Vue.SignalTreePublicationError('before-callback','invented');
 // @ts-expect-error historical non-emitted state is not public
 const invalid:Vue.PublicationState={state:'eligible',basis:'surviving'};void invalid;
}
void checkVue;

function checkSolid(owner: Solid.PendingTransaction) {
 const tree=Solid.signalTree({x:0,pair:{x:0},rows:Solid.entityMap<Row,string>()});
 const scalar=Solid.link(tree.$.x,{set:value=>{const n:number=value;void n;}});
 const receipt:Solid.PublicationReceipt=scalar.declare({kind:'independent'},()=>{tree.$.x.set(1);});
 const shared:Kernel.PublicationReceipt=receipt;
 const state:Solid.PublicationState=shared.read();void state;
 const declaration:Solid.PublicationDeclaration={kind:'dependent',owners:[owner]};
 scalar.declare(declaration,()=>{tree.$.x.set(1);});
 scalar.declare({kind:'unknown'},()=>123); // result is discarded
 const branch=Solid.link(tree.$.pair,{set:value=>{const n:number=value.x;void n;}});
 branch.declare({kind:'independent'},()=>{tree.$.pair.x.set(1);});
 const rows=Solid.link(tree.$.rows,{set:value=>{const array:readonly Row[]=value;void array;}});
 rows.declare({kind:'independent'},()=>tree.$.rows.setAll([{id:'a',x:1}]));
 const row=tree.$.rows.byIdOrFail('a');
 const rowLink=Solid.link(row,{set:value=>{const whole:Row=value;void whole;}});
 rowLink.declare({kind:'independent'},()=>{row.x.set(1);});
 const field=Solid.link(row.x,{set:value=>{const n:number=value;void n;}});
 field.declare({kind:'independent'},()=>{row.x.set(1);});
 const plain=Solid.signalTree({x:0});
 Solid.link(plain.$,{set:value=>{const n:number=value.x;void n;}}).declare({kind:'independent'},()=>{plain.$.x.set(1);});
 // @ts-expect-error marker-bearing root remains rejected
 Solid.link(tree.$,{set:()=>{}});
 const nested=Solid.signalTree({box:{rows:Solid.entityMap<Row,string>()}});
 // @ts-expect-error marker-bearing branch remains rejected
 Solid.link(nested.$.box,{set:()=>{}});
 // @ts-expect-error marker-bearing rejection includes subscribe-only endpoints
 Solid.link(tree.$,{subscribe:()=>()=>{}});
 // @ts-expect-error ordinary async Promise callback rejected
 scalar.declare({kind:'independent'},async()=>{tree.$.x.set(1);});
 // @ts-expect-error possible Promise return rejected
 scalar.declare({kind:'unknown'},():number|Promise<number>=>Math.random()?1:Promise.resolve(1));
 // @ts-expect-error dependent owners required
 scalar.declare({kind:'dependent'},()=>{});
 // @ts-expect-error receipt method readonly
 receipt.read=()=>({state:'no-write'});
 // @ts-expect-error immutable status
 receipt.read().state='disposed';
 const error=new Solid.SignalTreePublicationError('after-callback','async-callback',{cause:owner});
 const code:'SIGNALTREE_PUBLICATION_DECLARATION_INVALID'=error.code;void code;
 const errorConstructor:typeof Kernel.SignalTreePublicationError=Solid.SignalTreePublicationError;void errorConstructor;
 // @ts-expect-error no invented error reasons
 new Solid.SignalTreePublicationError('before-callback','invented');
 // @ts-expect-error historical non-emitted state is not public
 const invalid:Solid.PublicationState={state:'eligible',basis:'surviving'};void invalid;
}
void checkSolid;
