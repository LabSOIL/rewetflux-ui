"""Write the tower model the 3D view stands at the site, src/data/tower.glb, from its CAD STEP file,
and the 2D map's icon of it, src/data/tower-icon.png with its size and anchor in tower-icon.json:

- parts under 50 mm across (screws, nuts, washers, pins) are dropped;
- the rest is meshed coarsely and decimated to its outline and joins, about 6k triangles;
- the model is turned legs down, the mast's foot put at the origin, y up, and scaled to the
  tower's height in metres;
- the icon draws the same mesh in an oblique view, at twice the size it shows on the map.

Running it twice gives the same files. Needs FreeCAD's Python modules (FREECAD_LIB, default
/usr/lib/freecad/lib), NumPy and Matplotlib.

    python3 scripts/tower.py path/to/Tower.stp
"""

import io
import json
import os
import struct
import sys
from pathlib import Path

import matplotlib
import numpy as np

matplotlib.use("Agg")
from matplotlib import pyplot as plt
from matplotlib.collections import PolyCollection

sys.path.append(os.environ.get("FREECAD_LIB", "/usr/lib/freecad/lib"))

# FreeCAD loads before Part, which crashes without it.
import FreeCAD
import Mesh
import MeshPart
import Part

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "src" / "data"
OUTPUT = DATA / "tower.glb"
ICON = DATA / "tower-icon.png"
ICON_LAYOUT = DATA / "tower-icon.json"
HEIGHT = 2.5
SMALLEST_PART = 50.0
LINEAR_DEFLECTION = 15.0
ANGULAR_DEFLECTION = 1.6
DECIMATE_TOLERANCE = 60.0
DECIMATE_REDUCTION = 0.98
DECIMATE_ABOVE = 100
# The icon: its height on the map in pixels, drawn at twice that; the view's turn from the south and
# its tilt above the horizon in degrees; the tower's colour (the 3D view's) and the grey lit faces lean
# to; the light's direction; the outline thickening thin tubes, in drawn pixels.
ICON_HEIGHT = 56
ICON_SCALE = 2
ICON_TURN = 35
ICON_TILT = 25
ICON_COLOUR = (0x22, 0x26, 0x2D)
ICON_LIT = (0x9A, 0xA0, 0xA8)
ICON_LIGHT = (-0.5, 0.8, 0.4)
ICON_STROKE = 1.0


def simplified_mesh(shape):
    """The parts large enough to see, meshed coarsely, decimated and joined."""
    total = Mesh.Mesh()
    for solid in shape.Solids:
        if solid.BoundBox.DiagonalLength < SMALLEST_PART:
            continue
        part = MeshPart.meshFromShape(
            Shape=solid,
            LinearDeflection=LINEAR_DEFLECTION,
            AngularDeflection=ANGULAR_DEFLECTION,
            Relative=False,
        )
        if part.CountFacets > DECIMATE_ABOVE:
            part.decimate(DECIMATE_TOLERANCE, DECIMATE_REDUCTION)
        total.addMesh(part)
    return total


def placed_points(shape, points):
    """The points in metres, y up, the mast's foot at the origin and the whole the tower's height.

    The STEP is drawn legs up, so it turns half a turn about x: its -z is up, its y south.
    """
    box = shape.BoundBox
    mast = max(shape.Solids, key=lambda s: s.BoundBox.ZLength).BoundBox
    scale = HEIGHT / box.ZLength
    cx, cy = mast.Center.x, mast.Center.y
    return [
        ((p.x - cx) * scale, (box.ZMax - p.z) * scale, (p.y - cy) * scale)
        for p in points
    ]


