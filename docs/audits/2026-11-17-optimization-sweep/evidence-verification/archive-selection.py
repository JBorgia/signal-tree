#!/usr/bin/env python3
"""Version-aware evidence selection; never changes the original archive verifier.

catalog EVIDENCE_ROOT NEW_CONFIG   # metadata inventory only, no payload hashing
prepare CONFIG NEW_OUT          # full closure/hash/recovery job: exclusive slot
verify-extracted ARCHIVE_DIR CLOSURE_DIGEST
self-test LEGACY_VERIFIER NEW_OUT # tiny synthetic corrupt/missing/version controls

Raw JSON is preserved verbatim as opaque to the legacy generic hash discoverer.
This wrapper traverses evidence documents under explicit schemas and preserves
source/artifact byte payloads without requalifying their embedded historical
claims. It writes a canonical file-reference closure for the unmodified verifier
and reconstructs evidence/payload obligations after extraction.
Unknown/malformed file identities and missing versions stop preparation. Known
measurement digests and an absent optional historical config are metadata, not
imaginary files. Any further data-field exception is exact-document/pointer/value
pinned and appears in the report; no blanket JSON or hash-map bypass exists.
"""
from __future__ import annotations
import argparse, base64, hashlib, importlib.util, json, os, re, shutil, subprocess, sys
from collections import deque
from pathlib import Path

sys.dont_write_bytecode = True

FORMAT = 'signaltree-optimization-closure-v2'
HEX = re.compile(r'^[0-9a-f]{64}$')
HEX512 = re.compile(r'^[0-9a-f]{128}$')
MAPS = {'inputs', 'bindings', 'dependencies', 'served', 'receipts', 'packageHashes',
        'loadedModuleHashes', 'hashes', 'files', 'snapshots', 'sourceOriginals',
        'sources', 'sourceFiles', 'sourceBindings', 'packageFiles'}
SKIP = {'.git', 'node_modules', '.nx', '__pycache__'}
NULLABLE = {'historicalConfigSha256'}
# These are authoring tokens from two exact, separately pinned source templates.
# This vocabulary is not permission to excuse an executed receipt/file identity.
SOURCE_TEMPLATE_TOKENS = {
    'artifactPlanSha256': 'FILL_FROM_FROZEN_FINAL_PLAN',
    'dispatchBuildSha256': 'FILL_FROM_FROZEN_FINAL_BUILD',
    'manifestSha256': 'REPLACE_WITH_EXACT_MANIFEST_SHA256',
}
JSON_FIELDS = {'planSha256', 'packetPlanSha256', 'scheduleSha256', 'buildSha256',
               'packetSha256', 'executionSha256', 'summarySha256', 'receiptSha256',
               'conformanceSha256', 'statsSha256', 'sourceReceiptSha256', 'buildReceiptSha256',
               'sourceInventorySha256', 'sourceManifestSha256', 'artifactPlanSha256',
               'dispatchBuildSha256', 'packingJournalSha256', 'configSha256', 'historicalConfigSha256'}

class SelectionError(Exception): pass
def need(ok, msg):
    if not ok: raise SelectionError(msg)
def dumps(x): return (json.dumps(x, indent=2, sort_keys=True, ensure_ascii=False)+'\n').encode()
def save(p,x):
    with Path(p).open('xb') as f: f.write(dumps(x))
def parse(data):
    def unique(pairs):
        obj={}
        for k,v in pairs:
            need(k not in obj, f'Duplicate JSON key: {k}'); obj[k]=v
        return obj
    return json.loads(data, object_pairs_hook=unique)
def read(p): return parse(Path(p).read_bytes())
def digest(data, algorithm='sha256'): return hashlib.new(algorithm,data).hexdigest()
def hashes(p):
    h=hashlib.sha256(); s=hashlib.sha512(); size=0
    with Path(p).open('rb') as f:
        while block:=f.read(1024*1024): h.update(block);s.update(block);size+=len(block)
    return {'sha256':h.hexdigest(),'sha512':s.hexdigest(),'size':size}
def ptr(parts): return '/'+ '/'.join(str(x).replace('~','~0').replace('/','~1') for x in parts)
def fresh(p):
    p=Path(p).absolute();need(not p.exists(),f'Preserve prior output: {p}');p.mkdir(parents=True);return p

