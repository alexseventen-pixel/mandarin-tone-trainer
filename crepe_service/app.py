import base64
import io
import json
import math
import os
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import crepe
import numpy as np

HOST = "127.0.0.1"
PORT = int(os.environ.get("CREPE_PORT", "8001"))


def read_wav(encoded):
    raw = base64.b64decode(encoded, validate=True)
    with wave.open(io.BytesIO(raw), "rb") as wav:
        rate = wav.getframerate()
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        frames = wav.readframes(wav.getnframes())
    if width != 2:
        raise ValueError("CREPE service expects 16-bit PCM WAV")
    audio = np.frombuffer(frames, dtype="<i2").astype(np.float32) / 32768.0
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio, rate


def target(tone, x):
    if tone == 1:
        return 0.75
    if tone == 2:
        return 0.22 + 0.58 * x
    if tone == 3:
        return 0.55 - 0.38 * x / 0.55 if x < 0.55 else 0.17 + 0.45 * (x - 0.55) / 0.45
    return 0.78 - 0.60 * x


def half_third(x):
    return 0.55 - 0.32 * x


def resample(values, count=60):
    if len(values) == 1:
        return np.repeat(values[0], count)
    return np.interp(np.linspace(0, len(values) - 1, count), np.arange(len(values)), values)


def dtw(a, b):
    previous = np.full(len(b) + 1, np.inf)
    previous[0] = 0.0
    for av in a:
        current = np.full(len(b) + 1, np.inf)
        for j, bv in enumerate(b, 1):
            current[j] = (av - bv) ** 2 + min(current[j - 1], previous[j], previous[j - 1])
        previous = current
    return math.sqrt(float(previous[-1]) / (len(a) + len(b)))


def tone_from_pinyin(value):
    return int(value[-1]) if value and value[-1].isdigit() else 5


def energy_cuts(audio, rate, count):
    hop = max(1, int(rate * 0.025))
    window = max(hop, int(rate * 0.045))
    rms = np.array([np.sqrt(np.mean(audio[i:i + window] ** 2)) for i in range(0, max(1, len(audio) - window), hop)])
    if not len(rms):
        return [0, len(audio)], rms, hop
    threshold = max(0.005, float(rms.max()) * 0.12)
    active = np.flatnonzero(rms > threshold)
    first, last = (int(active[0]), int(active[-1])) if len(active) else (0, len(rms) - 1)
    width = max(1, (last - first + 1) / count)
    cuts = [first]
    for index in range(1, count):
        center = round(first + index * width)
        radius = max(1, round(width * 0.30))
        low = max(cuts[-1] + 2, center - radius)
        high = min(last - (count - index) * 2, center + radius)
        best = min(range(low, max(low, high) + 1), key=lambda frame: rms[frame] if frame < len(rms) else float("inf"))
        cuts.append(best)
    cuts.append(last + 1)
    return [min(len(audio), cut * hop) for cut in cuts], rms, hop


