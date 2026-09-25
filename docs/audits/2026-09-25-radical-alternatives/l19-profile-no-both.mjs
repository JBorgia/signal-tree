const K=await import('/var/folders/rq/j_cb8q_538sbvjlg2bzwyts40000gn/T/st-abl1-NO-BOTH.mjs');
const tree=K.signalTree({a:0,b:0,c:0},{enhancers:[K.transactions()]});
for(let i=0;i<20000;i++) tree.$.a(i);
for(let i=0;i<600000;i++) tree.$.a(i);
tree.destroy();
