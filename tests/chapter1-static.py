"""Validate manuscript fidelity, structure and audio manifest using only Python stdlib."""
import json, re, subprocess
from pathlib import Path

def load(path):
    return json.loads(Path(path).read_text())
def legacy(text):
    return json.JSONDecoder().raw_decode(text.split('const chapters=',1)[1])[0]
base='aab1215243663e73bf4d53b4ea53b6a59738b7ab'
archive=load('manuscript/archive/chapter1-original-aab1215.json')
assert archive['sourceCommit']==base
old=legacy(subprocess.check_output(['git','show',f'{base}:index.html'],text=True))
main=Path('index.html').read_text()
assert legacy(main)==old and archive['chapter']==old[0]
assert 'iframe' not in main.lower()
master=load('assets/chapter1/chapter1.json')
assert len(master['scenes'])==3 and len({s['image'] for s in master['scenes']})==3
manifest=load('assets/audio/chapter1/manifest.json')
segments={}
passage_ids=set()
for scene in master['scenes']:
    assert re.fullmatch(r'assets/images/[\w-]+\.webp',scene['image'])
    assert Path(scene['image']).read_bytes()[8:12]==b'WEBP'
    for passage in scene['passages']:
        assert passage['id'] not in passage_ids
        passage_ids.add(passage['id'])
        for seg in passage['segments']:
            assert seg['id'] not in segments and seg['text'].strip()
            segments[seg['id']]=seg
assert len(passage_ids)==15
assert {s['voice'] for s in segments.values()}=={'narrator','man','fire-lady'}
assert sum(len(s.get('spokenText',s['text'])) for s in segments.values())==5121
assert manifest['mode']=='pilot' and len(manifest['segments'])==4
assert all(i in segments and Path(f).stat().st_size>1000 for i,f in manifest['segments'].items())
print('Exact original archive and baseline data; 3 local scenes, 15 unique passages, 5,121 spoken characters and 4 local pilot files: passed.')
