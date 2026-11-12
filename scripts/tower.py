"""Write the tower model the 3D view stands at the site, src/data/tower.glb, from its CAD STEP file:

- parts under 50 mm across (screws, nuts, washers, pins) are dropped;
- the rest is meshed coarsely and decimated to its outline and joins, about 6k triangles;
- the mast's foot is put at the origin, y up, and the model scaled to the tower's height in metres.

Running it twice gives the same file. Needs FreeCAD's Python modules (FREECAD_LIB, default
/usr/lib/freecad/lib).

    python3 scripts/tower.py path/to/Tower.stp
"""

import json
import os
import struct
import sys
from pathlib import Path

sys.path.append(os.environ.get("FREECAD_LIB", "/usr/lib/freecad/lib"))

# FreeCAD loads before Part, which crashes without it.
import FreeCAD
import Mesh
import MeshPart
import Part

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src" / "data" / "tower.glb"
HEIGHT = 2.5
SMALLEST_PART = 50.0
LINEAR_DEFLECTION = 15.0
ANGULAR_DEFLECTION = 1.6
DECIMATE_TOLERANCE = 60.0
DECIMATE_REDUCTION = 0.98
DECIMATE_ABOVE = 100


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
    """The points in metres, y up, the mast's foot at the origin and the whole the tower's height."""
    box = shape.BoundBox
    mast = max(shape.Solids, key=lambda s: s.BoundBox.ZLength).BoundBox
    scale = HEIGHT / box.ZLength
    cx, cy = mast.Center.x, mast.Center.y
    return [
        ((p.x - cx) * scale, (p.z - box.ZMin) * scale, -(p.y - cy) * scale)
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


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    shape = Part.Shape()
    shape.read(sys.argv[1])
    points, facets = simplified_mesh(shape).Topology
    positions = placed_points(shape, points)
    OUTPUT.write_bytes(glb(positions, [i for facet in facets for i in facet]))
    version = ".".join(FreeCAD.Version()[:3])
    print(
        f"{OUTPUT.relative_to(ROOT)}: {len(facets)} triangles, {len(positions)} points (FreeCAD {version})"
    )


if __name__ == "__main__":
    main()
