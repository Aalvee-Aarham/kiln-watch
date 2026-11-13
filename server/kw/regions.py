"""Preset areas of interest. bbox = (west, south, east, north), degrees, CRS84."""

PRESETS = {
    "dhaka-kilns": {
        "name": "Dhaka brick-kiln belt",
        "country": "Bangladesh",
        "bbox": (89.9, 23.4, 90.9, 24.2),
        "story": "Thousands of brick kilns fire every dry season (Nov–Apr). Static heat sources must be separated from vegetation fires.",
        "lang": ["bn", "en"],
        "places": ["Dhaka", "Gazipur", "Narayanganj", "Savar"],
    },
    "punjab": {
        "name": "Punjab–Haryana crop residue burning",
        "country": "India",
        "bbox": (73.8, 29.5, 77.6, 32.6),
        "story": "Post-harvest rice stubble burning (Oct–Nov) and wheat residue (Apr–May) drive smog over the Indo-Gangetic Plain.",
        "lang": ["hi", "pa", "en"],
        "places": ["Punjab", "Haryana", "Ludhiana", "Sangrur"],
    },
    "la-rioja": {
        "name": "Chilecito, La Rioja",
        "country": "Argentina",
        "bbox": (-68.6, -30.0, -66.6, -28.2),
        "story": "Sparse, episodic mountain and scrub fires: a low-count region where sensor changes dominate raw trends.",
        "lang": ["es"],
        "places": ["La Rioja", "Chilecito", "Famatina"],
    },
    "rondonia": {
        "name": "Rondônia deforestation arc",
        "country": "Brazil",
        "bbox": (-64.5, -11.8, -61.0, -8.5),
        "story": "Dry-season (Jul–Oct) clearing fires along the Amazon arc of deforestation.",
        "lang": ["pt"],
        "places": ["Rondônia", "Porto Velho", "Ariquemes"],
    },
    "alberta": {
        "name": "Fort McMurray boreal forest",
        "country": "Canada",
        "bbox": (-113.5, 55.5, -110.0, 58.5),
        "story": "Boreal crown fires, including the May 2016 Horse River fire and the 2023 record season.",
        "lang": ["en", "fr"],
        "places": ["Fort McMurray", "Alberta", "Wood Buffalo"],
    },
    "se-australia": {
        "name": "South-east Australia",
        "country": "Australia",
        "bbox": (146.5, -38.0, 151.0, -33.5),
        "story": "The 2019–20 Black Summer megafires in New South Wales and Victoria.",
        "lang": ["en"],
        "places": ["New South Wales", "Victoria", "Gippsland"],
    },
    "n-california": {
        "name": "Northern California",
        "country": "United States",
        "bbox": (-123.5, 38.5, -120.0, 41.5),
        "story": "Wildland–urban interface fires: Camp (2018), August Complex and North Complex (2020), Dixie (2021).",
        "lang": ["en", "es"],
        "places": ["California", "Butte County", "Paradise"],
    },
    "parana-delta": {
        "name": "Paraná Delta wetlands",
        "country": "Argentina",
        "bbox": (-61.0, -34.4, -58.4, -32.0),
        "story": "Wetland and island fires, including the record 2020 and 2022 seasons; includes Predelta National Park.",
        "lang": ["es"],
        "places": ["Delta del Paraná", "Rosario", "Entre Ríos", "Victoria"],
    },
    "niger-delta": {
        "name": "Niger Delta gas flares",
        "country": "Nigeria",
        "bbox": (5.5, 4.3, 7.8, 6.2),
        "story": "Persistent oil-field gas flares: thermal anomalies that are not vegetation fires.",
        "lang": ["en"],
        "places": ["Rivers State", "Delta State", "Bayelsa"],
    },
}

MAX_AOI_DEG2 = 16.0  # ponytail: area cap keeps an on-demand build to minutes; raise with a job queue


def validate_bbox(bbox):
    """Return a clean (w, s, e, n) or raise ValueError. w > e means the box crosses the antimeridian."""
    if len(bbox) != 4:
        raise ValueError("bbox needs 4 numbers: west,south,east,north")
    w, s, e, n = (float(v) for v in bbox)
    if not (-180 <= w <= 180 and -180 <= e <= 180 and -90 <= s < n <= 90):
        raise ValueError("bbox out of range")
    width = (e - w) if e > w else (e + 360 - w)
    if width <= 0 or width * (n - s) > MAX_AOI_DEG2:
        raise ValueError(f"area must be between 0 and {MAX_AOI_DEG2} square degrees")
    return (w, s, e, n)


def envelopes(bbox):
    """Split an antimeridian-crossing box into two ordinary ones."""
    w, s, e, n = bbox
    return [(w, s, e, n)] if w <= e else [(w, s, 180.0, n), (-180.0, s, e, n)]