def classify(frequency, confidence, expected):
    valid = (confidence >= 0.50) & np.isfinite(frequency) & (frequency >= 55) & (frequency <= 700)
    voiced = frequency[valid]
    voiced_ratio = float(valid.mean()) if len(valid) else 0.0
    if expected == 5:
        return None, None, None, "uncertain", {"voiced_ratio": round(voiced_ratio, 3), "neutral_tone": True}, None
    if len(voiced) < 5 or voiced_ratio < 0.25:
        return None, 0, None, "uncertain", {"voiced_ratio": round(voiced_ratio, 3), "voiced_frames": int(len(voiced))}, None
    median_hz = float(np.median(voiced))
    semitones = 12 * np.log2(voiced / median_hz)
    low, high = float(semitones.min()), float(semitones.max())
    tone_range = high - low
    normalized = resample(0.18 + 0.64 * (semitones - low) / max(tone_range, 2.5))
    shifted = normalized - normalized[0]
    candidates = []
    for tone in range(1, 5):
        shapes = [np.array([target(tone, i / 59) for i in range(60)])]
        if tone == 3:
            shapes.append(np.array([half_third(i / 59) for i in range(60)]))
        distance = min(dtw(shifted, shape - shape[0]) for shape in shapes)
        candidates.append({"tone": tone, "distance": round(distance, 4)})
    candidates.sort(key=lambda item: item["distance"])
    predicted = candidates[0]["tone"]
    expected_distance = next(item["distance"] for item in candidates if item["tone"] == expected)
    score = max(0, round(100 - expected_distance * 185))
    margin = candidates[1]["distance"] - candidates[0]["distance"]
    uncertain = margin < 0.025 or (tone_range < 1.2 and expected != 1)
    state = "uncertain" if uncertain else ("no_correction" if predicted == expected and score >= 60 else "review")
    diagnostics = {
        "voiced_ratio": round(voiced_ratio, 3),
        "voiced_frames": int(len(voiced)),
        "median_hz": round(median_hz, 2),
        "min_hz": round(float(voiced.min()), 2),
        "max_hz": round(float(voiced.max()), 2),
        "range_semitones": round(tone_range, 2),
        "dtw_distance": expected_distance,
        "classification_margin": round(margin, 4),
        "mean_crepe_confidence": round(float(confidence[valid].mean()), 3),
        "candidate_distances": candidates,
        "pitch_hz": [round(float(value), 2) for value in voiced],
    }
    return predicted, score, expected, state, diagnostics, [round(float(value), 4) for value in normalized]


def assess(payload):
    audio, rate = read_wav(payload["audioBase64"])
    pinyin = payload.get("pinyin", "").split()
    characters = [char for char in payload.get("text", "") if "\u4e00" <= char <= "\u9fff"]
    if not pinyin or len(pinyin) != len(characters):
        raise ValueError("Character and pinyin counts must match")
    times, frequency, confidence, _ = crepe.predict(
        audio, rate, model_capacity=os.environ.get("CREPE_MODEL", "tiny"),
        viterbi=True, step_size=10, verbose=0
    )
    cuts, rms, hop = energy_cuts(audio, rate, len(pinyin))
    words = []
    scores = []
    for index, (character, syllable) in enumerate(zip(characters, pinyin)):
        start_s, end_s = cuts[index] / rate, cuts[index + 1] / rate
        selection = (times >= start_s) & (times < end_s)
        expected = tone_from_pinyin(syllable)
        heard, score, _, decision, diagnostics, contour = classify(frequency[selection], confidence[selection], expected)
        if score is not None:
            scores.append(score)
        words.append({
            "word": character,
            "pinyin": syllable,
            "score": score,
            "start_ms": round(start_s * 1000),
            "end_ms": round(end_s * 1000),
            "decision": decision,
            "phones": [{"dimension": "tone", "expected": expected, "heard": heard, "score": score, "decision": decision}],
            "analysis": diagnostics,
            "normalized_contour": contour,
        })
    tone_score = round(sum(scores) / len(scores)) if scores else 0
    return {
        "provider": "crepe",
        "assessable": True,
        "status": "completed",
        "task": "connected_speech_neural_pitch_dtw",
        "language": "zh-CN",
        "model_version": "CREPE-" + os.environ.get("CREPE_MODEL", "tiny"),
        "scores": {"overall": tone_score, "tone": tone_score},
        "audio": {
            "sample_rate_hz": rate,
            "duration_ms": round(len(audio) / rate * 1000),
            "crepe_frames": int(len(times)),
            "energy_frames": int(len(rms)),
            "mean_crepe_confidence": round(float(np.mean(confidence)), 3),
        },
        "words": words,
    }


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/assess":
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 15_000_000:
                raise ValueError("Invalid request size")
            payload = json.loads(self.rfile.read(size))
            result = assess(payload)
            self.reply(200, result)
        except Exception as error:
            self.reply(400, {"error": str(error)})

    def reply(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, pattern, *args):
        print("[CREPE]", pattern % args)


if __name__ == "__main__":
    print(f"CREPE service: http://{HOST}:{PORT}/assess")
    print("The first assessment can be slower while the model loads.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
