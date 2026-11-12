# RewetFlux

## Overview
Related to the [Sensormap](https://github.com/LabSOIL/sensormap-ui) project, providing the outputs of the RewetFlux project.

## 3D view

The site opens in 3D where the browser draws WebGL (`?view=2d` opens the map instead): the ground
from swissALTI3D, draped with the chosen basemap, about 2.6 km of surroundings, and the redox
slices at 5, 15, 25 and 35 cm hanging under the site. The controls follow other 3D maps: scroll
zooms, drag moves, right-drag or Shift-drag turns and tilts, Shift with the arrows tilts and
turns. Tilting as you zoom (on by default) flattens the view as you zoom out, and past zoom 17 it
hands over to the 2D map at the same place; scrolling in on the site from there, or right-dragging
up on the map, comes back into 3D. Picking a depth peels the layers above it away, and the
cross-section cuts the landscape and the slices along a line. The slices are generated from the
probe readings (inverse-distance weighting plus seeded noise), not measured rasters.

`scripts/terrain.py` writes the height grids, `src/data/terrain.json` for the site and
`src/data/surroundings.json` around it. It needs the GDAL command-line tools:

```bash
python3 scripts/terrain.py
```

## Browser tests

`yarn test` runs the unit tests in jsdom, which has no layout. The checks that need one run in
Firefox through Playwright (`e2e/`): panels do not overlap at 1430x830 and 1024x700 with each
rail popup open, visible text meets WCAG AA against its composed background, no position marker
opens under a panel at 1430x830, 1024x700 and 800x600, the depth gauge sits inside the rail,
each partner logo has a box, and the 3D view covers the map, keeps its panels apart with the
cross-section on, hands back to the map, opens on loading and closes by zooming out, and opens again by scrolling
in or right-dragging up on the map. The other checks open the 2D map with `?view=2d`. Map tiles are answered with a flat `#e8e8e8` tile, so the tests need
no network. The selectors are named once, in `e2e/selectors.js`.

Install the browser once, then build and run:

    npx playwright install firefox
    yarn build
    yarn test:e2e

The tests serve `dist/` with `vite preview` on port 4173.
