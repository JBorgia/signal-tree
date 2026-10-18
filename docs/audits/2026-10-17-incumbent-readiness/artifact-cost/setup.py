"""Create isolated exact-source arms; never overwrite an existing directory."""
import io, subprocess, sys, tarfile
from pathlib import Path
repo, destination, dependencies = map(lambda p: Path(p).resolve(), sys.argv[1:4])
destination.mkdir(exist_ok=False)
refs = {'incumbent':'8d220643e0d4e34cbdbc6e55e6ef692b25d5e023',
        'prepair':'add49efacb615970240250a9c59eb41d07f17a52',
        'paired':'89bfca6260cb3bc0993abb350f0f340b4e59581b',
        'shared':'9917c92fbbdc9dfdd14601f1f5fb7ce21799be71'}
for arm, sha in refs.items():
    root = destination / arm
    root.mkdir()
    data = subprocess.check_output(['git','-C',str(repo),'archive',sha])
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        archive.extractall(root, filter='data')
    (root / 'node_modules').symlink_to(dependencies)
    (destination / (arm + '-source.txt')).write_text(sha + '\n')
