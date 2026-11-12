"""Write the swissALTI3D height grids the 3D view draws, into src/data/:

- terrain.json, the block around the site polygon, from the 0.5 m model;
- surroundings.json, a square about 2.6 km across centred on the polygon, from the 2 m model.

Each grid is regular in Web Mercator (EPSG:3857), so it lines up with the swisstopo basemap
tiles. Running it twice gives the same files. Needs the GDAL command-line tools.

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
DATA = ROOT / "src" / "data"
MEASUREMENTS = DATA / "measurements.json"
STAC_ITEMS = "https://data.geo.admin.ch/api/stac/v0.9/collections/ch.swisstopo.swissalti3d/items"
EARTH_RADIUS = 6378137.0
SITE_PAD = 0.2
SITE_CELLS = 128
SURROUNDINGS_HALF_SPAN = 1300.0
SURROUNDINGS_CELLS = 208


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


def polygon_box(polygon):
    points = [p for ring in polygon["coordinates"] for p in ring]
    xs, ys = zip(*(mercator(lon, lat) for lon, lat in points))
    return min(xs), min(ys), max(xs), max(ys)


def site_bounds(polygon):
    x0, y0, x1, y1 = polygon_box(polygon)
    width, height = x1 - x0, y1 - y0
    return x0 - SITE_PAD * width, y0 - SITE_PAD * height, x1 + SITE_PAD * width, y1 + SITE_PAD * height


def surroundings_bounds(polygon):
    x0, y0, x1, y1 = polygon_box(polygon)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # True metres to Web Mercator metres at the polygon's latitude.
    half = SURROUNDINGS_HALF_SPAN / math.cos(math.radians(lon_lat(cx, cy)[1]))
    return cx - half, cy - half, cx + half, cy + half


def tile_urls(bounds, gsd):
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
                a["href"] for a in feature["assets"].values() if a["href"].endswith(".tif") and a.get("eo:gsd") == gsd
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


def warp(paths, bounds, cells, cache, name):
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    step = max(width, height) / cells
    nx, ny = round(width / step), round(height / step)
    vrt, grid, text = cache / f"{name}.vrt", cache / f"{name}.tif", cache / f"{name}.asc"
    subprocess.run(["gdalbuildvrt", "-q", "-overwrite", str(vrt), *map(str, paths)], check=True)
    subprocess.run(
        ["gdalwarp", "-q", "-overwrite", "-t_srs", "EPSG:3857", "-te", *map(str, bounds),
         "-ts", str(nx), str(ny), "-r", "average", str(vrt), str(grid)],
        check=True,
    )
    subprocess.run(
        ["gdal_translate", "-q", "-of", "AAIGrid", "-co", "FORCE_CELLSIZE=TRUE", str(grid), str(text)], check=True
    )
    rows = [line.split() for line in text.read_text().splitlines()]
    values = [float(v) for row in rows if row and row[0][0] in "-0123456789" for v in row]
    return nx, ny, values


def write_grid(name, bounds, cells, gsd, cache):
    urls = tile_urls(bounds, gsd)
    nx, ny, values = warp(fetch(urls, cache), bounds, cells, cache, name)
    # The heights are cell centres, so the grid's corners sit half a cell inside the bounds.
    dx, dy = (bounds[2] - bounds[0]) / nx, (bounds[3] - bounds[1]) / ny
    west, south = lon_lat(bounds[0] + dx / 2, bounds[1] + dy / 2)
    east, north = lon_lat(bounds[2] - dx / 2, bounds[3] - dy / 2)
    base = math.floor(min(values))
    document = {
        "source": f"swisstopo swissALTI3D {', '.join(sorted({year for year, _ in urls}))}, {gsd:g} m, averaged",
        "bounds": [round(v, 7) for v in (west, south, east, north)],
        "size": [nx, ny],
        "base": base,
        "heights": [round((v - base) * 100) for v in values],
    }
    output = DATA / f"{name}.json"
    output.write_text(json.dumps(document, separators=(",", ":")) + "\n")
    print(f"{output.relative_to(ROOT)}: {nx} x {ny}, {min(values):.1f} to {max(values):.1f} m")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache", type=Path, help="directory to keep the downloaded tiles in")
    args = parser.parse_args()
    polygon = json.loads(MEASUREMENTS.read_text())["areas"][0]["geom"]
    with tempfile.TemporaryDirectory() as scratch:
        cache = args.cache or Path(scratch)
        cache.mkdir(parents=True, exist_ok=True)
        write_grid("terrain", site_bounds(polygon), SITE_CELLS, 0.5, cache)
        write_grid("surroundings", surroundings_bounds(polygon), SURROUNDINGS_CELLS, 2, cache)


if __name__ == "__main__":
    main()
