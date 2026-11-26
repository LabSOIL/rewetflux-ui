"""Download what the flyover is rendered from into a cache directory, skipping what is there.

It fetches:

- swisstopo's aerial imagery (SWISSIMAGE) as two mosaics, mosaic19.png over the near block and
  mosaic17.png over the far one (see area.py);
- the swissSURFACE3D surface (ground, trees and buildings) and the swissALTI3D ground, both
  0.5 m, warped to grids over the near block: surface.bin and ground.bin, float32 metres, rows
  from the north, with their size and bounds in grid.json;
- the swissSURFACE3D lidar point cloud tiles over the near block, lidar/*.las.

About 3.5 GB once unpacked. Needs the GDAL command-line tools.

    python3 scripts/flyover/fetch.py [--cache DIR]
"""

import argparse
import json
import logging
import shutil
import subprocess
import urllib.request
import zipfile
from pathlib import Path

from area import CELL, DEFAULT_CACHE, FAR, NEAR, TILE, Block
from PIL import Image

WMTS = "https://wmts20.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857"
STAC = "https://data.geo.admin.ch/api/stac/v0.9/collections"
HEADERS = {"User-Agent": "rewetflux-flyover"}
# The height rasters' ground sampling distance, in metres, as the STAC assets label it.
GSD = 0.5
log = logging.getLogger("fetch")


def tool(name: str) -> str:
    """Find a command-line tool on the PATH, by its full path."""
    return shutil.which(name) or name


def get(url: str) -> bytes:
    """Fetch a URL's body."""
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as response:
        return response.read()


def download(url: str, path: Path) -> Path:
    """Download a URL to path through a .part file, unless path is there already."""
    if path.exists():
        return path
    part = path.with_suffix(path.suffix + ".part")
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=120) as response, part.open("wb") as out:
        while chunk := response.read(1 << 20):
            out.write(chunk)
    part.rename(path)
    return path


def mosaic(block: Block, cache: Path) -> None:
    """Stitches the block's imagery tiles into mosaic{zoom}.png."""
    out = cache / f"mosaic{block.zoom}.png"
    if out.exists():
        return
    tiles = cache / "tiles"
    tiles.mkdir(exist_ok=True)
    image = Image.new("RGB", block.pixels)
    for j in range(block.rows):
        for i in range(block.columns):
            x, y = block.x0 + i, block.y0 + j
            path = download(f"{WMTS}/{block.zoom}/{x}/{y}.jpeg", tiles / f"{block.zoom}_{x}_{y}.jpeg")
            image.paste(Image.open(path).convert("RGB"), (i * TILE, j * TILE))
    image.save(out)
    log.info("%s %s", out.name, image.size)


def latest_items(collection: str, block: Block) -> list[dict]:
    """Find the newest item of the collection for each tile over the block."""
    west, south, east, north = block.lon_lat_bounds()
    features = json.loads(get(f"{STAC}/{collection}/items?bbox={west},{south},{east},{north}&limit=100"))["features"]
    latest = {}
    for feature in features:
        year, tile = feature["id"].split("_")[1:3]
        if tile not in latest or year > latest[tile]["id"].split("_")[1]:
            latest[tile] = feature
    return sorted(latest.values(), key=lambda f: f["id"])


def raster(collection: str, name: str, cache: Path) -> None:
    """Warps the collection's 0.5 m GeoTIFFs to a grid over the near block, {name}.bin."""
    out = cache / f"{name}.bin"
    if out.exists():
        return
    folder = cache / collection
    folder.mkdir(exist_ok=True)
    paths = []
    for feature in latest_items(collection, NEAR):
        href = next(
            a["href"] for a in feature["assets"].values() if a["href"].endswith(".tif") and a.get("eo:gsd") == GSD
        )
        paths.append(str(download(href, folder / href.rsplit("/", 1)[1])))
    width, height = NEAR.pixels
    vrt = cache / f"{name}.vrt"
    subprocess.run([tool("gdalbuildvrt"), "-q", "-overwrite", str(vrt), *paths], check=True)
    subprocess.run(
        [
            tool("gdalwarp"),
            "-q",
            "-overwrite",
            "-t_srs",
            "EPSG:3857",
            "-te",
            *map(str, NEAR.bounds),
            "-ts",
            str(width // CELL),
            str(height // CELL),
            "-r",
            "average",
            "-ot",
            "Float32",
            "-of",
            "ENVI",
            str(vrt),
            str(out),
        ],
        check=True,
    )
    log.info("%s from %d tiles", out.name, len(paths))


def lidar(cache: Path) -> None:
    """Download and unpack the point cloud tiles over the near block into lidar/."""
    folder = cache / "lidar"
    folder.mkdir(exist_ok=True)
    for feature in latest_items("ch.swisstopo.swisssurface3d", NEAR):
        href = next(a["href"] for a in feature["assets"].values() if a["href"].endswith(".las.zip"))
        done = folder / (feature["id"] + ".done")
        if done.exists():
            continue
        archive = download(href, folder / href.rsplit("/", 1)[1])
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(folder)
        archive.unlink()
        done.touch()
        log.info(feature["id"])


def main() -> None:
    """Fetch everything into the cache the command line names."""
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    mosaic(NEAR, args.cache)
    mosaic(FAR, args.cache)
    raster("ch.swisstopo.swisssurface3d-raster", "surface", args.cache)
    raster("ch.swisstopo.swissalti3d", "ground", args.cache)
    width, height = NEAR.pixels
    (args.cache / "grid.json").write_text(
        json.dumps({"size": [width // CELL, height // CELL], "bounds_3857": list(NEAR.bounds)}),
    )
    lidar(args.cache)


if __name__ == "__main__":
    main()
