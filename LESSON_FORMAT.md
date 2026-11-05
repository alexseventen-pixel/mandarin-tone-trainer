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

## Card anatomy standard v10 (Nov 2026)
Applied automatically by `public/inspector/std10.js` whenever the Inspector exports a deck (idempotent, re-applies on every export):
- **Halo**: every large character (`.bighz .hz .chunk .big .zh .ptile .h`) gets a soft blue glow; font colour unchanged, so white text in AnkiMobile night mode stays readable on light cards. No outlines.
- **Tone listener peek**: 👁 button inside the recorder shows character + pinyin + English on demand.
- **Rich answer** (`Rich` field, added to every note type): blurred background photo of the word, character/pinyin/English, one CC-CEDICT line per word in it, and its piano tiles (a phrase gets every participating word; tap = flip to character + play). Hidden while the tone-listener lock is closed.
- **Tone-listener hardening**: state from the previous card (timers, animation frames, in-flight request) is cleared on each card; late server replies are ignored; the pitch trace is drawn even if the target curve is missing, and the canvas waits until it has a width; text writes during recording are throttled; a single cloud-sync timer instead of one per reviewed card.
New sentences/videos: build in the Inspector and download — the standard is applied on export.
