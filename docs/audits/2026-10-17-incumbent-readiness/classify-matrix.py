"""Classify preserved evidence, without executing or changing its assertions.

Run from repository root: python3 docs/audits/2026-10-17-incumbent-readiness/classify-matrix.py
"""
import collections
import csv
import json
from pathlib import Path

counts = collections.Counter()
output = Path(__file__).with_name('matrix-classification.csv')
with output.open('w', newline='') as stream:
    writer = csv.writer(stream, lineterminator='\n', quoting=csv.QUOTE_ALL)
    writer.writerow(['suite', 'id', 'original_verdict', 'readiness_group', 'source', 'nonheld_assertions'])
    for suite in ['scalar', 'structural', 'composition', 'authority']:
        source = Path(f'docs/audits/2026-09-24-matrix-rebaseline/{suite}.json')
        for row in json.loads(source.read_text())['rows']:
            status = row['status']
            details = ' | '.join(a['label'] + ': ' + a.get('detail', '')
                                 for a in row['assertions'] if a['status'] != 'held')
            if status == 'held':
                group = 'held'
            elif status == 'violated':
                group = {'scalar': 'overlap-target', 'structural': 'overlap-target',
                         'composition': 'independent-Link-target',
                         'authority': 'authority-projection-decision'}[suite]
            elif status == 'unsupported':
                if 'has no ' in details and ' capability' in details:
                    group = 'fixture-omitted-enhancer'
                elif 'occupied-entity refusal setup' in details:
                    group = 'refusal-setup-gap'
                elif 'terminal disposition reader' in details:
                    group = 'terminal-observation-gap'
                elif 'canonical/pending split' in details:
                    group = 'canonical-split-unresolved'
                elif 'authority settlement input' in details or 'revision-ordering input' in details:
                    group = 'authority-input-unresolved'
                else:
                    raise ValueError((row['id'], details))
            else:
                raise ValueError(status)
            counts[group] += 1
            writer.writerow([suite, row['id'], status, group, str(source), details])
expected = {'held': 188, 'overlap-target': 57, 'independent-Link-target': 10,
            'authority-projection-decision': 1, 'fixture-omitted-enhancer': 112,
            'refusal-setup-gap': 6, 'terminal-observation-gap': 17,
            'canonical-split-unresolved': 24, 'authority-input-unresolved': 9}
assert dict(counts) == expected, dict(counts)
print(json.dumps(dict(counts), indent=2))
