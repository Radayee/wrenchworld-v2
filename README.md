# WRENCHWORLD — v2

Development snapshot captured on November 12, 2026.

- Play v2: https://radayee.github.io/wrenchworld-v2/
- Play the original snapshot: https://radayee.github.io/wrenchworld/
- Original repository: https://github.com/Radayee/wrenchworld

This snapshot adds a buildable map/editor, expanded UI and updated simulation systems compared with the first published snapshot. The original publication is preserved separately for comparison.

Browser saves use the `ww_release_v2_` prefix so playing this snapshot cannot overwrite saves from the original release on the same GitHub Pages origin.

## Validation

- JavaScript syntax checks passed for all 15 modules.
- `node tests/features.js`: 25 simulated days, save migration and five more simulated days passed.
- `node tests/headless.js 5 honest`: completed without an exception.

## Publishing adjustments

Only the page title, visible main-menu version label and browser-save prefix were changed for this release snapshot. The development source in D:/Gametest was left unchanged.