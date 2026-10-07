"""python -m kilnwatch <stage> — one command per stage plus `all` (implementation_plan §7.1)."""
from __future__ import annotations

import argparse
import logging
import sys

from . import config as C


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="kilnwatch", description="Kiln Watch pipeline")
    sub = ap.add_subparsers(dest="stage", required=True)
    s = sub.add_parser("ingest", help="FIRMS, boundaries, inventories, OpenAQ")
    s.add_argument("--only", choices=["firms", "inventories", "boundaries", "openaq", "nightfire", "osm"])
    s = sub.add_parser("gee", help="Earth Engine clear fractions etc. (slow, resumable)")
    s.add_argument("--dataset", default="clear", choices=["clear", "worldcover", "water", "s5p", "era5"])
    s.add_argument("--units", default="admin", choices=["admin", "footprints", "transfer"])
    s.add_argument("--sensor", choices=["T", "A", "N", "J1", "J2"])
    s.add_argument("--from", dest="start")
    sub.add_parser("grid", help="cell-days, unit cells, rates")
    sub.add_parser("kilns", help="reconcile, cluster, controls")
    s = sub.add_parser("gates", help="G0-GN feasibility gates")
    s.add_argument("--gate", choices=["G0", "G1", "G2", "G3", "GN"])
    sub.add_parser("harmonize", help="calibration chain, LOSO, seam")
    s = sub.add_parser("classify", help="source classifier")
    s.add_argument("--transfer")
    sub.add_parser("metrics", help="per-unit calendars and season metrics")
    s = sub.add_parser("validate", help="validation layers")
    s.add_argument("--only", choices=["shape", "s2chips", "s2score", "tropomi", "pm25", "closure"])
    s = sub.add_parser("activity", help="kiln activity from night lights / radar (Amendment 1)")
    s.add_argument("--extract", choices=["ntl", "s1", "all"], help="pull the Earth Engine cache first (slow, resumable)")
    s = sub.add_parser("transfer", help="kiln method in other countries (Amendment 2; slow, resumable)")
    s.add_argument("--countries", nargs="+", default=["PK", "IN", "AF"], choices=["PK", "IN", "AF"])
    s.add_argument("--kinds", nargs="+", default=["ntl", "s1"], choices=["ntl", "s1"])
    s.add_argument("--no-extract", dest="extract", action="store_false", help="use the Earth Engine cache only")
    s.add_argument("--prepare-only", action="store_true", help="sample and controls only; no outcome data")
    s.add_argument("--design", default="A2", choices=["A2", "A4"], help="A2: first test (Amendments 2-3); A4: retest on fresh clusters, far controls")
    s = sub.add_parser("export", help="public / regulator / fixtures / checks / publish")
    s.add_argument("--regulator", action="store_true")
    s.add_argument("--fixtures", action="store_true")
    s.add_argument("--check-public", dest="check_public")
    s.add_argument("--publish", action="store_true")
    s.add_argument("--downscale", default="none", choices=["none", "upazila2012", "upazilaweekly"])
    s = sub.add_parser("nrt", help="daily near-real-time update")
    s.add_argument("--days", type=int, default=5)
    sub.add_parser("all", help="every stage after gee, in order (fails fast without the GEE cache)")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    C.REPORTS.mkdir(exist_ok=True)

    if a.stage == "ingest":
        from . import ingest
        ingest.run(a.only)
    elif a.stage == "gee":
        from . import gee
        gee.run(a.dataset, a.units, a.sensor, a.start)
    elif a.stage == "grid":
        from . import pipeline
        pipeline.grid_stage()
    elif a.stage == "kilns":
        from . import kilns
        kilns.run()
    elif a.stage == "gates":
        from . import gates
        gates.run()
    elif a.stage == "harmonize":
        from . import pipeline
        pipeline.harmonize_stage()
    elif a.stage == "classify":
        from . import classify
        classify.run()
    elif a.stage == "metrics":
        from . import pipeline
        pipeline.metrics_stage()
    elif a.stage == "validate":
        from . import validate
        validate.run(a.only)
    elif a.stage == "activity":
        from . import activity
        activity.run(a.extract)
    elif a.stage == "transfer":
        from . import transfer
        transfer.prepare_summary(tuple(a.countries), a.design) if a.prepare_only else transfer.run(tuple(a.countries), tuple(a.kinds), a.extract, a.design)
    elif a.stage == "export":
        from . import export
        export.run(a.regulator, a.fixtures, a.check_public, a.publish, a.downscale)
    elif a.stage == "nrt":
        from . import nrt
        nrt.run(a.days)
    elif a.stage == "all":
        if not (C.RAW / "gee" / "clear" / "admin").exists():
            print("ERROR GeeCacheMissing: data/raw/gee/clear/admin is missing. Run `python -m kilnwatch gee` first.", file=sys.stderr)
            return 2
        from . import activity, classify, export, gates, ingest, kilns, pipeline, validate
        ingest.run()
        pipeline.grid_stage()
        kilns.run()
        gates.run()
        pipeline.harmonize_stage()
        classify.run()
        pipeline.metrics_stage()
        validate.run(None)
        activity.run()  # uses its Earth Engine cache only; skipped with a warning when absent
        export.write_public()
    return 0


if __name__ == "__main__":
    sys.exit(main())
