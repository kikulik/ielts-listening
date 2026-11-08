#!/usr/bin/env python3
"""Checks that every typed answer can actually be heard in the recording.

Transcribes each section with Whisper (faster-whisper small.en, run locally) and looks for each
gap answer of that section in the transcription. Spelled names (G-A-R-R-O-W-A-Y), digits and
prices are compared letters-and-digits only. Transcriptions are cached in build/heard/.

    .venv/bin/python tools/audio/hear_check.py            all tests
    .venv/bin/python tools/audio/hear_check.py 7 12       tests 07 and 12

A miss is not always a fault (Whisper may write a rare word differently); listen to those.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / 'build' / 'heard'
WORDS = {'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5', 'six': '6', 'seven': '7',
         'eight': '8', 'nine': '9', 'ten': '10', 'eleven': '11', 'twelve': '12', 'fifteen': '15', 'twenty': '20'}

_model = None


def model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        _model = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=16)
    return _model


def load16k(path):
    """PyAV in this environment can't open files for faster-whisper, so decode with soundfile."""
    x, sr = sf.read(str(path), dtype='float32')
    if x.ndim > 1:
        x = x.mean(axis=1)
    n = int(len(x) * 16000 / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x).astype(np.float32)


def heard(tid, name):
    CACHE.mkdir(parents=True, exist_ok=True)
    mp3 = ROOT / 'audio' / f'{tid:02d}' / f'{name}.mp3'
    cache = CACHE / f'{tid:02d}-{name}.txt'
    if cache.exists() and cache.stat().st_mtime >= mp3.stat().st_mtime:
        return cache.read_text()
    segs, _ = model().transcribe(load16k(mp3), beam_size=5)
    text = ' '.join(s.text.strip() for s in segs)
    cache.write_text(text)
    return text


def squash(s):
    words = re.findall(r"[a-z0-9]+", s.lower().replace('£', ''))
    return ''.join(WORDS.get(w, w) for w in words)


def typed_answers(part):
    """{question: [accepted answers]} for typed gaps only."""
    out = {}
    for g in part['groups']:
        if g['type'] == 'gap' and not g.get('options'):
            out.update({int(q): a for q, a in g['answers'].items()})
    return out


def check_test(tid):
    test = json.loads((ROOT / 'data' / 'tests' / f'{tid:02d}.json').read_text())
    misses = []
    for part in test['parts']:
        answers = typed_answers(part)
        for i, sec in enumerate(part['sections']):
            qs = [q for q in range(sec['from'], sec['to'] + 1) if q in answers]
            if not qs:
                continue
            text = squash(heard(tid, f"p{part['n']}-{i + 1}"))
            for q in qs:
                alts = [squash(re.sub(r'[()]', '', a)) for a in answers[q]]
                if not any(a and a in text for a in alts):
                    misses.append(f'Test {tid:02d} q{q}: "{answers[q][0]}" not heard')
    return misses


def main():
    ids = [int(a) for a in sys.argv[1:]] or sorted(int(p.stem) for p in (ROOT / 'data' / 'tests').glob('[0-9][0-9].json'))
    misses = []
    for tid in ids:
        found = check_test(tid)
        print(f'Test {tid:02d}: {"ok" if not found else f"{len(found)} to listen to"}', flush=True)
        misses += found
    print('\n'.join(misses) if misses else 'Every typed answer was heard.')


if __name__ == '__main__':
    main()
