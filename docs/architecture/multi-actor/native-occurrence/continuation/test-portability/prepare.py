import pathlib,json,hashlib,re,os
base=pathlib.Path('/private/tmp/st-test-sink-cleanup'); src=pathlib.Path('/private/tmp/st-v16-integration-candidate')
inv=json.load(open('/private/tmp/st-test-diagnostic-classification/INVENTORY.json'))
for x in inv: assert hashlib.sha256((src/x['file']).read_bytes()).hexdigest()==x['sha256'],x['file']
mandatory=[x for x in inv if x['classification'].startswith('mandatory')]; assert len(mandatory)==13
for x in mandatory:
 p=x['file']; s=(src/p).read_text(); before=base/'before'/p; before.parent.mkdir(parents=True,exist_ok=True); before.write_text(s)
 helper=os.path.relpath('tools/testing/optional-diagnostic',os.path.dirname(p))
 s=re.sub(r"import \{\s*(?:appendFileSync|writeFileSync)\s*\} from 'node:fs';",f"import {{ writeDiagnostic }} from '{helper}';",s)
 # Remove only the four missing-output prerequisite throws.
 for throw in ["if(!output)throw Error('Observation output required');","if(!output)throw Error('Research diagnostic requires ST_EQUAL_OWNER_TRACE');","if(!dir)throw new Error('fresh output directory required');","if(!directory)throw new Error('unique evidence output directory required');"]:
  s=s.replace(throw,'')
 if 'st-joint-phase-successor-r4/runs/' in s:
  s="const diagnosticDirectory=process.env['ST_JOINT_PHASE_OUTPUT'];\n"+s
  s=re.sub(r"'/private/tmp/st-joint-phase-successor-r4/runs/([^']+)'",r"diagnosticDirectory ? `${diagnosticDirectory}/\1` : undefined",s)
 if 'st-fixed-window-retirement-cancellation-successor/' in s:
  s="const diagnosticDirectory=process.env['ST_FIXED_WINDOW_OUTPUT'];\n"+s
  s=s.replace('`/private/tmp/st-fixed-window-retirement-cancellation-successor/provenance-${cause}.json`','diagnosticDirectory ? `${diagnosticDirectory}/provenance-${cause}.json` : undefined')
 for expr in ["process.env.ST_PREPARED_REVIEW_OUTPUT+'/independent.jsonl'","process.env.ST_PREPARED_REVIEW_OUTPUT+'/terminal.jsonl'","process.env['ST_PREPARED_REVIEW_OUTPUT']+'/field-order.json'","process.env['ST_PREPARED_REVIEW_OUTPUT']+`/packet-${order}.json`","process.env['ST_PREPARED_REVIEW_OUTPUT']+`/absence-${mode}.json`"]:
  if expr in s:
   env=expr.split('+')[0]; s=s.replace(expr,f'{env} ? {expr} : undefined')
 s=s.replace('`${dir}/${name}.json`','dir ? `${dir}/${name}.json` : undefined').replace('`${directory}/${order}-${followup}.json`','directory ? `${directory}/${order}-${followup}.json` : undefined')
 lines=[]
 for line in s.splitlines(True):
  if 'appendFileSync(' in line:
   assert line.count("+'\\n')")==1,line
   line=line.replace('appendFileSync(','writeDiagnostic(').replace("+'\\n')","+'\\n',true)")
  line=line.replace('writeFileSync(','writeDiagnostic(')
  lines.append(line)
 if lines[0].startswith('const diagnosticDirectory='):
  declaration=lines.pop(0); last_import=max(i for i,line in enumerate(lines) if line.startswith('import ')); lines.insert(last_import+1,declaration)
 out=base/'overlay'/p; out.parent.mkdir(parents=True,exist_ok=True);out.write_text(''.join(lines))
(base/'inventory-baseline.json').write_text(json.dumps(inv,indent=2)+'\n')
print('All 38 inventory hashes matched; preserved and transformed exactly 13 mandatory specs.')
