import {signalTree,transactions,link} from './packages/kernel/src/index';
import {withWriteContext} from './packages/kernel/src/lib/write-context';
const tick=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};
export async function run(){const out:any[]=[];for(const mode of ['rollback','confirm','plain','noop','acquired-noop','repeat-inspection']){
 const t=signalTree({y:mode==='noop'?99:7},{enhancers:[transactions()]});const sent:number[]=[];const c:any=link(t.$.y,{set:(v:number)=>{sent.push(v);},get:()=>99});let notifications=0;const off=t.$.y.subscribe(()=>notifications++);const checks:any[]=[];const check=(name:string,actual:any,expected:any)=>checks.push({name,actual,expected,pass:JSON.stringify(actual)===JSON.stringify(expected)});
 try{
 if(mode!=='noop'){withWriteContext({participation:'inspection'},()=>t.$.y(99));if(mode==='repeat-inspection'){withWriteContext({participation:'inspection'},()=>t.$.y(88));withWriteContext({participation:'inspection'},()=>t.$.y(99));}await tick();check('inspection held',sent,[]);}
 if(mode==='acquired-noop'){await c.retrieve();await tick();}
 const before=notifications;
 if(['rollback','confirm','repeat-inspection'].includes(mode)){
 const p=t.transact(()=>t.$.y(99));await tick();check('pending physical',t.$.y(),99);check('owned contribution',p.inspect().changes.length,1);check('no duplicate value notification',notifications,before);check('pending not sent',sent,[]);
 if(mode==='confirm')p.confirm();else p.rollback();await tick();check('settled physical',t.$.y(),mode==='confirm'?99:7);check('settled endpoint',sent.at(-1) ?? 7,mode==='confirm'?99:7);check('no rejected payload',mode==='confirm'||!sent.includes(99),true);
 }else{const r=c.declare({kind:'independent'},()=>t.$.y(99));await tick();check('no duplicate value notification',notifications,before);check('no-write receipt',r.read().state==='no-write',mode!=='plain');check('outbound',sent,mode==='plain'?[99]:[]);}
 out.push({mode,checks});
 }finally{off();c.dispose();t.destroy();}}
 return out;}