def refs_from(data, original, exceptions=(), aggregate_copies=()):
    """An explicit file-identity grammar, with narrowly named data schemas."""
    root=parse(data); doc_digest=digest(data); refs=[]; metadata=[];used=set()
    base=Path(original).parent if os.path.isabs(original) else None
    # These exact immutable aggregate versions were joined record-for-record to
    # hash-bound raw bucket children. This does not authorize arbitrary nested
    # oracle objects or turn file/module digests elsewhere into metadata.
    copied_bucket_records={}
    registrations=[r for r in aggregate_copies if isinstance(r,dict) and r.get('documentDigest')==doc_digest]
    need(len(registrations)<=1,'Duplicate bucket aggregate registration')
    for registration in registrations:
        need(set(registration)=={'kind','documentPath','documentDigest','recordArrays','proof'}
             and registration['kind']=='bucket-value-oracle-aggregate-copy'
             and isinstance(registration['documentPath'],str) and Path(registration['documentPath']).is_absolute(),
             'Invalid bucket aggregate registration')
        proof=registration['proof']
        need(isinstance(proof,dict) and set(proof)=={'path','sha256'}
             and isinstance(proof['path'],str) and Path(proof['path']).is_absolute()
             and isinstance(proof['sha256'],str) and HEX.fullmatch(proof['sha256']),
             'Invalid bucket aggregate join proof')
        arrays=registration['recordArrays'];seen=set()
        need(isinstance(arrays,list) and bool(arrays),'Missing bucket aggregate record arrays')
        for array in arrays:
            need(isinstance(array,dict) and set(array)=={'pointer','count'}
                 and array['pointer'] in ('/rows','/controls','/rawHeapRows','/bucket-cost-heap/sameArm','/summary/sameArm','/summaries/heap/sameArm')
                 and type(array['count']) is int and array['count']>0,'Invalid bucket aggregate record array')
            prefix=tuple(array['pointer'].split('/')[1:])
            need(prefix not in seen,'Duplicate bucket aggregate record array');seen.add(prefix)
            rows=root
            for part in prefix:
                need(isinstance(rows,dict) and part in rows,'Missing bucket aggregate record array')
                rows=rows[part]
            need(isinstance(rows,list) and len(rows)==array['count'],'Bucket aggregate record count differs')
            for i,row in enumerate(rows):
                need(isinstance(row,dict) and isinstance(row.get('sample'),dict)
                     and isinstance(row.get('oracles'),dict),'Invalid bucket aggregate row')
                copied_bucket_records[(*prefix,i)]=row
    overrides={r['pointer']:r for r in exceptions if r['documentDigest']==doc_digest}
    need(len(overrides)==len([r for r in exceptions if r['documentDigest']==doc_digest]),'Duplicate data-field rule')
    def target(value):
        if not isinstance(value,str): return None
        if os.path.isabs(value):return os.path.normpath(value)
        # Relative path joins are only used when a field explicitly names a file.
        if base is not None and value and not value.startswith(('http:','https:','hash:')):
            return str((base/value).absolute())
        return None
    def scalar_target(key,obj,parts):
        # Exact application analyzer-control receipt schema: each nested case
        # executes its own input directory, not a schedule beside the receipt.
        if (key=='scheduleSha256' and len(parts)==2 and parts[0]=='cases'
            and isinstance(parts[1],int) and isinstance(root,dict)
            and isinstance(root.get('runner'),dict)
            and isinstance(root['runner'].get('path'),str)
            and root['runner']['path'].endswith('/tools/optimization-sweep/application/analyzer-controls.mjs')):
            need(root.get('passed') is True and isinstance(root.get('cases'),list)
                 and root['cases'][parts[1]] is obj,'Analyzer-control receipt schema')
            name=obj.get('name');command=obj.get('command');analyzer=root.get('analyzer')
            need(isinstance(name,str) and re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',name),'Analyzer-control case name')
            need(isinstance(analyzer,dict) and isinstance(analyzer.get('path'),str)
                 and os.path.isabs(analyzer['path']),'Analyzer-control analyzer identity')
            need(isinstance(command,list) and len(command)==4
                 and all(isinstance(x,str) and os.path.isabs(x) for x in command)
                 and command[1]==analyzer['path']
                 and Path(command[2]).name=='input' and Path(command[2]).parent.name==name
                 and command[3]==str(Path(command[2]).parent/'analysis'),'Analyzer-control case command')
            need(not obj.get('schedulePath') and not obj.get('scheduleFile')
                 and not obj.get('schedule'),'Analyzer-control conflicting schedule identity')
            return str(Path(command[2])/'schedule.json')
        if key=='sha256':
            for field in ['path','file','archive','originalPath','executable']:
                if obj.get(field):return target(obj[field])
        prefix=key[:-6] if key.endswith('Sha256') else ''
        for field in [prefix+'Path',prefix,prefix+'File']:
            if isinstance(obj.get(field),str):return target(obj[field])
        if key=='scheduleSha256' and base:return str(base/'schedule.json')
        if key=='planSha256' and Path(original).name in ('dispatch-build.json','build.json') and base:return str(base/'plan.json')
        return None  # A real hash-only identity, not an invented original path.
    def add(location,original_path,expected,algorithm='sha256',json_expected=False):
        need(isinstance(expected,str) and (HEX if algorithm=='sha256' else HEX512).fullmatch(expected),f'Malformed expected {algorithm}: {original}{location}')
        refs.append({'pointer':location,'original':original_path or f'hash:{algorithm}:{expected}', 'algorithm':algorithm,'expected':expected,'jsonExpected':json_expected})
    def visit(value,parts=(),parent=None):
        if isinstance(value,list):
            for i,x in enumerate(value):visit(x,(*parts,i),value)
            return
        if not isinstance(value,dict):return
        for key,item in value.items():
            location=ptr((*parts,key))
            if location in overrides:
                rule=overrides[location];need(rule.get('value')==item,f'Data-field value drift: {location}')
                need(rule.get('kind') in ('measurement-aggregate','intentional-negative-fixture','source-template-placeholder','recorded-source-absence','unexecuted-artifact-placeholder','diagnostic-algorithm-count','classifier-absent-runner-observation','human-plan-reference'),f'Invalid data-field role: {location}')
                if rule['kind']=='diagnostic-algorithm-count':
                    need(parts==('algorithmCounts',) and key in ('sha256','sha512')
                         and type(item) is int and item>=0 and isinstance(root,dict)
                         and root.get('kind')=='exact-missing-version-recovery-metadata-diagnosis'
                         and set(value)<= {'sha256','sha512'}
                         and all(type(v) is int and v>=0 for v in value.values())
                         and isinstance(root.get('counts'),dict)
                         and sum(value.values())==root['counts'].get('uniqueMissingDigests'),
                         f'Invalid diagnostic algorithm count: {location}')
                if rule['kind']=='classifier-absent-runner-observation':
                    need(isinstance(root,list) and len(parts)==1 and type(parts[0]) is int
                         and key=='runnerSha256' and item is None
                         and set(value)=={'path','bytes','schema','keys','head','runner','runnerSha256'}
                         and isinstance(value['path'],str) and Path(value['path']).is_absolute()
                         and type(value['bytes']) is int and value['bytes']>=0
                         and value['schema'] in ('unmatched','built','native','tracked','nx')
                         and isinstance(value['keys'],list) and all(isinstance(k,str) for k in value['keys'])
                         and (value['runner'] is None or isinstance(value['runner'],str)),
                         f'Invalid classifier absent-runner observation: {location}')
                if rule['kind']=='human-plan-reference':
                    need(not parts and key=='planSha256' and isinstance(item,str) and HEX.fullmatch(item)
                         and isinstance(root,dict) and root.get('kind')=='H-executable-comparison-source-1-unexecuted'
                         and isinstance(root.get('plan'),str) and Path(root['plan']).is_absolute()
                         and Path(root['plan']).name=='PROTOCOL.md'
                         and root.get('runEvidence')=={'pythonAstParse':True,'javascriptSyntaxCheck':False,
                             'helper':False,'prepareBuild':False,'runtimeControls':False,'comparisons':False,'analysis':False}
                         and bool(rule.get('reason')) and bool(rule.get('evidence')),
                         f'Invalid human plan format: {location}')
                    # Keep the actual file identity; only its expected format is
                    # Markdown. Executed runtime plan fields stay forced JSON.
                    add(location,root['plan'],item,json_expected=False)
                    metadata.append({'pointer':location,'kind':rule['kind'],'value':item,
                                     'reason':rule['reason'],'evidence':rule['evidence']})
                    used.add(location);continue
                if rule['kind']=='recorded-source-absence':
                    relative=parts[1] if len(parts)==2 and parts[0]=='files' else None
                    need(item is None and key=='baselineSha256'
                         and isinstance(relative,str) and relative.startswith('packages/kernel/src/')
                         and '..' not in Path(relative).parts and not Path(relative).is_absolute()
                         and isinstance(root,dict) and isinstance(root.get('baseHead'),str)
                         and re.fullmatch(r'[0-9a-f]{40}',root['baseHead'])
                         and isinstance(value.get('candidateSha256'),str) and HEX.fullmatch(value['candidateSha256']),
                         f'Invalid recorded source absence: {location}')
                if rule['kind']=='unexecuted-artifact-placeholder':
                    unexecuted=(root.get('kind')=='sparse-terminal-facets-method-bindings-v1'
                                and root.get('admissionStatus')=='AWAITING actual candidate artifact SHA and new frozen review; execution prohibited') or (
                                root.get('kind')=='sparse-terminal-facets-neutral-comparison-proposal-v1'
                                and root.get('status')=='unexecuted-awaiting-candidate-pin')
                    need(item is None and key=='sha256' and parts==('candidate',)
                         and isinstance(value.get('path'),str) and Path(value['path']).is_absolute()
                         and unexecuted,f'Invalid unexecuted artifact placeholder: {location}')
                if rule['kind']=='source-template-placeholder':
                    need(not os.path.isabs(key) and isinstance(item,str)
                         and item==SOURCE_TEMPLATE_TOKENS.get(key),f'Invalid source-template token: {location}')
                    evidence_copy=(Path(original).is_absolute() and isinstance(rule.get('evidence'),list)
                         and any(isinstance(entry,dict) and entry.get('path')==original
                                 and entry.get('sha256')==doc_digest for entry in rule['evidence']))
                    native_template=((Path(original).name=='config.example.json' or original=='hash:sha256:'+doc_digest or evidence_copy) and not parts
                         and isinstance(root,dict) and root.get('kind')=='native-final-config-v1'
                         and key in ('artifactPlanSha256','dispatchBuildSha256'))
                    ledger_template=((Path(original).name=='ledger-config.example.json' or original=='hash:sha256:'+doc_digest or evidence_copy)
                         and len(parts)==2 and parts[0]=='arms' and parts[1] in ('C1','L1','L2','L3')
                         and isinstance(root,dict) and isinstance(root.get('arms'),dict)
                         and set(root['arms'])=={'C1','L1','L2','L3'}
                         and root['arms'][parts[1]] is value and key=='manifestSha256')
                    need(native_template or ledger_template,f'Invalid source-template field: {location}')
                need(bool(rule.get('reason')) and bool(rule.get('evidence')),f'Unexplained data-field rule: {location}')
                if os.path.isabs(key):need(rule['kind']=='intentional-negative-fixture','Cannot excuse an absolute file binding as an aggregate')
                metadata.append({'pointer':location,'kind':rule['kind'],'value':item,'reason':rule['reason'],'evidence':rule['evidence']});used.add(location);continue
            if os.path.isabs(key) and isinstance(item,str):
                if HEX.fullmatch(item):add(location,key,item)
                elif parts and parts[-1] in MAPS:raise SelectionError(f'Malformed explicit binding: {original}{location}')
            elif os.path.isabs(key) and parts and parts[-1] in MAPS and not isinstance(item,dict):
                raise SelectionError(f'Malformed explicit binding: {original}{location}')
            elif key in ('archiveSha256','artifactBindingSha256') and isinstance(item,dict):
                need(bool(item),f'Empty file hash mapping: {location}')
                for label,expected in item.items():
                    need(isinstance(label,str) and bool(label),f'Invalid file hash mapping label: {location}')
                    add(ptr((*parts,key,label)),label if os.path.isabs(label) else None,expected)
                continue
            elif key=='sha256' or key.endswith('Sha256'):
                # This integration receipt records newly added source files,
                # whose predecessor has no payload/hash. Do not treat general
                # null digests or a missing candidate payload as optional.
                if (item is None and key=='beforeSha256' and isinstance(root,dict)
                    and root.get('kind') in ('T-U-provisional-successor-integration','H-exact-source-integration')
                    and len(parts)==2 and parts[0]=='files' and isinstance(parts[1],int)):
                    name=value.get('path')
                    need(isinstance(name,str) and name.startswith('packages/kernel/src/')
                         and not Path(name).is_absolute() and '..' not in Path(name).parts,'Source-absence relative path')
                    need(all(isinstance(root.get(k),str) and re.fullmatch(r'[0-9a-f]{40}',root[k])
                         for k in ('baseHead','prototypeHead')),'Source-absence commit identity')
                    need(isinstance(value.get('afterSha256'),str) and HEX.fullmatch(value['afterSha256']),
                         'Source-absence successor identity')
                    if root['kind']=='T-U-provisional-successor-integration':
                        need(value.get('prototypeSha256')==value['afterSha256'],'Source-absence prototype identity')
                    else:
                        need(isinstance(root.get('measuredManifest'),str) and Path(root['measuredManifest']).is_absolute()
                             and isinstance(root.get('measuredManifestSha256'),str)
                             and HEX.fullmatch(root['measuredManifestSha256']),'Source-absence measured artifact identity')
                    need(not value.get('before') and not value.get('beforePath') and not value.get('beforeFile'),'Source-absence conflicting predecessor')
                    metadata.append({'pointer':location,'kind':'recorded-predecessor-source-absence','value':None});continue
                if item is None and key in NULLABLE:
                    prefix=key[:-6]
                    need(not value.get(prefix) and not value.get(prefix+'Path'),f'Null hash with present artifact: {location}')
                    metadata.append({'pointer':location,'kind':'absent-optional-config','value':None});continue
                # Actual context snapshots contain row/byte counts and first /
                # repeated timings, but not a saved JSON file. These hashes
                # describe serialized domain content, not an input file.
                context=key in ('sha256','canonicalSha256') and isinstance(value.get('rows'),int) and isinstance(value.get('bytes'),int) and 'first' in value and 'repeated' in value
                if context:
                    need(isinstance(item,str) and HEX.fullmatch(item),f'Malformed context digest: {location}')
                    need(not any(value.get(n) for n in ['path','file','archive','originalPath']),f'Ambiguous context/file digest: {location}')
                    metadata.append({'pointer':location,'kind':'serialized-context-value-digest','value':item});continue
                # Frozen bucket-cost records hash serialized values/held snapshots;
                # they do not write payload files. File/module identities elsewhere
                # retain the ordinary required-reference grammar.
                bucket_record=root;bucket_parts=parts
                bucket_producer=(isinstance(root,dict)
                    and root.get('runnerSha256')=='ef8e10dc4ca18dea72b5dcfcd06e9266ff959adb02c81c3b04ffb6efa00035f6'
                    and isinstance(root.get('packetPath'),str) and Path(root['packetPath']).is_absolute()
                    and isinstance(root.get('packetSha256'),str) and HEX.fullmatch(root['packetSha256']))
                if not bucket_producer:
                    for width in (2,3):
                        prefix=parts[:-width]
                        if prefix in copied_bucket_records:
                            bucket_record=copied_bucket_records[prefix];bucket_parts=parts[-width:];bucket_producer=True;break
                bucket_root=(bucket_producer and isinstance(bucket_record.get('sample'),dict)
                    and bucket_record['sample'].get('kind') in ('cpu','heap','control','heap-control')
                    and bucket_record['sample'].get('arm') in ('C1','O16','K16','V15','K15')
                    and isinstance(bucket_record['sample'].get('profile'),dict)
                    and bucket_record['sample']['profile'].get('shape') in ('scalar','entity')
                    and bucket_record['sample']['profile'].get('settlement') in ('confirm','rollback')
                    and type(bucket_record['sample']['profile'].get('count')) is int and bucket_record['sample']['profile']['count']>0)
                phase=(bucket_parts[1] if len(bucket_parts)==2 and bucket_parts[0]=='oracles' and bucket_parts[1] in ('empty','pending','settled') else
                       'steps' if len(bucket_parts)==3 and bucket_parts[:2]==('oracles','steps') and type(bucket_parts[2]) is int else None)
                shapes={'empty':{'pending','confirmed','valuesSha256'},
                        'pending':{'pending','ids','valuesSha256','snapshotSha256'},
                        'settled':{'pending','ids','confirmed','valuesSha256','heldSnapshotSha256'},
                        'steps':{'pending','ids','turnId','valuesSha256','heldSnapshotSha256'}}
                if bucket_root and phase and key in ('valuesSha256','snapshotSha256','heldSnapshotSha256'):
                    need(set(value)==shapes[phase],f'Ambiguous bucket value/file digest shape: {location}')
                    need(isinstance(item,str) and HEX.fullmatch(item),f'Malformed bucket value digest: {location}')
                    need(type(value['pending']) is int and value['pending']>=0,f'Invalid bucket pending shape: {location}')
                    if 'ids' in value:need(isinstance(value['ids'],list) and all(type(x) is int and x>0 for x in value['ids'])
                                          and len(value['ids'])==value['pending'],f'Invalid bucket ids shape: {location}')
                    if 'confirmed' in value:need(type(value['confirmed']) is int and value['confirmed']>=0,f'Invalid bucket confirmed shape: {location}')
                    if 'turnId' in value:need(type(value['turnId']) is int and value['turnId']>0,f'Invalid bucket turn shape: {location}')
                    metadata.append({'pointer':location,'kind':'bucket-serialized-value-digest','value':item});continue
                named=scalar_target(key,value,parts)
                if named is None and key=='sha256' and parts and isinstance(parts[-1],str) and os.path.isabs(parts[-1]):named=parts[-1]
                add(location,named,item,json_expected=key in JSON_FIELDS)
            elif key=='integrity' and isinstance(value.get('archive'),str):
                match=re.fullmatch(r'(sha256|sha512)-([A-Za-z0-9+/]+={0,2})',str(item));need(match,f'Malformed local archive SRI: {location}')
                add(location,target(value['archive']),base64.b64decode(match[2],validate=True).hex(),match[1])
            elif isinstance(item,str) and HEX.fullmatch(item) and parts and parts[-1] in MAPS:
                # Relative package manifests carry their root explicitly. Other
                # relative source maps remain hash-only unless they name files.
                root_path=parent.get('root') if isinstance(parent,dict) else None
                path=None
                if isinstance(root_path,str) and os.path.isabs(root_path):
                    need(not key.startswith('/') and '..' not in Path(key).parts,f'Unsafe relative package payload: {key}')
                    path=str(Path(root_path)/key)
                add(location,path,item)
            visit(item,(*parts,key),value)
    visit(root)
    need(set(overrides)==used,f'Unused data-field rule: {set(overrides)-used}')
    return sorted(refs,key=lambda x:(x['pointer'],x['original'],x['expected'])), sorted(metadata,key=lambda x:x['pointer'])

def role(path):
    n=path.name
    if n=='proposals':return 'proposal-history-not-an-execution-claim'
    if n=='reviews':return 'independent-review-records-not-test-results'
    if 'source' in n or 'untracked' in n:return 'frozen-source-history'
    if 'command' in n or any(x in n for x in ['witness','candidate-check','retention','gates','typecheck','diffcheck','mutant','format','lint','focused','install']):return 'command-or-validation-attempts-including-failures'
    if 'build' in n or 'packet' in n:return 'identified-artifacts-and-preparation-attempts'
    if any(x in n for x in ['screen','comparison','controls','calibration','cpu','heap','diagnostic','helper','capture']):return 'cohort-or-control-attempts-including-failures'
    if 'analysis' in n or path.is_file():return 'analysis-or-registration-records'
    return 'needs-explicit-classification'

def catalog(root,out):
    root=Path(root).absolute();need(root.is_dir(),'Missing evidence root');need(not Path(out).exists(),'Preserve catalog')
    roots=[]
    for p in sorted(root.iterdir()):
        if p.name in SKIP or p.name=='.DS_Store':continue
        need(not p.is_symlink(),f'Unexpected top-level symlink: {p}')
        names=sorted(x.name for x in p.iterdir() if x.is_file()) if p.is_dir() else [p.name]
        roots.append({'path':str(p),'role':role(p),'topLevelFiles':names,'scope':'Preserve bytes; success/completeness remains a raw-receipt interpretation, never inferred from directory name.'})
    r=Path(__file__).resolve();repo=r.parents[2]
    # Caller reviews the exact root list, adds final late cohorts and artifact
    # roots, and supplies exact git revisions; there is no recursive repo crawl.
    save(out,{'format':'optimization-selection-config-v1','evidenceRoot':str(root),'roots':roots,'extraFiles':[str(r)],'recoveryRoots':[],
      'gitRecovery':[],'recoveryArchives':[],'dataFields':[],'legacyVerifier':str(repo/'tools/application-lab/archive-evidence.py'),
      'limits':'Metadata-only catalog, no payload hashes or closure claim. Review needs-explicit-classification roots; final committed source/packages/apps must be added before preparation.'})

def walk_files(path):
    path=Path(path)
    if path.is_file():yield path;return
    need(path.is_dir() and not path.is_symlink(),f'Unsafe selection root: {path}')
    for directory,dirs,files in os.walk(path,followlinks=False):
        dirs[:]=sorted(n for n in dirs if n not in SKIP and not (Path(directory)/n).is_symlink())
        for n in sorted(files):
            p=Path(directory)/n
            if n=='.DS_Store' or p.is_symlink():continue
            need(p.is_file(),f'Nonregular input: {p}');yield p

"""Isolated role-policy proposal, not an applied archive selector.

The caller supplies the existing strict parse/refs_from and exact-byte resolver.
Registrations are reviewed, digest-pinned producer contracts, NOT inferred from
file names or a generic bindings/files key. Every yielded edge still requires
its exact bytes. These functions do not make any measurement/release claim.
"""
from collections import deque
from pathlib import PurePosixPath
import hashlib
import re

ROLE_HEX = re.compile(r'^[0-9a-f]{64}$')
ROLE_HEAD = re.compile(r'^[0-9a-f]{40}$')
PAYLOAD = 'byte-payload'
EVIDENCE = 'evidence'


def role_need(ok, message):
    if not ok:
        raise ValueError(message)


def role_sha(data):
    return hashlib.sha256(data).hexdigest()


def role_pointer(*parts):
    return '/' + '/'.join(str(x).replace('~', '~0').replace('/', '~1') for x in parts)


def normalized_root(value):
    role_need(isinstance(value, str) and value.startswith('/'), 'Absolute inventory root required')
    path = PurePosixPath(value)
    role_need('..' not in path.parts and str(path) == value, 'Noncanonical inventory root')
    return path


def relative_name(value):
    role_need(isinstance(value, str) and value and not value.startswith('/'), 'Relative payload name required')
    path = PurePosixPath(value)
    role_need('..' not in path.parts and str(path) == value, 'Unsafe payload name')
    return path


def digest_map(value):
    role_need(isinstance(value, dict) and value, 'Nonempty exact inventory required')
    role_need(all(isinstance(k, str) and isinstance(v, str) and ROLE_HEX.fullmatch(v)
             for k, v in value.items()), 'Malformed inventory digest')


def inventory_edges(data, original, registration, strict_parse):
    """Return ONLY validated byte-payload edges for a pinned inventory document.

    Unlisted fields stay with the original evidence parser. Source maps are not
    generic aliases for any object named bindings. The caller must additionally
    enqueue registration producer/contract references as evidence.
    """
    document_digest = role_sha(data)
    role_need(registration['document']['original'] == original, 'Inventory original identity drift')
    role_need(document_digest == registration['documentDigest'] == registration['document']['expected'],
         'Inventory document drift')
    role_need(registration.get('producer') and registration.get('contractEvidence'),
         'Missing independently reviewed producer/contract bindings')
    for link in [registration['producer'], *registration['contractEvidence']]:
        role_need(isinstance(link, dict) and isinstance(link.get('original'), str)
             and isinstance(link.get('expected'), str) and ROLE_HEX.fullmatch(link['expected']),
             'Malformed role provenance identity')
    obj = strict_parse(data)
    role_need(isinstance(obj, dict), 'Inventory document object required')
    kind = registration['schema']
    root = normalized_root(registration['root'])
    leaves = {}

    def add(parts, path, expected):
        loc = role_pointer(*parts)
        role_need(loc not in leaves, 'Duplicate role edge')
        leaves[loc] = {'pointer': loc, 'original': str(path), 'algorithm': 'sha256',
                       'expected': expected, 'jsonExpected': False,
                       'traversalRole': PAYLOAD,
                       'roleProof': {'documentDigest': document_digest, 'schema': kind,
                                     'inventoryPointer': loc}}

    def absolute_map(field, expected_root):
        values = obj[field]
        digest_map(values)
        for name, expected in values.items():
            path = normalized_root(name)
            relative = path.relative_to(expected_root)
            role_need(relative.parts, 'Inventory names root itself')
            add((field, name), path, expected)
        return values

    if kind == 'tracked-source-inventory-v1':
        role_need(set(obj) in ({'head', 'bindings'}, {'head', 'bindings', 'runner', 'runnerSha256'}),
             'Not a tracked-source record')
        role_need(obj.get('head') == registration['head'] and ROLE_HEAD.fullmatch(obj['head']),
             'Tracked source HEAD mismatch')
        if 'runner' in obj:
            role_need(obj['runner'] == registration['producer']['original']
                 and obj['runnerSha256'] == registration['producer']['expected'],
                 'Recorded source producer mismatch')
        absolute_map('bindings', root)
    elif kind == 'nx-build-source-inventory-v1':
        role_need(obj.get('head') == registration['head'] and ROLE_HEAD.fullmatch(obj['head']),
             'Build source HEAD mismatch')
        role_need(obj.get('cwd') == str(root), 'Build source root mismatch')
        role_need(obj.get('command') == registration['command'], 'Build invocation mismatch')
        originals = absolute_map('bindings', root)
        snapshot_root = normalized_root(registration['snapshotRoot'])
        snapshots = absolute_map('snapshots', snapshot_root)
        expected_snapshots = {str(snapshot_root / PurePosixPath(p).relative_to(root)): h
                              for p, h in originals.items()}
        role_need(snapshots == expected_snapshots, 'Build snapshots must exactly mirror source inputs')
        role_need(ROLE_HEX.fullmatch(obj.get('patchSha256', '')), 'Build patch identity required')
        # Deliberately do not require a successful build: failed attempts also
        # preserve exact source snapshots. Their outcome is a separate claim.
    elif kind == 'built-package-inventory-v1':
        role_need(obj.get('kind') in ('identified-built-kernel-v1', 'identified-built-package-v1'),
             'Not an identified built-package record')
        role_need(obj.get('head') == registration['head'] and ROLE_HEAD.fullmatch(obj['head']),
             'Package source HEAD mismatch')
        role_need(obj.get('root') == str(root), 'Package payload root mismatch')
        role_need(isinstance(obj.get('buildReceipt'), str)
             and ROLE_HEX.fullmatch(obj.get('buildReceiptSha256', '')), 'Package build provenance required')
        digest_map(obj.get('files'))
        for name, expected in obj['files'].items():
            add(('files', name), root / relative_name(name), expected)
    elif kind == 'native-packet-package-inventory-v1':
        role_need(obj.get('kind') == 'native-final-packet-v1', 'Not a native packet')
        role_need(isinstance(obj.get('originalPlan'), dict)
             and ROLE_HEX.fullmatch(obj['originalPlan'].get('sha256', '')),
             'Native original plan identity required')
        digest_map(obj.get('bindings'))
        known = {}

        def group(parts, package_root, files, hash_only=False):
            package_root = normalized_root(package_root)
            digest_map(files)
            for name, expected in files.items():
                path = package_root / relative_name(name)
                role_need(str(path) not in known or known[str(path)] == expected,
                     'Conflicting package inventory identities')
                known[str(path)] = expected
                add((*parts, 'files', name), path, expected)
                if hash_only:
                    # source6's generic parser knows no root for buildDependencies;
                    # retain that hash-only edge identity while recording its
                    # actual package path in the role proof.
                    edge = leaves[role_pointer(*parts, 'files', name)]
                    edge['roleProof']['payloadOriginal'] = str(path)
                    edge['original'] = 'hash:sha256:' + expected

        for arm, packages in obj['allPackages'].items():
            for name, package in packages.items():
                group(('allPackages', arm, name), package['root'], package['files'])
        for name, package in obj['browserExecution']['packages'].items():
            group(('browserExecution', 'packages', name), package['root'], package['files'])
        for package_root, package in obj['buildDependencies'].items():
            role_need(isinstance(package.get('name'), str) and isinstance(package.get('version'), str),
                 'Build dependency package identity required')
            group(('buildDependencies', package_root), package_root, package['files'], True)
        for path, expected in obj['bindings'].items():
            if path in known:
                role_need(expected == known[path], 'Native package binding drift')
                add(('bindings', path), path, expected)
    else:
        raise ValueError('Unknown inventory role schema')
    return leaves


def annotate_references(refs, leaves):
    """An exact field join; no prefix-wide or digest-wide downgrade."""
    found = set()
    output = []
    for ref in refs:
        leaf = leaves.get(ref['pointer'])
        if leaf:
            role_need(all(ref[k] == leaf[k] for k in ('original', 'algorithm', 'expected')),
                 'Role rule does not match parser edge')
            output.append({**ref, 'traversalRole': PAYLOAD, 'roleProof': leaf['roleProof']})
            found.add(ref['pointer'])
        else:
            output.append({**ref, 'traversalRole': EVIDENCE})
    role_need(found == set(leaves), 'Inventory edge missing from strict reference parser')
    return output


def selected_archive_references(manifest, document_digest, selection, owner):
    """Separate selective-index contract: manifest remains verified evidence.

    `selection` must be DERIVED from the pinned consuming recovery/plan receipt,
    not handpicked to make missing references disappear. This function validates
    each exact original/digest membership; the caller verifies every selected
    byte payload and recursively handles selected evidence documents. Unselected
    index rows are retained metadata, not a claim of complete old-archive closure.
    It does not replace full-archive semantics when that is actually requested.
    """
    role_need(owner['manifestDigest'] == document_digest, 'Selective index identity mismatch')
    role_need(owner.get('mode') == 'selected-membership-only'
         and owner.get('producer') and owner.get('selectionReceipt'), 'Missing selection authority')
    role_need(manifest.get('format') == 'signaltree-study-evidence-v1', 'Unknown prior index format')
    entries = manifest.get('entries')
    payloads = manifest.get('payloads')
    role_need(isinstance(entries, list) and isinstance(payloads, dict), 'Malformed prior index')
    identities = set()
    for entry in entries:
        key = (entry.get('original'), entry.get('sha256'))
        role_need(isinstance(key[0], str) and isinstance(key[1], str) and ROLE_HEX.fullmatch(key[1]),
             'Malformed prior original/version mapping')
        role_need(key not in identities, 'Duplicate prior original/version mapping')
        identities.add(key)
    refs = []
    selected = set()
    for ref in selection:
        key = (ref['original'], ref['expected'])
        role_need(ref['algorithm'] == 'sha256' and key in identities, 'Selected prior version missing')
        role_need(key not in selected, 'Duplicate selected prior identity')
        selected.add(key)
        record = payloads.get(key[1])
        role_need(isinstance(record, dict) and record.get('sha256') == key[1]
             and record.get('path') == 'payloads/sha256/' + key[1], 'Prior selected payload mapping invalid')
        # Selection defaults to evidence. A byte leaf still needs its separately
        # validated source/package roleProof, not the fact it came from an archive.
        role_need(ref.get('traversalRole', EVIDENCE) != PAYLOAD or ref.get('roleProof'),
             'Prior archive is not authority to downgrade evidence')
        refs.append({**ref, 'traversalRole': ref.get('traversalRole', EVIDENCE),
                     'selectedFrom': {'manifestDigest': document_digest,
                                      'member': record['path'], 'original': key[0]}})
    role_need(bool(refs), 'Empty selective claim requires explicit separate disposition')
    return refs


def recovery_selection(data, registration, strict_parse, plan_data, builds):
    """Actual recover-predecessor.py receipt contract; no chosen subset argument."""
    role_need(role_sha(data) == registration['selectionReceipt']['expected'], 'Recovery receipt drift')
    obj = strict_parse(data)
    role_need(obj.get('manifestSha256') == registration['manifestDigest'], 'Recovery manifest drift')
    role_need(obj.get('manifestPath') == registration['manifestOriginal'], 'Recovery manifest path drift')
    role_need(obj.get('sourceCommit') == '5d04ff65d2eaab1986ed1b420cbc013edc01542b',
         'Different predecessor recovery producer contract')
    role_need(obj.get('command') == registration['command'], 'Recovery invocation drift')
    digest_map(obj.get('restoredInputs'))
    restored = obj['restoredInputs']
    packet = '/private/tmp/st-final-application-packet'
    role_need(role_sha(plan_data) == restored.get(packet + '/plan.json'), 'Recovered prior plan identity')
    plan = strict_parse(plan_data)
    required = dict(plan['inputs'])
    digest_map(required)
    mandatory = {packet + '/plan.json': role_sha(plan_data)}
    role_need(set(builds) == {'build.json', 'dispatch-build.json'}, 'Prior build pair incomplete')
    for name, contents in builds.items():
        role_need(role_sha(contents) == restored.get(packet + '/' + name), 'Recovered build identity')
        built = strict_parse(contents)
        role_need(built.get('planSha256') == role_sha(plan_data), 'Recovered build/plan join')
        mandatory[packet + '/' + name] = role_sha(contents)
        for arm in built['arms'].values():
            for category in ['dependencies', 'served']:
                digest_map(arm[category])
                for path, expected in arm[category].items():
                    role_need(path not in required or required[path] == expected, 'Conflicting recovered input')
                    required[path] = expected
    # The exact old producer's TMPDIR/root aliases are reviewed registration
    # data, not a new current-machine realpath lookup during extracted replay.
    roots = [normalized_root(x) for x in registration['temporaryRoots']]
    aliases = registration.get('temporaryAliases', {})

    def temporary(path):
        name = path
        for old, new in sorted(aliases.items(), key=lambda x: len(x[0]), reverse=True):
            normalized_root(old); normalized_root(new)
            if name == old or name.startswith(old + '/'):
                name = new + name[len(old):]
                break
        p = normalized_root(name)
        return any(p == r or r in p.parents for r in roots)

    expected_restored = {**mandatory, **{p: h for p, h in required.items() if temporary(p)}}
    for name in ['package.json', 'package-lock.json']:
        path = plan['toolchainDirectory'] + '/' + name
        role_need(path in restored, 'Missing restored toolchain identity')
        # recover-predecessor selects these by unique original version in the
        # manifest. selected_archive_references checks that original/digest.
        expected_restored[path] = restored[path]
    role_need(restored == expected_restored, 'Recovery receipt omits/adds a producer-selected input')
    selected = dict(restored)
    role_need(set(obj.get('packages', {})) == {'kernel', 'angular'}, 'Recovery package set')
    prefix = '/private/tmp/st-final-application-packet/v16/node_modules/@signal-tree/'
    for package, count in [('kernel', 144), ('angular', 16)]:
        files = obj['packages'][package]
        digest_map(files)
        role_need(len(files) == count, 'Recovery package membership count')
        plan_files = {p[len(prefix + package + '/'):]: h for p, h in plan['inputs'].items()
                      if p.startswith(prefix + package + '/')}
        role_need(files == plan_files, 'Recovered package membership differs from prior plan')
        for name, expected in files.items():
            path = prefix + package + '/' + str(relative_name(name))
            role_need(path not in selected or selected[path] == expected, 'Recovery conflicting selected version')
            selected[path] = expected
    return [{'original': path, 'algorithm': 'sha256', 'expected': expected,
             'traversalRole': EVIDENCE, 'pointer': '/selected-recovery/' + str(i)}
            for i, (path, expected) in enumerate(sorted(selected.items()))]


def historical_selection(plan_data, config_data, registration, strict_parse):
    """Actual historical-inputs.mjs selections, checked against its allowlist."""
    role_need(role_sha(plan_data) == registration['plan']['expected'], 'Historical plan drift')
    role_need(role_sha(config_data) == registration['config']['expected'], 'Historical allowlist drift')
    plan, config = strict_parse(plan_data), strict_parse(config_data)
    role_need(config.get('manifestSha256') == registration['manifestDigest'], 'Historical manifest drift')
    root = normalized_root(config['root'])
    allowed = {(x['original'], x['sha256']) for x in config['allowedHistoricalVersions']}
    versions = plan['runtimeRefresh']['historicalVersions']
    selected = []
    for i, value in enumerate(versions):
        key = (value['original'], value['sha256'])
        role_need(key in allowed, 'Historical version was not allowlisted')
        expected_path = str(root / 'payloads' / 'sha256' / key[1])
        role_need(value.get('resolved') == expected_path and plan['inputs'].get(expected_path) == key[1],
             'Historical selection not joined to actual installed input')
        selected.append({'original': key[0], 'algorithm': 'sha256', 'expected': key[1],
                         'traversalRole': EVIDENCE, 'pointer': role_pointer('runtimeRefresh', 'historicalVersions', i)})
    return selected


# Roles describe the claim made by an edge, never whether its bytes are required.
class RolePolicy:
    def __init__(self, config, read_exact):
        self.config=config; self.read_exact=read_exact
        self.inventories={}; self.leaves=set(); self.overrides={}; self.indexes={}; self.anchors=[]
        self.fields={}; self.aggregates={}; self.inspection_parent_refs={}
        for item in config.get('dataFields',[]):self.fields.setdefault(item['documentDigest'],[]).append(item)
        for item in config.get('aggregateValueCopies',[]):self.aggregates.setdefault(item['documentDigest'],[]).append(item)
        for registration in config.get('inventoryRoles',[]):
            link=registration['document']; need(link['expected']==registration['documentDigest'],'Inventory registration identity mismatch')
            data=self.bound(link); leaves=inventory_edges(data,link['original'],registration,parse)
            if registration['documentDigest'] in self.inventories:
                need(self.inventories[registration['documentDigest']]==leaves,'Conflicting inventory registration')
            self.inventories[registration['documentDigest']]=leaves
            self.leaves.update((x['original'],x['expected']) for x in leaves.values())
            for authority in [link,registration['producer'],*registration['contractEvidence']]:self.anchor(authority)
        for item in config.get('sourceInspectionEdges',[]):
            need(item.get('reason') and item.get('evidence'),'Unexplained source inspection edge')
            need(HEX.fullmatch(item['documentDigest']) and HEX.fullmatch(item['expected']),'Invalid source inspection digest')
            need(isinstance(item.get('pointer'),str) and item['pointer'].startswith('/'),'Invalid source inspection pointer')
            key=(item['documentDigest'],item['pointer']);need(key not in self.overrides,'Duplicate source inspection edge')
            need(isinstance(item.get('document'),dict),'Source inspection parent required')
            parent=item['document'];need(parent['expected']==item['documentDigest'],'Source inspection parent identity mismatch')
            parent_key=(parent['original'],parent['expected'])
            if parent_key not in self.inspection_parent_refs:
                data=self.bound(parent)
                self.inspection_parent_refs[parent_key]=refs_from(data,parent['original'],self.fields.get(parent['expected'],()),self.aggregates.get(parent['expected'],()))[0]
            parent_refs=self.inspection_parent_refs[parent_key]
            matches=[r for r in parent_refs if r['pointer']==item['pointer']]
            need(len(matches)==1,'Source inspection pointer missing or ambiguous')
            ref=matches[0]
            need(not ref['jsonExpected'],'Cannot downgrade an explicit JSON evidence field')
            need((ref['original'],ref['expected'])==(item['original'],item['expected']),'Source inspection target mismatch')
            self.overrides[key]=item;self.leaves.add((item['original'],item['expected']))
            self.anchor(parent)
            for authority in item['evidence']:self.anchor(authority)
        need(not config.get('sourcePayloadAliases'),'Unvalidated source alias rules are unsupported')
        for owner in config.get('selectiveArchiveIndexes',[]):
            manifest=owner['manifest'];need(manifest['expected']==owner['manifestDigest'],'Index identity mismatch')
            data=self.bound(manifest);obj=parse(data)
            schema=owner['selectionSchema']
            if schema=='recover-predecessor-v1':
                selection=recovery_selection(self.bound(owner['selectionReceipt']),owner,parse,self.bound(owner['plan']),
                                             {name:self.bound(link) for name,link in owner['builds'].items()})
                authorities=[owner['selectionReceipt'],owner['plan'],*owner['builds'].values()]
            elif schema=='historical-inputs-v1':
                selection=historical_selection(self.bound(owner['plan']),self.bound(owner['config']),owner,parse)
                authorities=[owner['plan'],owner['config']]
            else:raise SelectionError('Unknown selective archive contract')
            refs=selected_archive_references(obj,owner['manifestDigest'],selection,owner)
            current=self.indexes.setdefault(owner['manifestDigest'],{})
            # Union selections from every consuming owner. A later empty local
            # list cannot erase dependencies inherited from an earlier plan.
            for ref in refs:
                key=(ref['original'],ref['algorithm'],ref['expected'])
                if key in current:need(current[key]['expected']==ref['expected'],'Conflicting selected index version')
                else:current[key]=ref
            for authority in [manifest,owner['producer'],*authorities,*owner.get('contractEvidence',[])]:self.anchor(authority)
        self.final=set()
        for required in config.get('finalRequirements',[]):
            need(required.get('status')=='sealed' and isinstance(required.get('id'),str),'Unsealed final role obligation')
            link={'original':required['receiptPath'],'expected':required['receiptDigest']}
            need(Path(link['original']).is_absolute(),'Final receipt path must be absolute')
            self.anchor(link);self.anchors[-1]['jsonExpected']=True
            self.final.add((link['original'],link['expected']))
        self.explicit={(x['original'],x['expected']) for x in config.get('explicitEvidenceRoots',[])}
        for link in config.get('explicitEvidenceRoots',[]):self.anchor(link)
    def bound(self, link):
        need(isinstance(link.get('original'),str) and isinstance(link.get('expected'),str) and HEX.fullmatch(link['expected']),'Malformed role authority')
        ref={'original':link['original'],'algorithm':'sha256','expected':link['expected'],'jsonExpected':False,'traversalRole':EVIDENCE}
        data=self.read_exact(ref);need(digest(data)==link['expected'],'Role authority byte mismatch');return data
    def anchor(self, link):
        need(isinstance(link.get('original'),str) and isinstance(link.get('expected'),str) and HEX.fullmatch(link['expected']),'Malformed role anchor')
        self.anchors.append({'original':link['original'],'algorithm':'sha256','expected':link['expected'],'jsonExpected':False,'traversalRole':EVIDENCE})
    def seed(self, original, expected):
        key=(original,expected)
        return EVIDENCE if key in self.final or key in self.explicit or key not in self.leaves else PAYLOAD
    def references(self, data, original):
        h=digest(data)
        if h in self.indexes:
            refs=[self.indexes[h][k] for k in sorted(self.indexes[h])]
            return refs,[{'pointer':'/','kind':'selected-prior-archive-index','selectedVersions':len(refs),
                          'claim':'Exact full index bytes and all producer-derived selected members; unrelated historical payloads are not requalified.'}]
        refs,metadata=refs_from(data,original,self.fields.get(h,()),self.aggregates.get(h,()))
        refs=annotate_references(refs,self.inventories.get(h,{}))
        seen=set()
        for ref in refs:
            key=(h,ref['pointer']);rule=self.overrides.get(key)
            if rule:
                need(not ref['jsonExpected'],'Cannot downgrade an explicit JSON evidence field')
                need((ref['original'],ref['expected'])==(rule['original'],rule['expected']),'Source inspection edge drift')
                ref['traversalRole']=PAYLOAD
                ref['roleProof']={'documentDigest':h,'pointer':ref['pointer'],'kind':'exact-source-inspection','reason':rule['reason']}
                seen.add(key)
        need(seen=={k for k in self.overrides if k[0]==h},'Unmatched source inspection edge')
        return refs,metadata


def is_evidence_json(ref, data):
    if ref.get('jsonExpected') or Path(ref['original']).suffix.lower()=='.json':return True
    # Hash-only aliases lose extensions. A valid JSON object/array is still
    # traversed; mandatory semantic JSON links are forced by their field schema.
    if data.lstrip()[:1] in (b'{',b'['):
        try:return isinstance(parse(data),(dict,list))
        except (ValueError,SelectionError):return False
    return False


def replay_role_closure(config, catalog, read_exact):
    policy=RolePolicy(config,read_exact);queue=deque(policy.anchors);roles={};documents={}
    for item in catalog:
        queue.append({'original':item['original'],'algorithm':'sha256','expected':item['digest'],'jsonExpected':False,
                      'traversalRole':policy.seed(item['original'],item['digest'])})
    while queue:
        ref=queue.popleft();key=(ref['original'],ref['algorithm'],ref['expected'])
        role=ref.get('traversalRole',EVIDENCE);need(role in (EVIDENCE,PAYLOAD),'Unknown traversal role')
        rank=3 if role==EVIDENCE and ref.get('jsonExpected') else 2 if role==EVIDENCE else 1
        if roles.get(key,0)>=rank:continue
        data=read_exact(ref);need(digest(data,ref['algorithm'])==ref['expected'],'Role replay payload checksum')
        roles[key]=rank;identity=(ref['original'],digest(data))
        if role==EVIDENCE and is_evidence_json(ref,data):
            refs,metadata=policy.references(data,ref['original'])
            documents[identity]={'original':identity[0],'digest':identity[1],'references':refs,'metadata':metadata}
            queue.extend(refs)
    return roles,documents


class Closure:
    def __init__(self,config,out):
        self.config=config;self.out=out;self.index={};self.cache={};self.entries={};self.docs={};self.queue=deque();self.unresolved=[];self.selected=[]
        self.recovery=out/'recovery';self.recovery.mkdir();self.archive_readers=[];self.archives_indexed=False;self.git_trees={}
    def index_file(self,p):
        p=Path(p).absolute();key=str(p)
        if key not in self.cache:self.cache[key]=hashes(p)
        h=self.cache[key]
        for alg in ['sha256','sha512']:self.index.setdefault((alg,h[alg]),key)
        return h
    def enqueue(self,original,alg,expected,json_expected=False):self.queue.append({'original':original,'algorithm':alg,'expected':expected,'jsonExpected':json_expected})
    def git_recover(self,ref):
        if ref['original'].startswith('hash:'):return None
        for spec in self.config.get('gitRecovery',[]):
            for prefix in sorted(spec['prefixes'],key=len,reverse=True):
                try: relative=Path(ref['original']).relative_to(prefix).as_posix()
                except ValueError:continue
                for commit in spec['commits']:
                    need(re.fullmatch(r'[0-9a-f]{40}',commit),'Git recovery must name an exact commit, never HEAD/branch')
                    # A failed lookup is common for untracked evidence paths.
                    # Cache exact-commit membership; never infer content equality
                    # from a path or tree identity. Failed tree reads fall back
                    # to the original exact-byte lookup.
                    tree_key=(spec['repo'],commit)
                    if tree_key not in self.git_trees:
                        tree=subprocess.run(['git','-C',spec['repo'],'ls-tree','-r','--name-only','-z',commit],capture_output=True)
                        self.git_trees[tree_key]=set(os.fsdecode(p) for p in tree.stdout.split(b'\0') if p) if tree.returncode==0 else None
                    paths=self.git_trees[tree_key]
                    if paths is not None and relative not in paths:continue
                    cmd=['git','-C',spec['repo'],'show',f'{commit}:{relative}']
                    run=subprocess.run(cmd,capture_output=True)
                    if run.returncode==0 and digest(run.stdout,ref['algorithm'])==ref['expected']:
                        p=self.recovery/digest(run.stdout)
                        if not p.exists():p.write_bytes(run.stdout)
                        return p,{'kind':'exact-git-object','command':cmd,'expectedMatched':True}
                break
        return None
    def archive_recover(self,ref):
        if not self.archives_indexed:
            self.archives_indexed=True
            legacy=load_legacy(self.config['legacyVerifier'])
            for spec in self.config.get('recoveryArchives',[]):
                # Source-only predecessor archive: verify its entire supplied
                # hash once, but copy only requested matching payloads onward.
                need(HEX.fullmatch(spec['archiveDigest']),'Malformed predecessor archive digest')
                need(hashes(spec['archive'])['sha256']==spec['archiveDigest'],'Predecessor archive hash mismatch')
                reader=legacy.Reader(spec['archive'])
                try:
                    raw=reader.read('manifest.json')
                    need(reader.read('manifest.sha256')==(digest(raw)+'  manifest.json\n').encode(),'Predecessor manifest checksum')
                    manifest=parse(raw);need(manifest.get('format')==legacy.FORMAT,'Unknown predecessor archive format')
                    self.archive_readers.append((spec,reader,manifest))
                except Exception:reader.close();raise
        for spec,reader,manifest in self.archive_readers:
            for payload_digest,record in manifest['payloads'].items():
                if record.get(ref['algorithm'])!=ref['expected']:continue
                data=reader.read(record['path'])
                need(digest(data)==payload_digest and digest(data,ref['algorithm'])==ref['expected'],'Selected predecessor payload checksum')
                p=self.recovery/payload_digest
                if not p.exists():p.write_bytes(data)
                return p,{'kind':'selected-predecessor-payload','archive':spec['archive'],'archiveDigest':spec['archiveDigest'],'member':record['path']}
        return None
    def close(self):
        for _,reader,_ in self.archive_readers:reader.close()
    def resolve(self,ref):
        if not ref['original'].startswith('hash:') and Path(ref['original']).is_file():
            h=self.index_file(ref['original'])
            if h[ref['algorithm']]==ref['expected']:return Path(ref['original']),{'kind':'original-bytes-match'}
        match=self.index.get((ref['algorithm'],ref['expected']))
        if match:return Path(match),{'kind':'matching-frozen-content','originalPathMayDiffer':True}
        # Only requested content-addressed payloads are read, and their bytes
        # must match. A digest-shaped filename is never integrity evidence.
        if ref['algorithm']=='sha256':
            for root in self.config.get('contentAddressedRecoveryRoots',[]):
                p=Path(root)/ref['expected']
                if p.is_file():
                    need(not p.is_symlink(),'Symlink in content-addressed recovery')
                    h=self.index_file(p)
                    need(h['sha256']==ref['expected'],'Content-addressed recovery checksum')
                    return p,{'kind':'verified-content-addressed-recovery','source':str(p)}
        return self.git_recover(ref) or self.archive_recover(ref)
    def run(self):
        roots=self.config['roots'];need(roots,'Empty evidence selection')
        evidence=self.config.get('evidenceRoot')
        if evidence:
            current={str(p.absolute()) for p in Path(evidence).iterdir() if p.name not in SKIP and p.name!='.DS_Store'}
            registered={str(Path(item['path']).absolute()) for item in roots}
            need(current<=registered,f'New evidence roots require explicit selection: {sorted(current-registered)}')
        for required in self.config.get('finalRequirements',[]):
            need(required.get('status')=='sealed',f'Final evidence not sealed: {required["id"]}')
            path=required['receiptPath'];h=self.index_file(path)
            need(h['sha256']==required['receiptDigest'],f'Final receipt drift: {required["id"]}')
            self.selected.append({'original':str(Path(path).absolute()),'digest':h['sha256'],'role':'final-required-receipt'})
            self.enqueue(str(Path(path).absolute()),'sha256',h['sha256'])
        for item in roots:
            need(item['role']!='needs-explicit-classification',f'Unclassified selection: {item["path"]}')
            p=Path(item['path']).absolute();need(self.out!=p and p not in self.out.parents and self.out not in p.parents,'Output must be outside selected roots')
            for f in walk_files(p):
                h=self.index_file(f);self.selected.append({'original':str(f),'digest':h['sha256'],'role':item['role']});self.enqueue(str(f),'sha256',h['sha256'])
        for f in [*self.config.get('extraFiles',[]),self.config['legacyVerifier']]:
            h=self.index_file(f);self.selected.append({'original':str(Path(f).absolute()),'digest':h['sha256'],'role':'explicit-tool-or-final-artifact'});self.enqueue(str(Path(f).absolute()),'sha256',h['sha256'])
        for root in self.config.get('recoveryRoots',[]):
            for f in walk_files(root):self.index_file(f)
        def read_exact(ref):
            found=self.resolve(ref);need(found,f'Missing role authority: {ref}')
            data=found[0].read_bytes();need(digest(data,ref['algorithm'])==ref['expected'],'Role authority checksum')
            return data
        policy=RolePolicy(self.config,read_exact)
        for ref in self.queue:ref['traversalRole']=policy.seed(ref['original'],ref['expected'])
        self.queue.extend(policy.anchors)
        seen={}
        while self.queue:
            ref=self.queue.popleft();key=(ref['original'],ref['algorithm'],ref['expected'])
            role=ref.get('traversalRole',EVIDENCE);need(role in (PAYLOAD,EVIDENCE),'Unknown traversal role')
            rank=3 if role==EVIDENCE and ref.get('jsonExpected') else 2 if role==EVIDENCE else 1
            if seen.get(key,0)>=rank:continue
            seen[key]=rank
            try:
                resolved=self.resolve(ref);need(resolved,f'Expected version unavailable: {ref["original"]} {ref["expected"]}')
                p,method=resolved;h=self.index_file(p);need(h[ref['algorithm']]==ref['expected'],'Resolved version mismatch')
                identity=(ref['original'],h['sha256'])
                # Freeze a matching recovery copy for every resolved version.
                # Legacy packing then cannot substitute a changed current file.
                recovery=self.recovery/h['sha256']
                if not recovery.exists():shutil.copyfile(p,recovery)
                need(hashes(recovery)['sha256']==h['sha256'],'Recovery copy changed')
                entry={'original':ref['original'],'digest':h['sha256'],'sha512Digest':h['sha512'],'size':h['size'],'resolvedSource':str(p),'method':method,'traversalRole':role}
                if self.entries.get(identity,{}).get('traversalRole')==EVIDENCE:entry['traversalRole']=EVIDENCE
                self.entries[identity]=entry
                data=recovery.read_bytes() if role==EVIDENCE else b''
                is_json=role==EVIDENCE and is_evidence_json(ref,data)
                if is_json and identity not in self.docs:
                    references,metadata=policy.references(data,ref['original'])
                    self.docs[identity]={'original':ref['original'],'digest':h['sha256'],'references':references,'metadata':metadata}
                    for child in references:self.queue.append(child)
            except Exception as e:self.unresolved.append({'reference':ref,'error':str(e)})
        return not self.unresolved

def prepare(config_path,out):
    config=read(config_path);need(config.get('format')=='optimization-selection-config-v1','Wrong config schema');out=fresh(out)
    c=Closure(config,out)
    h=c.index_file(config_path);c.selected.append({'original':str(Path(config_path).absolute()),'digest':h['sha256'],'role':'exact-selection-configuration'});c.enqueue(str(Path(config_path).absolute()),'sha256',h['sha256'])
    try:ok=c.run()
    except Exception as e:
        c.unresolved.append({'stage':'selection-or-configuration','error':str(e)});ok=False
    finally:c.close()
    report={'complete':ok,'selectedRootCount':len(config['roots']),'selectedFileCount':len(c.selected),'resolvedVersionCount':len(c.entries),'parsedJsonVersions':len(c.docs),'unresolved':c.unresolved,
            'limits':'Missing versions remain failures. Metadata-only digest classifications do not verify serialized domain values. Source recovery proves bytes, not semantic qualification.'}
    save(out/'report.json',report)
    # Preserve partial discovery on every failure; never create an admissible
    # selection/closure until all declared dependency versions are resolved.
    save(out/'partial-documents.json',list(c.docs.values()))
    need(ok,'Unresolved versions/schema fields; inspect preserved report.json')
    documents=sorted(c.docs.values(),key=lambda x:(x['original'],x['digest']));entries=sorted(c.entries.values(),key=lambda x:(x['original'],x['digest']))
    refs=[]
    for entry in entries:
        refs.append({'sha256':entry['digest'],**({'path':entry['original']} if not entry['original'].startswith('hash:') else {})})
    closure={'format':FORMAT,'selector':{'path':str(Path(__file__).resolve()),'sha256':hashes(__file__)['sha256']},'config':config,
             'catalog':c.selected,'versions':entries,'documents':documents,'payloadReferences':refs,
             'limits':['Every selected byte payload is checksum-verified. Evidence document references and payload roles are reconstructed after extraction; source-only historical documents are not requalified.',
                       'Proposal/review files are preserved under labelled roles, not credited as executed results. No authenticity or semantic test-pass guarantee.']}
    save(out/'closure.json',closure)
    # Every JSON alias/version is opaque to the legacy parser, including hash-
    # only JSONs (those aliases have no .json suffix and are naturally opaque).
    files=[]
    for entry in entries:
        if not entry['original'].startswith('hash:'):
            files.append({'path':entry['original'],'sha256':entry['digest'],'opaque':True})
    files.append({'path':str(out/'closure.json'),'sha256':hashes(out/'closure.json')['sha256'],'opaque':True})
    # Separate simple linkage document is parsed by the unmodified verifier.
    save(out/'legacy-links.json',{'references':refs,'closure':{'path':str(out/'closure.json'),'sha256':hashes(out/'closure.json')['sha256']}})
    files.append({'path':str(out/'legacy-links.json'),'sha256':hashes(out/'legacy-links.json')['sha256']})
    save(out/'selection.json',{'files':files})
    print(json.dumps({'complete':True,'selection':str(out/'selection.json'),'recovery':str(c.recovery),'closureDigest':hashes(out/'closure.json')['sha256'],'versions':len(entries)}))

def load_legacy(path):
    spec=importlib.util.spec_from_file_location('study_archive_legacy',path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module

def verify_extracted(root,closure_digest):
    root=Path(root);need(HEX.fullmatch(closure_digest),'Malformed closure digest')
    legacy=load_legacy(root/'archive-evidence.py');manifest=legacy.verify_source(root)
    payload=root/'payloads/sha256';raw=(payload/closure_digest).read_bytes();closure=parse(raw)
    need(closure['format']==FORMAT and digest(raw)==closure_digest,'Closure identity mismatch')
    need(hashes(__file__)['sha256']==closure['selector']['sha256'],'Run the exact archived selector version')
    indexed={(x['original'],x['sha256']):x for x in manifest['entries']}
    algorithm_versions={}
    for entry in manifest['entries']:
        record=manifest['payloads'][entry['sha256']]
        for alg in ('sha256','sha512'):
            algorithm_versions.setdefault((entry['original'],alg,record[alg]),[]).append((entry['original'],entry['sha256']))
    documents={(x['original'],x['digest']):x for x in closure['documents']}
    versions={(x['original'],x['digest']):x for x in closure['versions']}
    need(len(documents)==len(closure['documents']),'Duplicate document record')
    need(len(versions)==len(closure['versions']),'Duplicate version record')
    def read_exact(ref):
        matches=algorithm_versions.get((ref['original'],ref['algorithm'],ref['expected']),[])
        need(len(matches)==1,f'Missing or ambiguous exact archived version: {ref}')
        key=matches[0];need(key in versions,f'Missing declared selected version: {key}')
        return (payload/key[1]).read_bytes()
    actual_roles,actual_documents=replay_role_closure(closure['config'],closure['catalog'],read_exact)
    need(actual_documents==documents,'Recomputed evidence document/edge/role closure differs')
    normalized_roles={}
    for key,rank in actual_roles.items():
        matches=algorithm_versions[key];need(len(matches)==1,'Ambiguous replay identity')
        identity=matches[0];normalized_roles[identity]=max(normalized_roles.get(identity,0),rank)
    need(set(normalized_roles)==set(versions),'Omitted or unexplained selected version')
    for key,entry in versions.items():
        need(key in indexed and manifest['payloads'][entry['digest']]['size']==entry['size'],'Version payload/size mismatch')
        expected_role=EVIDENCE if normalized_roles[key]>=2 else PAYLOAD
        need(entry.get('traversalRole')==expected_role,'Recorded traversal role differs from reconstructed obligations')
    need((closure['selector']['path'],closure['selector']['sha256']) in versions,'Exact selector not included')
    return {'passed':True,'versions':len(versions),'jsonVersions':len(documents),'legacyPayloads':len(manifest['payloads']),
            'roleClosureReconstructed':True,'bytePayloadVersions':sum(x==1 for x in normalized_roles.values())}

def self_test(legacy_path,out):
    out=fresh(out);legacy=load_legacy(legacy_path);source=out/'inputs';source.mkdir();recovery=out/'historical';recovery.mkdir()
    tool=source/'tool.mjs';tool.write_text('export const version=2;\n');old=b'export const version=1;\n';(recovery/'frozen-tool.mjs').write_bytes(old)
    raw=source/'receipt.json';save(raw,{'bindings':{str(tool):digest(old)},'sourceIdentity':{'historicalConfigSha256':None},'contexts':{'full':{'rows':2,'bytes':10,'first':{},'repeated':[],'sha256':'a'*64,'canonicalSha256':'b'*64}}})
    refs,meta=refs_from(raw.read_bytes(),str(raw));need(len(refs)==1 and len(meta)==3,'Null/aggregate schema control')
    legacy_failed=False
    try:legacy.discover(raw.read_bytes(),str(raw))
    except Exception:legacy_failed=True
    need(legacy_failed,'Legacy nullable-hash issue was not exercised')
    config=out/'config.json';save(config,{'format':'optimization-selection-config-v1','roots':[{'path':str(source),'role':'synthetic-self-test'}],'extraFiles':[str(Path(__file__).resolve())],'legacyVerifier':str(Path(legacy_path).resolve()),'recoveryRoots':[str(recovery)],'gitRecovery':[],'dataFields':[]})
    stage=out/'prepared';prepare(config,stage)
    builder=legacy.Builder(out/'archive',[stage/'recovery'])
    for item in read(stage/'selection.json')['files']:builder.select(item['path'],item.get('sha256'),item.get('opaque',False))
    builder.build();closure_digest=hashes(stage/'closure.json')['sha256'];positive=verify_extracted(out/'archive',closure_digest)
    archive=out/'test.tar.gz';legacy.pack(out/'archive',archive)
    legacy.extract(archive,out/'extracted');verify_extracted(out/'extracted',closure_digest)
    old_payload=out/'extracted/payloads/sha256'/digest(old);original=old_payload.read_bytes();old_payload.write_bytes(original+b'corrupt')
    def rejects(fn,label):
        try:fn()
        except Exception as e:return {'name':label,'passed':True,'error':str(e)}
        raise SelectionError(f'Control failed to reject: {label}')
    tests=[rejects(lambda:verify_extracted(out/'extracted',closure_digest),'corrupted-extracted-payload')]
    old_payload.write_bytes(original);old_payload.unlink();tests.append(rejects(lambda:verify_extracted(out/'extracted',closure_digest),'missing-extracted-payload'))
    tests.append(rejects(lambda:refs_from(dumps({'bindings':{'/abs/file':None}}),'/raw.json'),'malformed-explicit-binding'))
    tests.append(rejects(lambda:refs_from(dumps({'runnerSha256':None}),'/raw.json'),'unknown-null-hash'))
    # A separate selected document may recover just the requested bytes from a
    # bound predecessor archive. No predecessor archive is a new payload.
    old_payload.write_bytes(original)
    archive_source=out/'archive-only-inputs';archive_source.mkdir()
    archive_ref=archive_source/'receipt.json';archive_original=str(out/'unavailable-historical-tool.mjs')
    save(archive_ref,{'bindings':{archive_original:digest(old)}})
    archive_config=out/'archive-only-config.json'
    save(archive_config,{'format':'optimization-selection-config-v1','roots':[{'path':str(archive_source),'role':'synthetic-selective-recovery-control'}],
      'extraFiles':[str(Path(__file__).resolve())],'legacyVerifier':str(Path(legacy_path).resolve()),'recoveryRoots':[],'gitRecovery':[],
      'recoveryArchives':[{'archive':str(archive),'archiveDigest':hashes(archive)['sha256']}],'dataFields':[]})
    archive_stage=out/'archive-only-prepared';prepare(archive_config,archive_stage)
    archive_closure=read(archive_stage/'closure.json')
    recovered=[v for v in archive_closure['versions'] if v['original']==archive_original]
    need(len(recovered)==1 and recovered[0]['method']['kind']=='selected-predecessor-payload','Selective predecessor recovery not exercised')
    need(not any(v['digest']==hashes(archive)['sha256'] for v in archive_closure['versions']),'Whole predecessor archive copied as payload')
    missing_source=out/'missing-version-inputs';missing_source.mkdir()
    save(missing_source/'receipt.json',{'bindings':{archive_original:digest(b'no supplied source version\n')}})
    missing_config=out/'missing-version-config.json';missing=read(archive_config);missing['roots']=[{'path':str(missing_source),'role':'synthetic-missing-version-control'}];save(missing_config,missing)
    missing_stage=out/'missing-version-prepared'
    tests.append(rejects(lambda:prepare(missing_config,missing_stage),'unrecoverable-exact-version'))
    need(not read(missing_stage/'report.json')['complete'] and not (missing_stage/'selection.json').exists() and not (missing_stage/'closure.json').exists(),'Missing version created admissible selection')
    save(out/'receipt.json',{'passed':True,'positive':positive,'legacyNullRejected':True,'exactOldVersionRecovered':digest(old),
      'selectiveArchiveRecovery':{'passed':True,'wholeArchiveSelected':False,'method':recovered[0]['method']},'controls':tests,'limits':'Tiny synthetic data only; no phase-wide archive claim.'})

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('mode',choices=['catalog','prepare','verify-extracted','self-test']);parser.add_argument('first');parser.add_argument('second');args=parser.parse_args()
    try:
        if args.mode=='catalog':catalog(args.first,args.second)
        elif args.mode=='prepare':prepare(args.first,args.second)
        elif args.mode=='verify-extracted':print(json.dumps(verify_extracted(args.first,args.second)))
        else:self_test(args.first,args.second)
    except Exception as error:
        print(f'{type(error).__name__}: {error}',file=sys.stderr);sys.exit(1)
