"""Turn the lidar tiles fetch.py downloaded into the points render.py draws, points.npz in the cache.

Keeps the vegetation and building points over the near block, as offsets in Web Mercator metres
from its south-west corner (whole Mercator metres would lose centimetres as float32) and metres
above sea. The point cloud carries no colour, so each point takes the aerial photo's colour where
it stands, averaged over 2 x 2 pixels (about 0.4 m, what one point stands for), and is darkened
by how deep it sits below the canopy top there, as the light inside a crown falls off. The photo
only sees the top of a crown, so a point below it takes its colour from a spot up to JITTER metres
away, the further the deeper it sits, and every point varies its brightness a little, as foliage
does: otherwise the points stacked under one spot of canopy share its colour and show as columns.

    python3 scripts/flyover/points.py [--cache DIR]
"""

import argparse
import json
import logging
from pathlib import Path

import laspy
import numpy as np
from area import DEFAULT_CACHE, TRUE_SCALE
from PIL import Image
from pyproj import Transformer
from scipy.ndimage import map_coordinates

Image.MAX_IMAGE_PIXELS = None

# ASPRS classes: high vegetation (swisstopo puts all vegetation there) and buildings.
KEEP = (3, 6)
# How fast the light falls off below the canopy top, in metres, and the darkest a point gets.
SHADE_DEPTH, SHADE_FLOOR = 4.0, 0.3
# The furthest (m) a deep point's colour is taken from its own spot, and the spread of brightness.
JITTER, JITTER_DEPTH, BRIGHTNESS = 0.8, 4.0, 0.06
log = logging.getLogger("points")


def main() -> None:
    """Build points.npz in the cache the command line names."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    cache = parser.parse_args().cache

    grid = json.loads((cache / "grid.json").read_text())
    nx, ny = grid["size"]
    west, south, east, north = grid["bounds_3857"]
    surface = np.fromfile(cache / "surface.bin", dtype=np.float32).reshape(ny, nx)
    photo = np.asarray(Image.open(cache / "mosaic19.png").convert("RGB").reduce(2))
    ph, pw = photo.shape[:2]
    to_mercator = Transformer.from_crs("EPSG:2056", "EPSG:3857", always_xy=True)

    # Seeded, so running it twice gives the same points.
    rng = np.random.default_rng(0)
    span_u, span_v = (east - west) * TRUE_SCALE, (north - south) * TRUE_SCALE

    xyz, rgb = [], []
    for path in sorted((cache / "lidar").glob("*.las")):
        las = laspy.read(path)
        keep = np.isin(np.asarray(las.classification), KEEP)
        # LV95 heights are above the Swiss geoid, as are the rasters', so no vertical shift is needed.
        mx, my = to_mercator.transform(np.asarray(las.x)[keep], np.asarray(las.y)[keep])
        z = np.asarray(las.z)[keep]
        inside = (mx > west) & (mx < east) & (my > south) & (my < north)
        mx, my, z = mx[inside], my[inside], z[inside]
        u, v = (mx - west) / (east - west), (north - my) / (north - south)
        top = map_coordinates(surface, [v * ny - 0.5, u * nx - 0.5], order=1, mode="nearest")
        depth = np.clip(top - z, 0, None)
        reach = JITTER * np.minimum(depth / JITTER_DEPTH, 1)
        su = u + rng.uniform(-1, 1, len(u)) * reach / span_u
        sv = v + rng.uniform(-1, 1, len(v)) * reach / span_v
        colour = np.stack(
            [map_coordinates(photo[..., c], [sv * ph - 0.5, su * pw - 0.5], order=1, mode="nearest") for c in range(3)],
            axis=-1,
        )
        shade = SHADE_FLOOR + (1 - SHADE_FLOOR) * np.exp(-depth / SHADE_DEPTH)
        shade *= 1 + rng.normal(0, BRIGHTNESS, len(shade))
        rgb.append(np.clip(colour * shade[:, None], 0, 255).astype(np.uint8))
        xyz.append(np.stack([mx - west, my - south, z], axis=-1).astype(np.float32))
        log.info("%s %d", path.name, int(inside.sum()))

    np.savez(cache / "points.npz", xyz=np.concatenate(xyz), rgb=np.concatenate(rgb))
    log.info("points %d", sum(len(p) for p in xyz))


if __name__ == "__main__":
    main()
