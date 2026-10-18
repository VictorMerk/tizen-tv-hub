"""Check the publishable file set, local links, manifests and vendored integrity."""
import hashlib
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if (root / '.git').exists():
    result = subprocess.run(['git', 'ls-files', '-z'], cwd=root, capture_output=True, check=True)
    paths = [root / p for p in result.stdout.decode().split('\0') if p]
else:
    paths = [p for p in root.rglob('*') if p.is_file() and
             not any(x in {'.git', '.build-stage', 'builds', '__pycache__'} for x in p.relative_to(root).parts)]

problems = []
for path in paths:
    relative = path.relative_to(root).as_posix()
    if path.suffix.lower() in {'.p12', '.pfx', '.pem', '.key', '.wgt', '.log', '.token'}:
        problems.append(relative + ': private/generated file type')
    if path.name in {'author-signature.xml', 'signature1.xml', 'profiles.xml'}:
        problems.append(relative + ': private/generated file')
    if path.suffix.lower() in {'.png', '.jpg'}:
        continue
    text = path.read_text(encoding='utf-8-sig')
    # Never print matched secret text in an error.
    if re.search(r'github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{25,}', text):
        problems.append(relative + ': possible GitHub credential')
    if re.search(r'C:[\\/]Users[\\/]|\b192\.168\.\d+\.\d+\b', text, re.I):
        problems.append(relative + ': personal path or device address')
    if path.suffix == '.md':
        for target in re.findall(r'\]\(([^\s)]+)(?:\s+[^)]*)?\)', text):
            if '://' in target or target.startswith(('#', 'mailto:')):
                continue
            target = target.split('#')[0]
            if target and not (path.parent / target).exists():
                problems.append(relative + ': broken local link ' + target)

for folder, app_id in [('launcher', 'tvhome2026.TVHome'), ('cinema', 'mncompat26.MovieNight')]:
    tree = ET.parse(root / folder / 'config.xml')
    element = tree.getroot().find('{http://www.w3.org/ns/widgets}content')
    if element is None or not (root / folder / element.attrib['src']).exists():
        problems.append(folder + ': manifest content missing')
    actual = next((e.attrib['id'] for e in tree.iter() if e.tag.endswith('}application')), None)
    if actual != app_id:
        problems.append(folder + ': app ID changed unexpectedly')

integrity = json.loads((root / 'third-party/integrity.json').read_text())
for name, expected in integrity.items():
    if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
        problems.append(name + ': vendored file integrity mismatch')
if problems:
    print('\n'.join(problems))
    sys.exit(1)
print('PASS: public file set, manifests, documentation links and vendored integrity')
