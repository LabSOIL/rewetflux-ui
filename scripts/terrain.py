"""Write src/data/terrain.json: a swissALTI3D height grid over the block around the site polygon.

The grid is regular in Web Mercator (EPSG:3857), so it lines up with the swisstopo basemap tiles.
Needs the GDAL command-line tools.

    python3 scripts/terrain.py [--cache DIR]
"""

import argparse
import json
import math
import subprocess
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEASUREMENTS = ROOT / "src" / "data" / "measurements.json"
OUTPUT = ROOT / "src" / "data" / "terrain.json"
STAC_ITEMS = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items"
EARTH_RADIUS = 6378137.0
PAD = 0.2
CELLS_ON_LONG_SIDE = 128


def mercator(lon, lat):
    return (
        EARTH_RADIUS * math.radians(lon),
        EARTH_RADIUS * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)),
    )


def lon_lat(x, y):
    return (
        math.degrees(x / EARTH_RADIUS),
        math.degrees(2 * math.atan(math.exp(y / EARTH_RADIUS)) - math.pi / 2),
    )


def block_bounds(polygon):
    points = [p for ring in polygon["coordinates"] for p in ring]
    xs, ys = zip(*(mercator(lon, lat) for lon, lat in points))
    width, height = max(xs) - min(xs), max(ys) - min(ys)
    return (
        min(xs) - PAD * width,
        min(ys) - PAD * height,
        max(xs) + PAD * width,
        max(ys) + PAD * height,
    )


def tile_urls(bounds):
    west, south = lon_lat(bounds[0], bounds[1])
    east, north = lon_lat(bounds[2], bounds[3])
    url = f"{STAC_ITEMS}?bbox={west},{south},{east},{north}&limit=100"
    with urllib.request.urlopen(url, timeout=60) as response:
        features = json.load(response)["features"]
    latest = {}
    for feature in features:
        year, tile = feature["id"].split("_")[1:3]
        if tile not in latest or year > latest[tile][0]:
            href = next(
                a["href"] for a in feature["assets"].values() if a["href"].endswith(".tif") and a.get("eo:gsd") == 0.5
            )
            latest[tile] = (year, href)
    return sorted(latest.values())


def fetch(urls, cache):
    paths = []
    for _, url in urls:
        path = cache / url.rsplit("/", 1)[1]
        if not path.exists():
            urllib.request.urlretrieve(url, path)
        paths.append(path)
    return paths


def warp(paths, bounds, cache):
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    step = max(width, height) / CELLS_ON_LONG_SIDE
    nx, ny = round(width / step), round(height / step)
    vrt, grid, text = cache / "tiles.vrt", cache / "grid.tif", cache / "grid.asc"
    subprocess.run(["gdalbuildvrt", "-q", str(vrt), *map(str, paths)], check=True)
    subprocess.run(
        ["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857", "-te", *map(str, bounds),
         "-ts", str(nx), str(ny), "-r", "average", str(vrt), str(grid)],
        check=True,
    )
    subprocess.run(["gdal_translate", "-q", "-of", "AAIGrid", "-co", "FORCE_CELLSIZE=TRUE", str(grid), str(text)], check=True)
    rows = [line.split() for line in text.read_text().splitlines()]
    values = [float(v) for row in rows if row and row[0][0] in "-0123456789" for v in row]
    return nx, ny, values


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, help="directory to keep the downloaded tiles in")
    args = parser.parse_args()
    polygon = json.loads(MEASUREMENTS.read_text())["areas"][0]["geom"]
    bounds = block_bounds(polygon)
    with tempfile.TemporaryDirectory() as scratch:
        cache = args.cache or Path(scratch)
        cache.mkdir(parents=True, exist_ok=True)
        urls = tile_urls(bounds)
        nx, ny, values = warp(fetch(urls, cache), bounds, cache)
    # The heights are cell centres, so the grid's corners sit half a cell inside the block.
    dx, dy = (bounds[2] - bounds[0]) / nx, (bounds[3] - bounds[1]) / ny
    west, south = lon_lat(bounds[0] + dx / 2, bounds[1] + dy / 2)
    east, north = lon_lat(bounds[2] - dx / 2, bounds[3] - dy / 2)
    base = math.floor(min(values))
    document = {
        "source": f"swisstopo swissALTI3D {', '.join(sorted({year for year, _ in urls}))}, 0.5 m, averaged",
        "bounds": [round(v, 7) for v in (west, south, east, north)],
        "size": [nx, ny],
        "base": base,
        "heights": [round((v - base) * 100) for v in values],
    }
    OUTPUT.write_text(json.dumps(document, separators=(",", ":")) + "\n")
    print(f"{OUTPUT.relative_to(ROOT)}: {nx} x {ny}, {min(values):.1f} to {max(values):.1f} m")


if __name__ == "__main__":
    main()