def glb(positions, indices):
    """A binary glTF of one mesh: float positions and unsigned indices, one plain material."""
    position_bytes = b"".join(struct.pack("<3f", *p) for p in positions)
    index_format, component = ("<H", 5123) if len(positions) < 65536 else ("<I", 5125)
    index_bytes = b"".join(struct.pack(index_format, i) for i in indices)
    index_bytes += b"\0" * (-len(index_bytes) % 4)
    lows = [min(p[k] for p in positions) for k in range(3)]
    highs = [max(p[k] for p in positions) for k in range(3)]
    document = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "tower"}],
        "meshes": [
            {
                "primitives": [
                    {"attributes": {"POSITION": 0}, "indices": 1, "material": 0}
                ]
            }
        ],
        "materials": [
            {
                "pbrMetallicRoughness": {
                    "baseColorFactor": [0.8, 0.8, 0.8, 1],
                    "metallicFactor": 0,
                }
            }
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": len(positions),
                "type": "VEC3",
                "min": lows,
                "max": highs,
            },
            {
                "bufferView": 1,
                "componentType": component,
                "count": len(indices),
                "type": "SCALAR",
            },
        ],
        "bufferViews": [
            {
                "buffer": 0,
                "byteOffset": 0,
                "byteLength": len(position_bytes),
                "target": 34962,
            },
            {
                "buffer": 0,
                "byteOffset": len(position_bytes),
                "byteLength": len(index_bytes),
                "target": 34963,
            },
        ],
        "buffers": [{"byteLength": len(position_bytes) + len(index_bytes)}],
    }
    text = json.dumps(document, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    binary = position_bytes + index_bytes
    chunks = (
        struct.pack("<I4s", len(text), b"JSON")
        + text
        + struct.pack("<I4s", len(binary), b"BIN\0")
        + binary
    )
    return struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks


def icon(positions, triangles):
    """The icon's PNG bytes, and its size and the foot's pixel on the map, [width, height] and [x, y]."""
    turn, tilt = np.radians(ICON_TURN), np.radians(ICON_TILT)
    toward = np.array(
        [np.sin(turn) * np.cos(tilt), np.sin(tilt), np.cos(turn) * np.cos(tilt)]
    )
    right = np.array([np.cos(turn), 0, -np.sin(turn)])
    up = np.cross(toward, right)
    points = np.array(positions)
    corners = points[np.array(triangles)]
    flat = np.stack([corners @ right, corners @ up], axis=-1)
    normals = np.cross(corners[:, 1] - corners[:, 0], corners[:, 2] - corners[:, 0])
    normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-12
    light = np.array(ICON_LIGHT) / np.linalg.norm(ICON_LIGHT)
    lit = np.abs(normals @ light)[:, None]
    colours = ((1 - lit) * np.array(ICON_COLOUR) + lit * np.array(ICON_LIT)) / 255
    order = np.argsort((corners @ toward).mean(axis=1))
    xs, ys = points @ right, points @ up
    margin = ICON_STROKE / ICON_SCALE * (ys.max() - ys.min()) / ICON_HEIGHT * 2
    left, right_edge = xs.min() - margin, xs.max() + margin
    bottom, top = ys.min() - margin, ys.max() + margin
    height = ICON_HEIGHT
    width = round(height * (right_edge - left) / (top - bottom))
    figure = plt.figure(
        figsize=(width * ICON_SCALE / 100, height * ICON_SCALE / 100), dpi=100
    )
    axes = figure.add_axes((0, 0, 1, 1))
    axes.set_xlim(left, right_edge)
    axes.set_ylim(bottom, top)
    axes.set_axis_off()
    axes.add_collection(
        PolyCollection(
            flat[order],
            facecolors=colours[order],
            edgecolors=colours[order],
            linewidths=ICON_STROKE * 72 / 100,
        )
    )
    buffer = io.BytesIO()
    figure.savefig(buffer, format="png", transparent=True, metadata={"Software": None})
    plt.close(figure)
    anchor = [
        round(width * (0 - left) / (right_edge - left), 1),
        round(height * (top - 0) / (top - bottom), 1),
    ]
    return buffer.getvalue(), {"size": [width, height], "anchor": anchor}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    shape = Part.Shape()
    shape.read(sys.argv[1])
    points, facets = simplified_mesh(shape).Topology
    positions = placed_points(shape, points)
    OUTPUT.write_bytes(glb(positions, [i for facet in facets for i in facet]))
    picture, layout = icon(positions, facets)
    ICON.write_bytes(picture)
    ICON_LAYOUT.write_text(json.dumps(layout) + "\n")
    version = ".".join(FreeCAD.Version()[:3])
    print(
        f"{OUTPUT.relative_to(ROOT)}: {len(facets)} triangles, {len(positions)} points (FreeCAD {version})"
    )


if __name__ == "__main__":
    main()
