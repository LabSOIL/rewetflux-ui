# RewetFlux

## Overview
Related to the [Sensormap](https://github.com/LabSOIL/sensormap-ui) project, providing the outputs of the RewetFlux project.

## Browser tests

`yarn test` runs the unit tests in jsdom, which has no layout. The checks that need one run in
Firefox through Playwright (`e2e/`): panels do not overlap at 1430x830 and 1024x700 with each
rail popup open, visible text meets WCAG AA against its composed background, no position marker
opens under a panel at 1430x830, 1024x700 and 800x600, the depth gauge sits inside the rail, and
each partner logo has a box. Map tiles are answered with a flat `#e8e8e8` tile, so the tests need
no network. The selectors are named once, in `e2e/selectors.js`.

Install the browser once, then build and run:

    npx playwright install firefox
    yarn build
    yarn test:e2e

The tests serve `dist/` with `vite preview` on port 4173.
