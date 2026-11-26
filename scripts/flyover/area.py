"""Where the flyover is and what it covers, shared by fetch.py, points.py and render.py.

Everything is placed in Web Mercator (EPSG:3857), the projection of the swisstopo web map tiles,
around the centre of the site polygon in src/data/measurements.json.
"""

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "src" / "data"
DEFAULT_CACHE = Path.home() / ".cache" / "rewetflux-flyover"
EARTH_RADIUS = 6378137.0
TILE = 256


def mercator(lon: float, lat: float) -> tuple[float, float]:
    """Turn degrees of longitude and latitude into Web Mercator metres."""
    return (
        EARTH_RADIUS * math.radians(lon),
        EARTH_RADIUS * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)),
    )


def lon_lat(x: float, y: float) -> tuple[float, float]:
    """Turn Web Mercator metres into degrees of longitude and latitude."""
    return (
        math.degrees(x / EARTH_RADIUS),
        math.degrees(2 * math.atan(math.exp(y / EARTH_RADIUS)) - math.pi / 2),
    )


def site_centre() -> tuple[float, float]:
    """Find the centre of the site polygon's bounding box, (lon, lat)."""
    area = json.loads((DATA / "measurements.json").read_text())["areas"][0]
    points = [p for ring in area["geom"]["coordinates"] for p in ring]
    lons, lats = zip(*points, strict=True)
    return (min(lons) + max(lons)) / 2, (min(lats) + max(lats)) / 2


LON0, LAT0 = site_centre()
MX0, MY0 = mercator(LON0, LAT0)
# Web Mercator stretches distances by 1 / cos(latitude); this turns its metres into true metres here.
TRUE_SCALE = math.cos(math.radians(LAT0))


class Block:
    """A block of web map tiles around the site: `columns` x `rows` tiles at `zoom`."""

    def __init__(self, zoom: int, columns: int, rows: int) -> None:
        """Centre the block on the site."""
        n = 2**zoom
        cx = (LON0 + 180) / 360 * n
        cy = (1 - math.asinh(math.tan(math.radians(LAT0))) / math.pi) / 2 * n
        self.zoom, self.columns, self.rows = zoom, columns, rows
        self.x0, self.y0 = int(cx) - columns // 2, int(cy) - rows // 2
        span = 2 * math.pi * EARTH_RADIUS
        self.west = self.x0 / n * span - math.pi * EARTH_RADIUS
        self.east = (self.x0 + columns) / n * span - math.pi * EARTH_RADIUS
        self.north = math.pi * EARTH_RADIUS - self.y0 / n * span
        self.south = math.pi * EARTH_RADIUS - (self.y0 + rows) / n * span

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        """(west, south, east, north) in Web Mercator metres."""
        return self.west, self.south, self.east, self.north

    @property
    def pixels(self) -> tuple[int, int]:
        """The mosaic's size in px, (width, height)."""
        return self.columns * TILE, self.rows * TILE

    def lon_lat_bounds(self) -> tuple[float, float, float, float]:
        """Give (west, south, east, north) in degrees."""
        west, south = lon_lat(self.west, self.south)
        east, north = lon_lat(self.east, self.north)
        return west, south, east, north


# The ground the camera sees, about 1.5 by 1 km at 0.2 m a pixel, and the hills around it at 0.8 m.
NEAR = Block(19, 28, 20)
FAR = Block(17, 18, 14)
# The height rasters cover the near block, one cell per CELL x CELL of its pixels (about 0.8 m).
CELL = 4
