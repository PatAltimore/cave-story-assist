# Licensing notice

This repository mixes code under one license with third-party material under others. Nothing here
relicenses anyone else's work.

## Code: GPL-3.0

`LICENSE` is the GNU General Public License v3. It covers the NXEngine source in `engine/` (© Caitlin Shaw,
GPL-3.0; the portability fork is by [EXL](https://github.com/EXL/NXEngine)) and the changes and additions to it
in this repository: the SDL compatibility layer (`engine/sdl1compat/`), `engine/assist.cpp`, the web page and
scripts in `web/` and `tools/`, and the build files.

## Not covered by the GPL

| Material | Where | Terms |
| --- | --- | --- |
| *Cave Story* game files (the English release with the Aeon Genesis translation, and the Japanese scripts) | `data/en/`, `data/jp-tsc/` | © Studio Pixel / Daisuke Amaya. Freeware; this repository does not grant any rights to it. The Aeon Genesis translation is a fan translation. |
| Script text derived from those files (English and Japanese) | `web/script-data.json` | Same as above, plus the dictionary glosses below. |
| JMdict dictionary glosses and common-word flags | in `web/script-data.json` | © EDRDG, [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html), via [jmdict-simplified](https://github.com/scriptin/jmdict-simplified). Share-alike applies to that data. |
| JLPT levels | in `web/script-data.json` | Jonathan Waller's [Tanos lists](https://www.tanos.co.uk/jlpt/), CC BY, via [Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary). Unofficial lists, not published by the JLPT organizers. |
| Japanese tokenizer used to build the data | `tools/` (not shipped) | [kuromoji.js](https://github.com/takuyaa/kuromoji.js), Apache-2.0, with the IPADIC dictionary. |
| DotGothic16 font (subset) | `web/fonts/` | © The DotGothic16 Project Authors, [SIL OFL 1.1](web/fonts/OFL.txt). |
