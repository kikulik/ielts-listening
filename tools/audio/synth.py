#!/usr/bin/env python3
"""Records each test's audio from its speech plan (build/speech/NN.json, made by tools/speech.cjs).

    .venv/bin/python tools/audio/synth.py              all planned tests
    .venv/bin/python tools/audio/synth.py 7 12         tests 07 and 12
    .venv/bin/python tools/audio/synth.py --workers 6 --threads 4

Writes audio/NN/<name>.mp3 and audio/NN/index.json ({name: {hash, sec}}). A file is
recorded again only when its plan changed (the hash differs), so fixing one section is quick.
Voices: Kokoro 82M (Apache-2.0), run locally with onnxruntime.

A sentence with spelling comes with "pauses", seconds of silence to add after each of its
punctuation marks: the letters are said in one recording, then pulled apart (see spread()).
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
MARKS = set(',.;:!?')
TIMED = MODELS / 'kokoro-v1.0-timed.onnx'
FADE = int(0.01 * RATE)  # where a pause is cut into sound, 10 ms fade out and in, so there is no click

_tts = None


def timed_model():
    """The speech model with the length of every phoneme as a second output, "duration", so kokoro_onnx
    reports when each one is spoken. The audio is the same. Made once from the model file."""
    if TIMED.exists():
        return
    import onnx
    m = onnx.load(str(MODELS / 'kokoro-v1.0.onnx'))
    lengths = '/encoder/Cast_output_0'  # round(duration / speed), as whole frames
    if not any(lengths in n.output for n in m.graph.node):
        raise RuntimeError(f'{lengths} is not in the model: the phoneme lengths cannot be read')
    m.graph.node.append(onnx.helper.make_node('Identity', [lengths], ['duration']))
    m.graph.output.append(onnx.helper.make_tensor_value_info('duration', onnx.TensorProto.INT64, None))
    tmp = TIMED.with_suffix('.part')
    onnx.save(m, str(tmp))
    tmp.replace(TIMED)


def init(threads):
    global _tts
    import onnxruntime as ort
    from kokoro_onnx import Kokoro
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = threads
    opts.inter_op_num_threads = 1
    sess = ort.InferenceSession(str(TIMED), opts, providers=['CPUExecutionProvider'])
    _tts = Kokoro.from_session(sess, str(MODELS / 'voices-v1.0.bin'))
    if not _tts.has_timings:
        raise RuntimeError(f'{TIMED.name} reports no timings; delete it to make it again')


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


def pause_spot(loud, mark):
    """Where to put the pause after a punctuation mark, in samples, and how much silence is there already.
    In the gap the voice left at the mark if there is one; where it ran straight on, just before the next
    sound starts, so the letter before keeps its own ending (cutting earlier can turn "K" into "Kate")."""
    frame, n = RATE // 100, len(loud)
    quiet = loud <= loud.max() * 0.01  # 40 dB below the loudest frame
    at = min(n - 1, int((mark.start + mark.end) / 2 * 100))
    near = [i for i in sorted(range(at - 15, at + 16), key=lambda i: abs(i - at)) if 0 <= i < n and quiet[i]]
    if near:
        a = b = near[0]
        while a > 0 and quiet[a - 1]:
            a -= 1
        while b + 1 < n and quiet[b + 1]:
            b += 1
        return (a + b + 1) // 2 * frame, (b - a + 1) / 100
    return int(mark.end * RATE), 0.0


def spread(x, spoken, pauses, text):
    """Adds pauses[i] seconds of silence after the i-th punctuation mark of a recording (less what is there)."""
    marks = [t for t in spoken if t.phoneme in MARKS]
    if len(marks) != len(pauses):
        raise RuntimeError(f'{len(marks)} punctuation marks spoken but {len(pauses)} pauses planned: {text!r}')
    frame = RATE // 100
    loud = np.sqrt((x[:len(x) // frame * frame].reshape(-1, frame) ** 2).mean(1))
    cuts = []
    for mark, want in zip(marks, pauses):
        at, have = pause_spot(loud, mark) if want else (0, 0)
        if want > have and FADE < at < len(x) - FADE and (not cuts or at > cuts[-1][0]):
            cuts.append((at, want - have, have == 0))
    y = x.copy()
    ramp = (0.5 - 0.5 * np.cos(np.linspace(0, np.pi, FADE))).astype(np.float32)
    for at, _, into_sound in cuts:
        if into_sound:
            y[at - FADE:at] *= ramp[::-1]
            y[at:at + FADE] *= ramp
    parts, last = [], 0
    for at, add, _ in cuts:
        parts += [y[last:at], silence(add)]
        last = at
    return np.concatenate(parts + [y[last:]])


def speak(s, speed):
    """One sentence; with spelling, its letters pulled apart by the planned pauses."""
    args = dict(voice=s['v'], speed=s.get('speed', speed), lang=s['lang'], sentence_pause=0, clause_pause=0)
    if 'pauses' not in s:
        audio, rate = _tts.create(s['text'], **args)
    else:
        audio, rate, spoken = _tts.create_timed(s['text'], **args)
        audio = spread(audio.astype(np.float32), spoken, s['pauses'], s['text'])
    if rate != RATE:
        raise RuntimeError(f'unexpected sample rate {rate}')
    return audio.astype(np.float32)


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
        chunks += [level(trim(speak(s, speed))), silence(s['gap'])]
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
        timed_model()
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
