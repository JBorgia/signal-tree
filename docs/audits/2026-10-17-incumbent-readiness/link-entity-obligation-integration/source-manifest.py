import hashlib,json,subprocess,sys
from pathlib import Path
root=Path('/private/tmp/link-entity-obligation-integration')
tracked=subprocess.check_output(['git','diff','--name-only'],cwd=root,text=True).splitlines()
untracked=subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines()
paths=sorted(set(tracked+untracked))
print(json.dumps({'base':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'sha256':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths if (root/p).is_file()}},indent=2))
