"""Build the ODbL Malta street index from a Geofabrik GeoPackage zip."""
import json
from contextlib import closing
import math
import sqlite3
import struct
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

archive = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / "data" / "malta-streets.json"
roads = {"motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
         "residential", "living_street", "pedestrian", "service", "road", "track", "footway", "path"}

def line_parts(blob, offset):
    endian = "<" if blob[offset] else ">"
    kind, count = struct.unpack_from(endian + "II", blob, offset + 1)
    offset += 9
    if kind == 2:
        points = list(struct.iter_unpack(endian + "dd", blob[offset:offset + count * 16]))
        return [points], offset + count * 16
    if kind == 5:
        parts = []
        for _ in range(count):
            part, offset = line_parts(blob, offset)
            parts.extend(part)
        return parts, offset
    raise ValueError(f"Unexpected road geometry {kind}")

with TemporaryDirectory() as tmp, ZipFile(archive) as z:
    member = next(n for n in z.namelist() if n.endswith(".gpkg"))
    gpkg = Path(tmp) / "malta.gpkg"
    gpkg.write_bytes(z.read(member))
    result = {}
    with closing(sqlite3.connect(gpkg)) as db:
        table, geom, srid = db.execute(
            "select table_name, column_name, srs_id from gpkg_geometry_columns where table_name like '%roads%'"
        ).fetchone()
        projection = db.execute("select srs_name from gpkg_spatial_ref_sys where srs_id = ?", (srid,)).fetchone()[0]
        if srid not in (4326, 3857) and projection != "WGS 84 (CRS84)":
            raise ValueError(f"Unsupported spatial reference EPSG:{srid}")
        for name, kind, blob in db.execute(f'SELECT name, fclass, "{geom}" FROM "{table}" WHERE name IS NOT NULL'):
            if kind not in roads or not blob or not name.strip():
                continue
            envelope = (blob[3] >> 1) & 7
            for line in line_parts(blob, 8 + (0, 32, 48, 48, 64)[envelope])[0]:
                if srid == 3857:
                    line = [(math.degrees(x / 6378137), math.degrees(math.atan(math.sinh(y / 6378137)))) for x, y in line]
                points = result.setdefault(name.strip(), set())
                for (x0, y0), (x1, y1) in zip(line, line[1:]):
                    # Sample every ~35 m and include endpoints.
                    steps = max(1, math.ceil(math.hypot((x1 - x0) * 0.81, y1 - y0) * 111000 / 35))
                    for step in range(steps + 1):
                        x = x0 + (x1 - x0) * step / steps
                        y = y0 + (y1 - y0) * step / steps
                        points.add((round(y * 100000), round(x * 100000)))

output.parent.mkdir(parents=True, exist_ok=True)
rows = (json.dumps([name, [v for pair in sorted(points) for v in pair]], ensure_ascii=False, separators=(",", ":"))
        for name, points in sorted(result.items()))
output.write_text("[\n" + ",\n".join(rows) + "\n]\n", encoding="utf-8")
print(f"Wrote {len(result)} named streets ({output.stat().st_size:,} bytes)")
