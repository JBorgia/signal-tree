import { expect, it, vi } from 'vitest';
import { signalTree, transactions } from '../index';
import { withWriteContext } from './write-context';
import { getPathNotifier } from './path-notifier';
import { OrdinaryMemberPresenceSource, readOrdinaryMemberPresence } from './internals/member-membership';
import { peekInternalTransactionRuntime } from '../enhancers/transactions/transactions';
const make = () => signalTree({ a: { y: 7, keep: 9 } as { y?: number; keep?: number } }, { enhancers: [transactions()] });
const flush = () => getPathNotifier().flushSync();

it('independent no-Link repeated ordinary presence composes original absence within one transaction', () => {
  const t = make();
  try {
    const a=t.$.a, y=a.y!;
    a({keep:9});
    withWriteContext({participation:'inspection'},()=>y(99)); flush();
    const p=t.transact(()=>{y(7);a({keep:9});y(8);a({keep:9});y(9);});
    expect(a()).toEqual({y:9,keep:9});
    expect(readOrdinaryMemberPresence(a,'y')).toBe(true);
    expect(p.inspect().changes.some(c=>c.path==='a.y')).toBe(true);
    p.rollback();
    expect(a()).toEqual({keep:9});
    expect(readOrdinaryMemberPresence(a,'y')).toBe(false);
    expect(a.y).toBe(y);
  } finally {t.destroy();}
});

it('independent no-Link parent inverse does not adopt its inspected-only sibling', () => {
  const t=signalTree({a:{y:7,keep:9} as {y?:number;keep?:number},other:1} as {a?:{y?:number;keep?:number};other:number},{enhancers:[transactions()]});
  try {
    // This fixture constructs a populated branch; optional-parent inference
    // otherwise describes it as an object-valued leaf. Preserve the concrete
    // child types used by the same populated shape in make(), only in this test.
    const a=t.$.a! as ReturnType<typeof make>['$']['a'], y=a.y!;
    a({keep:9}); withWriteContext({participation:'inspection'},()=>y(99)); flush();
    expect(a()).toEqual({y:99,keep:9});
    expect(readOrdinaryMemberPresence(a,'y')).toBe(false);
    const p=t.transact(()=>t.$({other:1}));
    expect(t.$()).toEqual({other:1});
    expect(p.inspect().changes.some(c=>c.path==='a')).toBe(true);
    p.rollback();
    expect(t.$()).toEqual({a:{keep:9},other:1});
    expect(readOrdinaryMemberPresence(a,'y')).toBe(false);
    expect(a.y).toBe(y);
  } finally {t.destroy();}
});

it('independent same-parent source ABA rejects prepared membership and preserves installed foreign work', () => {
  const t=make();
  try {
    const a=t.$.a,y=a.y!;
    a({keep:9}); withWriteContext({participation:'inspection'},()=>y(99)); flush();
    const original=OrdinaryMemberPresenceSource.prototype.prepare;
    let entered=false;
    const spy=vi.spyOn(OrdinaryMemberPresenceSource.prototype,'prepare').mockImplementation(function(this:OrdinaryMemberPresenceSource,...args){
      const edit=original.apply(this,args);
      if(!entered&&!args[4]){
        entered=true;
        withWriteContext({participation:'realized'},()=>{y(7);a({keep:9});});
        withWriteContext({participation:'inspection'},()=>y(7));
        expect(readOrdinaryMemberPresence(a,'y')).toBe(false);
        expect(a()).toEqual({y:7,keep:9});
      }
      return edit;
    });
    let failure:unknown;
    try {t.transact(()=>y(7));}catch(e){failure=e;}finally{spy.mockRestore();}
    expect(entered).toBe(true);
    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).toContain('reentered installation');
    expect(readOrdinaryMemberPresence(a,'y')).toBe(false);
    expect(a()).toEqual({y:7,keep:9});
    expect(peekInternalTransactionRuntime(t)!.getPendingTurnCount()).toBe(0);
  } finally {t.destroy();}
});
