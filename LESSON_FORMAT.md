# Lesson package

Each lesson will contain:

```text
lessons/<lesson-id>/
├── lesson.json
├── reference.wav
└── cover.webp        optional
```

`lesson.json` stores the Chinese text, teacher-verified pinyin, spoken tone numbers, tone-sandhi explanations and timing. `reference.wav` is the teacher's original voice.

When a reference recording is imported, the preparation tool will:

1. convert it to mono PCM;
2. remove leading and trailing silence;
3. extract its F0 contour and voiced confidence;
4. align syllables to the verified text;
5. normalize pitch to semitones relative to the speaker;
6. save the waveform, pitch contour and syllable boundaries;
7. use that real contour as the target in Live Monitor and Exercise.

Clean WAV is preferred, but MP3, M4A and WebM can be converted during import. A recording without music, echo or another speaker produces a better reference.
