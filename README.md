# RewetFlux

## Overview
Related to the [Sensormap](https://github.com/LabSOIL/sensormap-ui) project, providing the outputs of the RewetFlux project.

## 3D view

The 3D switch in the map card opens the site as a scene: the ground from swissALTI3D, draped with
the chosen basemap, and the redox slices at 5, 15, 25 and 35 cm hanging under it, with a
cross-section that cuts through them. The slices are generated from the probe readings
(inverse-distance weighting plus seeded noise), not measured rasters.

`scripts/terrain.py` writes the height grid, `src/data/terrain.json`. It needs the GDAL
command-line tools:

```bash
python3 scripts/terrain.py
```

## Browser tests

`yarn test` runs the unit tests in jsdom, which has no layout. The checks that need one run in
Firefox through Playwright (`e2e/`): panels do not overlap at 1430x830 and 1024x700 with each
rail popup open, visible text meets WCAG AA against its composed background, no position marker
opens under a panel at 1430x830, 1024x700 and 800x600, the depth gauge sits inside the rail,
each partner logo has a box, and the 3D view covers the map, keeps its panels apart with the
cross-section on, and hands back to the map. Map tiles are answered with a flat `#e8e8e8` tile, so the tests need
no network. The selectors are named once, in `e2e/selectors.js`.

Install the browser once, then build and run:

    npx playwright install firefox
    yarn build
    yarn test:e2e

The tests serve `dist/` with `vite preview` on port 4173.
