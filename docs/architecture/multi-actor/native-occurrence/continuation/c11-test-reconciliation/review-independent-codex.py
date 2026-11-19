from pathlib import Path
import subprocess,json
p=Path(__file__).parent;d=p/'independent-review-codex';d.mkdir()
prompt=(p/'independent-review/PROMPT.txt').read_text();(d/'PROMPT.txt').write_text(prompt)
a=['/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex','exec','--ignore-user-config','--ephemeral','--sandbox','read-only','--skip-git-repo-check','--cd',str(d),'-']
(d/'COMMAND.json').write_text(json.dumps({'cwd':str(d),'argv':a,'stdin':'PROMPT.txt'},indent=2))
with (d/'first.stdout').open('w') as o,(d/'first.stderr').open('w') as e:r=subprocess.run(a,input=prompt,text=True,cwd=d,stdout=o,stderr=e)
(d/'RESULT.json').write_text(json.dumps({'exit':r.returncode}));print('independent codex review',r.returncode)
