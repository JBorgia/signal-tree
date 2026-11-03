import {it,expect,vi} from 'vitest';
import {signalTree,transactions} from '../index';
import {getPathNotifier} from './path-notifier';
import * as intrinsic from './internals/intrinsic-mutation';
it('failed transaction scalar attachment releases its earlier notifier registrations',()=>{
 const notifier=getPathNotifier(),releaseAll:Array<()=>void>=[];
 let active=0,registered=0,reached=0;
 const subscribe=notifier.subscribe.bind(notifier);
 const observer=vi.spyOn(notifier,'subscribe').mockImplementation((...args:Parameters<typeof subscribe>)=>{
  const off=subscribe(...args);registered++;active++;let live=true;
  const release=()=>{if(!live)return;live=false;active--;off();};releaseAll.push(release);return release;
 });
 const reset=notifier.onReset!.bind(notifier);
 const resetSpy=vi.spyOn(notifier,'onReset').mockImplementation((...args:Parameters<typeof reset>)=>{const off=reset(...args);releaseAll.push(off);return off;});
 const enqueue=notifier.observeEnqueue.bind(notifier);
 const enqueueSpy=vi.spyOn(notifier,'observeEnqueue').mockImplementation((...args:Parameters<typeof enqueue>)=>{const off=enqueue(...args);releaseAll.push(off);return off;});
 const failure=new Error('independent pre-install scalar attachment failure');
 const prepare=vi.spyOn(intrinsic,'prepareTerminalMutations').mockImplementation(()=>{reached++;throw failure;});
 try{
  let caught:unknown;try{signalTree({a:0,b:0},{enhancers:[transactions()]});}catch(error){caught=error;}
  expect(caught).toBe(failure);expect(reached).toBe(1);expect(registered).toBeGreaterThan(0);
  expect(active).toBe(0);
 }finally{prepare.mockRestore();for(const off of releaseAll.reverse())off();observer.mockRestore();resetSpy.mockRestore();enqueueSpy.mockRestore();}
});
