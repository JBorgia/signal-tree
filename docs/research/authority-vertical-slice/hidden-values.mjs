for(const arm of ['a','b']){
 const {createStore}=await import(`./arm-${arm}.mjs`);const s=createStore();const rows=[];
 const record=label=>rows.push({label,value:s.read('x'),stats:s.stats()});
 s.write('x',1);record('ordinary1');const p=s.begin(()=>s.write('x',2));record('pending2');const q=s.begin(()=>s.write('x',3));record('pending3');p.reject();record('rejectOlder-still3');q.reject();record('rejectNewer-reveal1');
 s.destroy();rows.push({label:'destroy',stats:s.stats()});console.log(JSON.stringify({arm,rows}));
}
