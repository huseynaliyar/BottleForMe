The Malta street index is derived from [Geofabrik's Malta OpenStreetMap extract](https://download.geofabrik.de/europe/malta.html), snapshot 2026-11-07. The data in `malta-streets.json` is © OpenStreetMap contributors and available under the [Open Database License 1.0](https://www.openstreetmap.org/copyright). The generated database is included here; the code that consumes it is separate.

To refresh, download a Malta GeoPackage archive from Geofabrik and run `python scripts/update-malta-streets.py path/to/archive.zip`. The script uses only Python's standard library.
