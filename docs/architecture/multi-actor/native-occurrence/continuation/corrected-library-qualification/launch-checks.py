from pathlib import Path
import json,subprocess,datetime,os
p=Path(__file__).resolve().parent
for job in json.loads((p/"CHECK-COMMANDS.json").read_text()):
 (p/"STATUS.json").write_text(json.dumps({"phase":job[0]+" running","updatedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"controllerPid":os.getpid(),"heavySlot":"exclusive"},indent=2)+"\n")
 code=subprocess.run(["python3",str(p/"guarded-run.py"),*job]).returncode
 if code:break
 r=json.loads((p/"runs"/job[0]/"RESULT.json").read_text())
 if r["guardReason"] or r["remainingOwned"] or r["sourceMismatches"]:break
