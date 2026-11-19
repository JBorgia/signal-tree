import subprocess,json,time,os,signal
class OwnedProcesses:
 def __init__(self,pid,dest):
  self.root=pid;self.dest=dest;self.known={};self.groups=set();self.snapshot()
 def scan(self):
  raw=subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,pgid=,state=,pcpu=,rss=,lstart=,command='],text=True)
  result={}
  for line in raw.splitlines():
   p=line.split(None,11)
   if len(p)<11:continue
   pid,ppid,pgid=map(int,p[:3]);birth=' '.join(p[6:11]);result[pid]={'pid':pid,'ppid':ppid,'pgid':pgid,'birth':birth,'raw':line.strip()}
  return result
 def snapshot(self):
  allrows=self.scan();owned={pid for pid,birth in self.known.items() if pid in allrows and allrows[pid]['birth']==birth}
  if not self.known:
   assert self.root in allrows,'launcher missing before registration'
   self.known[self.root]=allrows[self.root]['birth'];owned.add(self.root)
  changed=True
  while changed:
   changed=False
   for pid,row in allrows.items():
    if pid not in owned and row['ppid'] in owned:
     owned.add(pid);self.known[pid]=row['birth'];changed=True
  # Admit a new group only when its leader is itself a proven descendant.
  for pid in owned:
   row=allrows[pid]
   if row['pgid']==pid:self.groups.add(pid)
  # Keep observations of known descendants even if reparented after launcher exits.
  rows=[allrows[pid] for pid in sorted(owned)]
  record={'at':time.time(),'launcherPid':self.root,'registeredGroups':sorted(self.groups),'knownBirths':self.known,'live':rows}
  temp=self.dest/'OWNERSHIP.tmp';temp.write_text(json.dumps(record));os.replace(temp,self.dest/'OWNERSHIP.json')
  with (self.dest/'ownership.jsonl').open('a') as f:f.write(json.dumps(record)+'\n')
  return [row['raw'] for row in rows]
 def terminate(self):
  self.snapshot();allrows=self.scan();sent=[]
  # Descendant groups first, launcher last. Require a live, birth-matched owned witness.
  for group in sorted(self.groups-{self.root})+[self.root]:
   witnesses=[row for pid,row in allrows.items() if row['pgid']==group and self.known.get(pid)==row['birth']]
   if not witnesses:continue
   try:os.killpg(group,signal.SIGTERM);sent.append({'pgid':group,'witnesses':witnesses})
   except ProcessLookupError:pass
  (self.dest/'SIGNALS.json').write_text(json.dumps(sent,indent=2)+'\n')
