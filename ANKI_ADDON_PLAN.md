# Anki tone coach add-on

The desktop add-on can reuse the same lesson and analysis format.

## Supported client

The complete recorder and analyzer should be an **Anki Desktop add-on** for macOS, Windows and Linux. AnkiMobile on iPhone and iPad does not load Python add-ons, so mobile reviews can still play the teacher reference but should open the hosted trainer for recording and analysis.

## Note fields

- `Hanzi`
- `Pinyin`
- `SpokenPinyin`
- `ReferenceAudio`
- `ReferenceContour`
- `ToneRules`
- `LessonId`

`ReferenceAudio` is stored as normal Anki collection media, for example `[sound:li-pei-ru-03.m4a]`. `ReferenceContour` contains the compact normalized pitch points used for the overlay and DTW comparison. Both sync with the card through AnkiWeb.

## Review flow

1. The question side loads the expected tone contour from the note.
2. A **Record** button captures the learner's voice while the graph draws live pitch.
3. The add-on extracts pitch locally with YIN or sends the completed attempt to local CREPE.
4. DTW aligns the attempt with the teacher reference.
5. The card displays both curves, a score for each syllable and concrete feedback.
6. TonePerfect remains an optional cloud assessment selected in add-on settings.
7. The score is stored in the note or add-on history without changing Anki's scheduling buttons.

The add-on should use Anki reviewer hooks and inject its visual panel into the review webview. Python handles files and engine calls; JavaScript draws the live graph and sends commands to Python through Anki's webview bridge.

## First deliverable

1. Add or reuse the seven note fields above.
2. Import the nine Li Pei Ru sentence clips into Anki media.
3. Insert a compact monitor under the answer side of those cards.
4. Implement local YIN + DTW first, because it needs no API key.
5. Add local CREPE and TonePerfect as optional engines after the recorder works reliably.
