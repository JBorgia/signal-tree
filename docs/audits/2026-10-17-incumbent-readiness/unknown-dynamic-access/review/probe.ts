import { signalTree } from '/private/tmp/st-unknown-access-candidate/packages/kernel/src/lib/signal-tree';
type Unknown<T> = unknown extends T ? keyof T extends never ? true : false : false;
function isTrue<T extends true>() {}
const sym: unique symbol=Symbol();
interface Hybrid extends Record<string,unknown>{title:string;readonly count:number; 7:number;[sym]:number;}
const t=signalTree({s:{} as Record<string,number>,n:{} as Record<number,number>,h:{title:'x',count:1,7:7,[sym]:2} as Hybrid,ro:{} as Readonly<Record<string,number>>});
isTrue<Unknown<typeof t.$.s['absent']>>();
isTrue<Unknown<typeof t.$.s['call']>>();
isTrue<Unknown<typeof t.$.s['name']>>();
isTrue<Unknown<typeof t.$.s['length']>>();
isTrue<Unknown<typeof t.$.s[99]>>();
isTrue<Unknown<typeof t.$.ro['absent']>>();
const title:string=t.$.h.title();const count:number=t.$.h.count();const seven:number=t.$.h[7]();const symbol:number=t.$.h[sym]();
// @ts-expect-error readonly named child remains readonly
t.$.h.count=t.$.h[7];
t.$.n[123](); // numeric open-record probe: does this still promise absent callable?
t.$.n({123:4});t.$.ro({x:3});
const patterned=signalTree({rows:{} as Record<`row-${string}`, number>});
patterned.$.rows['row-never']();
const symbols=signalTree({rows:{} as Record<symbol, number>});
symbols.$.rows[Symbol('never')]();
interface NativeHybrid extends Record<string,unknown> { name:number; call:string; length:boolean; readonly bind:number; }
const nativeHybrid=signalTree({h:{name:1,call:'a',length:true,bind:2} as NativeHybrid});
const hn:number=nativeHybrid.$.h.name();
const hc:string=nativeHybrid.$.h.call();
const hl:boolean=nativeHybrid.$.h.length();
const hb:number=nativeHybrid.$.h.bind();
// @ts-expect-error known readonly native-name child stays readonly
nativeHybrid.$.h.bind=nativeHybrid.$.h.name;
isTrue<Unknown<typeof nativeHybrid.$.h['other']>>();
