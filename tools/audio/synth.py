#!/usr/bin/env python3
"""Records each test's audio from its speech plan (build/speech/NN.json, made by tools/speech.cjs).

    .venv/bin/python tools/audio/synth.py              all planned tests
    .venv/bin/python tools/audio/synth.py 7 12         tests 07 and 12
    .venv/bin/python tools/audio/synth.py --workers 6 --threads 4

Writes audio/NN/<name>.mp3 and audio/NN/index.json ({name: {hash, sec}}). A file is
recorded again only when its plan changed (the hash differs), so fixing one section is quick.
Voices: Kokoro 82M (Apache-2.0), run locally with onnxruntime.
"""
import argparse
import json
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / 'tools' / 'audio' / 'models'
PLANS = ROOT / 'build' / 'speech'
AUDIO = ROOT / 'audio'
RATE = 24000
KBPS = 48
EDGE = (0.25, 0.45)      # silence at the start and the end of a file, seconds
TARGET_RMS = 0.075       # every sentence at the same loudness, so no speaker is quieter
PEAK = 0.95

_tts = None


def init(threads):
    global _tts
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = threads
    opts.inter_op_num_threads = 1
    sess = ort.InferenceSession(str(MODELS / 'kokoro-v1.0.onnx'), opts, providers=['CPUExecutionProvider'])
    _tts = Kokoro.from_session(sess, str(MODELS / 'voices-v1.0.bin'))


def trim(x, floor=0.004, keep=0.03):
    """Cuts the engine's own silence at both ends so the planned pauses are exact."""
    loud = np.flatnonzero(np.abs(x) > floor)
    if loud.size == 0:
        return x[:0]
    k = int(keep * RATE)
    return x[max(0, loud[0] - k): loud[-1] + k]


def level(x):
    rms = float(np.sqrt(np.mean(x[np.abs(x) > 0.01] ** 2))) if np.any(np.abs(x) > 0.01) else 0.0
    if rms == 0.0:
        return x
    gain = min(TARGET_RMS / rms, PEAK / float(np.max(np.abs(x))))
    return x * gain


def silence(sec):
    return np.zeros(int(sec * RATE), dtype=np.float32)


def encode(x):
    import lameenc
    enc = lameenc.Encoder()
    enc.set_bit_rate(KBPS)
    enc.set_in_sample_rate(RATE)
    enc.set_channels(1)
    enc.set_quality(2)
    pcm = (np.clip(x, -1, 1) * 32767).astype('<i2').tobytes()
    return enc.encode(pcm) + enc.flush()


def record(job):
    test_id, name, digest, segs, speed = job
    chunks = [silence(EDGE[0])]
    for s in segs:
        audio, rate = _tts.create(s['text'], voice=s['v'], speed=s.get('speed', speed), lang=s['lang'])
        if rate != RATE:
            raise RuntimeError(f'unexpected sample rate {rate}')
        chunks += [level(trim(audio.astype(np.float32))), silence(s['gap'])]
    chunks.append(silence(EDGE[1]))
    x = np.concatenate(chunks)
    out = AUDIO / f'{test_id:02d}' / f'{name}.mp3'
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix('.part')
    tmp.write_bytes(encode(x))
    tmp.replace(out)
    return test_id, name, digest, round(len(x) / RATE, 2)


def index_path(tid):
    return AUDIO / f'{tid:02d}' / 'index.json'


def write_index(tid, idx):
    p = index_path(tid)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dict(sorted(idx.items())), indent=1) + '\n')


def plan_jobs(paths):
    jobs, index = [], {}
    for p in paths:
        plan = json.loads(p.read_text())
        tid = plan['id']
        old = json.loads(index_path(tid).read_text()) if index_path(tid).exists() else {}
        names = {f['name'] for f in plan['files']}
        index[tid] = {k: v for k, v in old.items() if k in names}
        for stale in (AUDIO / f'{tid:02d}').glob('*.mp3'):
            if stale.stem not in names:
                stale.unlink()
        for f in plan['files']:
            have = index[tid].get(f['name'])
            mp3 = AUDIO / f'{tid:02d}' / f"{f['name']}.mp3"
            if have and have['hash'] == f['hash'] and mp3.exists():
                continue
            jobs.append((tid, f['name'], f['hash'], f['segs'], plan['speed']))
    jobs.sort(key=lambda j: -sum(len(s['text']) for s in j[3]))
    return jobs, index


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('ids', nargs='*', type=int)
    ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--threads', type=int, default=4)
    a = ap.parse_args()
    paths = [PLANS / f'{i:02d}.json' for i in a.ids] if a.ids else sorted(PLANS.glob('*.json'))
    jobs, index = plan_jobs(paths)
    print(f'{len(jobs)} file(s) to record', flush=True)
    t0 = time.time()
    if jobs:
        with Pool(a.workers, initializer=init, initargs=(a.threads,)) as pool:
            for n, (tid, name, digest, sec) in enumerate(pool.imap_unordered(record, jobs), 1):
                index[tid][name] = {'hash': digest, 'sec': sec}
                write_index(tid, index[tid])
                print(f'[{n}/{len(jobs)}] {tid:02d}/{name}.mp3 {sec:.0f}s ({time.time() - t0:.0f}s)', flush=True)
    for tid, idx in index.items():
        write_index(tid, idx)
    print(f'done in {time.time() - t0:.0f}s')


if __name__ == '__main__':
    main()
