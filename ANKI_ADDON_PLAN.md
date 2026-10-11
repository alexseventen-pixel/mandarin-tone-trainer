# Anki tone coach add-on

The desktop add-on can reuse the same lesson and analysis format.

## Note fields

- `Hanzi`
- `Pinyin`
- `SpokenPinyin`
- `ReferenceAudio`
- `ReferenceContour`
- `ToneRules`
- `LessonId`

## Review flow

1. The question side loads the expected tone contour from the note.
2. A **Record** button captures the learner's voice.
3. The add-on extracts pitch locally with YIN or sends the completed attempt to local CREPE.
4. DTW aligns the attempt with the teacher reference.
5. The card displays both curves, a score for each syllable and concrete feedback.
6. TonePerfect remains an optional cloud assessment selected in add-on settings.

The add-on should use Anki reviewer hooks and inject its visual panel into the review webview. Python handles files and engine calls; JavaScript draws the live graph and sends commands to Python through Anki's webview bridge.
