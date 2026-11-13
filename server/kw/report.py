"""Print the cross-area results table (Markdown) from the built region files: python -m kw.report"""
import json

from .build import OUT
from .regions import PRESETS


def fmt(v, nd=2, pct=False):
    if v is None:
        return "–"
    return f"{v:+.{nd}f}%" if pct else f"{v:.{nd}f}"


def main():
    rows = []
    for rid in PRESETS:
        f = OUT / rid / "meta.json"
        if not f.exists():
            continue
        m = json.loads(f.read_text(encoding="utf-8"))
        st = m["steps"]["VIIRS_SNPP"]
        d = m["denial"]["modis_ends_2016"]
        t = m["trend"]["2003-2020"]
        rows.append((m["name"], fmt(st.get("raw_all_sensors_excess")), fmt(st.get("harmonized_excess")),
                     fmt(d["ours_seasonal_eb"].get("bias_pct"), 1, True), fmt(d["baseline_single_ratio"].get("bias_pct"), 1, True),
                     fmt(d["uncalibrated"].get("bias_pct"), 1, True), fmt(d["ours_seasonal_eb"].get("spearman")),
                     fmt((d["ours_seasonal_eb"].get("interval_coverage") or 0) * 100, 0),
                     fmt(t["harmonized"]["sen_per_year"], 1), fmt(t["aqua_only"]["sen_per_year"], 1), fmt(t["raw_all_sensors"]["sen_per_year"], 1)))
    head = ["Area", "Raw step at S-NPP ÷ Aqua", "Harmonized step ÷ Aqua", "MODIS-denial bias (ours)", "single ratio",
            "uncalibrated", "rank ρ", "95% interval coverage", "Sen slope/yr harmonized", "Aqua only", "raw"]
    print("| " + " | ".join(head) + " |")
    print("|" + "---|" * len(head))
    for r in rows:
        print("| " + " | ".join(r) + " |")
    pl = [json.loads((OUT / rid / "meta.json").read_text(encoding="utf-8")).get("placebo") for rid in PRESETS if (OUT / rid / "meta.json").exists()]
    pl = [p for p in pl if p]
    if pl:
        print(f"\nPlacebo steps (no satellite change), harmonized ÷ Aqua, 5th–95th percentile per area: "
              + "; ".join(f"{p['excess_p05']}–{p['excess_p95']}" for p in pl))


if __name__ == "__main__":
    main()
