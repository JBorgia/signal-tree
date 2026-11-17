#!/usr/bin/env python3
"""Summarize V8 sampled time; this is attribution, not comparative CPU timing."""
from collections import defaultdict
from pathlib import Path
import hashlib,json,sys
source,output=map(lambda p:Path(p).resolve(),sys.argv[1:]);assert not output.exists()
data=json.loads(source.read_text());nodes={node['id']:node for node in data['nodes']};parents={}
for node in nodes.values():
 for child in node.get('children',[]):
  assert child not in parents;parents[child]=node['id']
assert len(data['samples'])==len(data['timeDeltas'])
exclusive=defaultdict(int);inclusive=defaultdict(int);frames={}
def key(node):
 f=node['callFrame'];return (f['url'],f['functionName'],f['lineNumber'],f['columnNumber'])
for node in nodes.values():frames[key(node)]=node['callFrame']
for identifier,delta in zip(data['samples'],data['timeDeltas'],strict=True):
 assert delta>=0 and identifier in nodes
 exclusive[key(nodes[identifier])]+=delta
 seen=set()
 while identifier is not None:
  k=key(nodes[identifier])
  if k not in seen:inclusive[k]+=delta;seen.add(k)
  identifier=parents.get(identifier)
rows=[{'frame':frame,'exclusiveSampledMs':exclusive[k]/1000,'inclusiveSampledMs':inclusive[k]/1000} for k,frame in frames.items()]
summary={'command':sys.argv,'generatorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'profileSpanMs':(data['endTime']-data['startTime'])/1000,'sampledMs':sum(data['timeDeltas'])/1000,'sampleCount':len(data['samples']),'exclusive':sorted(rows,key=lambda x:x['exclusiveSampledMs'],reverse=True),'inclusive':sorted(rows,key=lambda x:x['inclusiveSampledMs'],reverse=True),'limits':'One instrumented child. Sampled wall-clock weights are not process CPU measurements, exact invocation counts or benchmark results. Inclusive rows overlap and must not be summed. Distinct recursion frames at the same source location count once per sample.'}
with output.open('x') as stream:json.dump(summary,stream,indent=2);stream.write('\n')
for row in summary['exclusive'][:18]:
 f=row['frame'];print(round(row['exclusiveSampledMs'],2),round(row['inclusiveSampledMs'],2),f['functionName'],f['url'],f['lineNumber']+1)
