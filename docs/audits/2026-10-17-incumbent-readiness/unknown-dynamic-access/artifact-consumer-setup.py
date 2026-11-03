from pathlib import Path
import shutil,json
r=Path('/private/tmp/st-unknown-access-candidate');out=Path('/private/tmp/st-unknown-access-artifact-consumer');mods=out/'node_modules';mods.mkdir(parents=True,exist_ok=True)
for p in (r/'node_modules').iterdir():
 if p.name in ['@signal-tree','.bin','.pnpm']:continue
 q=mods/p.name
 if not q.exists():q.symlink_to(p.resolve(),target_is_directory=True)
(mods/'@signal-tree').mkdir(exist_ok=True)
for name in ['kernel','angular','react','vue','solid']:
 dst=mods/'@signal-tree'/name
 if dst.exists():shutil.rmtree(dst)
 shutil.copytree(r/'dist/packages'/name,dst)
 s=(r/f'packages/{name}/src/lib/open-record-access.typing.spec.ts').read_text().replace("'./signal-tree'",f"'@signal-tree/{name}'").replace("'../index'",f"'@signal-tree/{name}'")
 (out/f'{name}.ts').write_text(s)
(out/'package.json').write_text('{"type":"module","private":true}')
(out/'tsconfig.json').write_text(json.dumps({'compilerOptions':{'strict':True,'skipLibCheck':False,'noEmit':True,'module':'NodeNext','moduleResolution':'NodeNext','target':'ES2022'},'include':['*.ts']},indent=2))
