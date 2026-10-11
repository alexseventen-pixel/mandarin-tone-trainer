# Open-source components

## CREPE

The optional local neural pitch mode uses the Python package **CREPE**:

- Repository: https://github.com/marl/crepe
- Paper: *CREPE: A Convolutional Representation for Pitch Estimation*
- License: MIT

The model package is installed by the user from `crepe_service/requirements.txt`; model files are not redistributed in this project.

## ToneMirror approach

The browser mode was designed after studying the public description of ToneMirror:

- Repository: https://github.com/antonsoo/tonemirror
- License: MIT

No ToneMirror source files are copied into this project. The browser implementation here independently combines YIN pitch extraction, speaker-relative normalization, energy-based syllable boundaries, and Dynamic Time Warping.
