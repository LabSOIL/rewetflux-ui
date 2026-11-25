# RewetFlux

## Overview
Related to the [Sensormap](https://github.com/LabSOIL/sensormap-ui) project, providing the outputs of the RewetFlux project.

## 3D view

The site opens on the 2D map. Pressing 3D layers in the rail opens the 3D view: the
ground from swissALTI3D, draped with the chosen basemap, about 2.6 km of surroundings, and the
redox layers at 5, 15, 25 and 35 cm, the 5 cm one on the ground and each deeper one a step below.
Pressing it again returns to the map at the same place (`?view=3d` opens straight in 3D). The controls
follow other 3D maps: scroll zooms, drag moves, right-drag or Shift-drag turns and tilts, Shift
with the arrows tilts and turns. The controls at the bottom right zoom; above them, Reset view
turns the view north up with the site in frame. The 2D map is always north up, and there the
same button recentres it on the site. Zooming in tilts the view and drops the deeper layers, until
you tilt by hand. Picking a depth peels the layers above it away. The rail's
Cross-section button, under 3D layers, cuts the landscape and the layers along a line: its two
move handles slide the cut nearer or further, and the turn handles at its ends turn it (Shift
snaps to 15°), and the Spacing slider under it sets how far apart the layers hang. The basemap
switcher at the bottom left swaps between the topographic map and the aerial imagery, in 2D and
3D alike. The layers are generated from the
probe readings (inverse-distance weighting plus seeded noise), not measured rasters.

`scripts/terrain.py` writes the height grids, `src/data/terrain.json` for the site and
`src/data/surroundings.json` around it. It needs the GDAL command-line tools:

```bash
python3 scripts/terrain.py
```

`scripts/tower.py` writes the tower model, `src/data/tower.glb`, from its CAD STEP file: the parts
under 50 mm are dropped and the rest meshed to its outline and joins, 2.5 m tall. The 3D view stands
it near the middle of the polygon, true to size close in and at least 96 px tall further out. The
script also draws the 2D map's icon of it from the same mesh (`src/data/tower-icon.png`), shown at
the same spot. It needs FreeCAD's Python modules, NumPy and Matplotlib:

```bash
python3 scripts/tower.py path/to/Tower.stp
```

## Browser tests

`yarn test` runs the unit tests in jsdom, which has no layout. The checks that need one run in
Firefox through Playwright (`e2e/`): panels do not overlap at 1430x830 and 1024x700 with each
rail popup open, visible text meets WCAG AA against its composed background, no position marker
opens under a panel at 1430x830, 1024x700 and 800x600, the depth gauge sits inside the rail,
each partner logo has a box, and the 3D view covers the map, keeps its panels apart with the
cross-section on, opens and closes with the redox layers toggle, turns its cross-section on from
the rail and moves and turns it by its handles, and the site opens on the aerial 2D map. Map tiles are answered with a flat `#e8e8e8` tile, so the tests need
no network. The selectors are named once, in `e2e/selectors.js`.

Install the browser once, then build and run:

    npx playwright install firefox
    yarn build
    yarn test:e2e

The tests serve `dist/` with `vite preview` on port 4173.
