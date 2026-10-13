// Place names, aliases and map extents for the Ask stage, and where each place's real data lives.
// No figures: every number the stage shows is computed from the public export (docs/real_data_plan.md).
// Covers all 64 districts of Bangladesh (unit_id from aoi/districts.geojson) and named places elsewhere
// (Natural Earth ids from aoi/world_states.geojson / world_countries.geojson; measured data after Amendment 5).

export type HistoricalNews = {
  year: number
  title: string
  source: string
  date: string
  summary: string
  severity: 'high' | 'medium' | 'info'
  url: string
}

export type RegionProfile = {
  key: string
  name: string
  country: string
  stateOrDivision?: string
  /** Place centre and map extent [west, south, east, north]; checked against the unit geometry in regionRegistry.test.ts. */
  coords: [number, number]
  bbox: [number, number, number, number]
  aliases: string[]
  /** Where its real data lives: a Bangladesh unit, or Natural Earth units for places outside Bangladesh. */
  unit: { kind: 'bd'; unit_id: string } | { kind: 'ne'; ids: string[] }
  /** Other Bangladesh districts the place spans (the stage shows the first unit's figures and names these). */
  alsoUnits?: string[]
}

export const REGION_REGISTRY: Record<string, RegionProfile> = {
  "dhaka": {
    "key": "dhaka",
    "name": "Dhaka, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.2584,
      23.7857
    ],
    "bbox": [
      90,
      23.53,
      90.51,
      24.04
    ],
    "aliases": [
      "dhaka",
      "ঢাকা",
      "dhaka"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3026"
    }
  },
  "rajshahi": {
    "key": "rajshahi",
    "name": "Rajshahi, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      88.6275,
      24.4173
    ],
    "bbox": [
      88.29,
      24.11,
      88.96,
      24.72
    ],
    "aliases": [
      "rajshahi",
      "রাজশাহী",
      "rajshahi"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5081"
    }
  },
  "khulna": {
    "key": "khulna",
    "name": "Khulna, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.4952,
      22.3374
    ],
    "bbox": [
      89.24,
      21.66,
      89.75,
      23.01
    ],
    "aliases": [
      "khulna",
      "খুলনা",
      "khulna"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4047"
    }
  },
  "barguna": {
    "key": "barguna",
    "name": "Barguna, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Barishal Division",
    "coords": [
      90.1255,
      22.1628
    ],
    "bbox": [
      89.88,
      21.85,
      90.37,
      22.48
    ],
    "aliases": [
      "barguna",
      "বরগুনা",
      "barguna"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD1004"
    }
  },
  "barishal": {
    "key": "barishal",
    "name": "Barishal, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Barishal Division",
    "coords": [
      90.3594,
      22.7673
    ],
    "bbox": [
      90.02,
      22.45,
      90.7,
      23.08
    ],
    "aliases": [
      "barishal",
      "বরিশাল",
      "barishal"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD1006"
    }
  },
  "bhola": {
    "key": "bhola",
    "name": "Bhola, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Barishal Division",
    "coords": [
      90.7732,
      22.3535
    ],
    "bbox": [
      90.52,
      21.84,
      91.02,
      22.87
    ],
    "aliases": [
      "bhola",
      "ভোলা",
      "bhola"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD1009"
    }
  },
  "jhalokati": {
    "key": "jhalokati",
    "name": "Jhalokati, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Barishal Division",
    "coords": [
      90.201,
      22.5601
    ],
    "bbox": [
      90.02,
      22.34,
      90.38,
      22.78
    ],
    "aliases": [
      "jhalokati",
      "ঝালকাঠি",
      "jhalokati"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD1042"
    }
  },
  "patuakhali": {
    "key": "patuakhali",
    "name": "Patuakhali, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Barishal Division",
    "coords": [
      90.3715,
      22.1938
    ],
    "bbox": [
      90.08,
      21.79,
      90.66,
      22.59
    ],
    "aliases": [
      "patuakhali",
      "পটুয়াখালী",
      "patuakhali"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD1078"
    }
  },
  "pirojpur": {
    "key": "pirojpur",
    "name": "Pirojpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Barishal Division",
    "coords": [
      90.0232,
      22.5128
    ],
    "bbox": [
      89.86,
      22.16,
      90.19,
      22.87
    ],
    "aliases": [
      "pirojpur",
      "পিরোজপুর",
      "pirojpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD1079"
    }
  },
  "bandarban": {
    "key": "bandarban",
    "name": "Bandarban, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      92.3711,
      21.7664
    ],
    "bbox": [
      92.06,
      21.18,
      92.68,
      22.35
    ],
    "aliases": [
      "bandarban",
      "বান্দরবান",
      "bandarban",
      "chittagong hill tracts",
      "cht",
      "jhum"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2003"
    },
    "alsoUnits": [
      "BD2084",
      "BD2046"
    ]
  },
  "brahmanbaria": {
    "key": "brahmanbaria",
    "name": "Brahmanbaria, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      91.0252,
      23.9576
    ],
    "bbox": [
      90.72,
      23.65,
      91.33,
      24.27
    ],
    "aliases": [
      "brahmanbaria",
      "ব্রাহ্মণবাড়িয়া",
      "brahmanbaria"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2012"
    }
  },
  "chandpur": {
    "key": "chandpur",
    "name": "Chandpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      90.7777,
      23.2437
    ],
    "bbox": [
      90.53,
      22.98,
      91.03,
      23.5
    ],
    "aliases": [
      "chandpur",
      "চাঁদপুর",
      "chandpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2013"
    }
  },
  "chattogram": {
    "key": "chattogram",
    "name": "Chattogram, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      91.7647,
      22.4233
    ],
    "bbox": [
      91.31,
      21.86,
      92.22,
      22.99
    ],
    "aliases": [
      "chattogram",
      "চট্টগ্রাম",
      "chittagong"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2015"
    }
  },
  "cumilla": {
    "key": "cumilla",
    "name": "Cumilla, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      90.9973,
      23.423
    ],
    "bbox": [
      90.63,
      23.05,
      91.37,
      23.8
    ],
    "aliases": [
      "cumilla",
      "কুমিল্লা",
      "cumilla"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2019"
    }
  },
  "coxsbazar": {
    "key": "coxsbazar",
    "name": "Cox's Bazar, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      92.0991,
      21.2569
    ],
    "bbox": [
      91.83,
      20.59,
      92.37,
      21.92
    ],
    "aliases": [
      "cox's bazar",
      "কক্সবাজার",
      "coxsbazar"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2022"
    }
  },
  "feni": {
    "key": "feni",
    "name": "Feni, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      91.4136,
      23.0106
    ],
    "bbox": [
      91.25,
      22.74,
      91.58,
      23.28
    ],
    "aliases": [
      "feni",
      "ফেনী",
      "feni"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2030"
    }
  },
  "khagrachhari": {
    "key": "khagrachhari",
    "name": "Khagrachhari, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      91.955,
      23.2109
    ],
    "bbox": [
      91.71,
      22.69,
      92.2,
      23.73
    ],
    "aliases": [
      "khagrachhari",
      "খাগড়াছড়ি",
      "khagrachhari"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2046"
    }
  },
  "lakshmipur": {
    "key": "lakshmipur",
    "name": "Lakshmipur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      90.8374,
      22.8296
    ],
    "bbox": [
      90.65,
      22.49,
      91.02,
      23.17
    ],
    "aliases": [
      "lakshmipur",
      "লক্ষ্মীপুর",
      "lakshmipur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2051"
    }
  },
  "noakhali": {
    "key": "noakhali",
    "name": "Noakhali, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      91.1913,
      22.5769
    ],
    "bbox": [
      90.89,
      22.02,
      91.49,
      23.13
    ],
    "aliases": [
      "noakhali",
      "নোয়াখালী",
      "noakhali"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2075"
    }
  },
  "rangamati": {
    "key": "rangamati",
    "name": "Rangamati, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Chattogram Division",
    "coords": [
      92.2798,
      22.794
    ],
    "bbox": [
      91.93,
      21.85,
      92.63,
      23.74
    ],
    "aliases": [
      "rangamati",
      "রাঙ্গামাটি",
      "rangamati"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD2084"
    }
  },
  "faridpur": {
    "key": "faridpur",
    "name": "Faridpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      89.8355,
      23.4664
    ],
    "bbox": [
      89.49,
      23.21,
      90.18,
      23.72
    ],
    "aliases": [
      "faridpur",
      "ফরিদপুর",
      "faridpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3029"
    }
  },
  "gazipur": {
    "key": "gazipur",
    "name": "Gazipur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.4265,
      24.0938
    ],
    "bbox": [
      90.15,
      23.85,
      90.7,
      24.34
    ],
    "aliases": [
      "gazipur",
      "গাজীপুর",
      "gazipur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3033"
    }
  },
  "gopalganj": {
    "key": "gopalganj",
    "name": "Gopalganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      89.907,
      23.1031
    ],
    "bbox": [
      89.67,
      22.85,
      90.14,
      23.36
    ],
    "aliases": [
      "gopalganj",
      "গোপালগঞ্জ",
      "gopalganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3035"
    }
  },
  "kishoreganj": {
    "key": "kishoreganj",
    "name": "Kishoreganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.9162,
      24.3402
    ],
    "bbox": [
      90.58,
      24.04,
      91.26,
      24.65
    ],
    "aliases": [
      "kishoreganj",
      "কিশোরগঞ্জ",
      "kishoreganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3048"
    }
  },
  "madaripur": {
    "key": "madaripur",
    "name": "Madaripur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.1452,
      23.2287
    ],
    "bbox": [
      89.94,
      22.96,
      90.36,
      23.49
    ],
    "aliases": [
      "madaripur",
      "মাদারীপুর",
      "madaripur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3054"
    }
  },
  "manikganj": {
    "key": "manikganj",
    "name": "Manikganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      89.972,
      23.831
    ],
    "bbox": [
      89.69,
      23.63,
      90.26,
      24.04
    ],
    "aliases": [
      "manikganj",
      "মানিকগঞ্জ",
      "manikganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3056"
    }
  },
  "munshiganj": {
    "key": "munshiganj",
    "name": "Munshiganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.4327,
      23.5267
    ],
    "bbox": [
      90.16,
      23.38,
      90.71,
      23.67
    ],
    "aliases": [
      "munshiganj",
      "মুন্সিগঞ্জ",
      "munshiganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3059"
    }
  },
  "narayanganj": {
    "key": "narayanganj",
    "name": "Narayanganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.5853,
      23.7158
    ],
    "bbox": [
      90.43,
      23.54,
      90.74,
      23.9
    ],
    "aliases": [
      "narayanganj",
      "নারায়ণগঞ্জ",
      "narayanganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3067"
    }
  },
  "narsingdi": {
    "key": "narsingdi",
    "name": "Narsingdi, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.7739,
      24.0073
    ],
    "bbox": [
      90.56,
      23.76,
      90.99,
      24.25
    ],
    "aliases": [
      "narsingdi",
      "নরসিংদী",
      "narsingdi"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3068"
    }
  },
  "rajbari": {
    "key": "rajbari",
    "name": "Rajbari, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      89.5726,
      23.7353
    ],
    "bbox": [
      89.3,
      23.56,
      89.85,
      23.91
    ],
    "aliases": [
      "rajbari",
      "রাজবাড়ী",
      "rajbari"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3082"
    }
  },
  "shariatpur": {
    "key": "shariatpur",
    "name": "Shariatpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.4128,
      23.2264
    ],
    "bbox": [
      90.23,
      23.01,
      90.6,
      23.45
    ],
    "aliases": [
      "shariatpur",
      "শরীয়তপুর",
      "shariatpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3086"
    }
  },
  "tangail": {
    "key": "tangail",
    "name": "Tangail, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Dhaka Division",
    "coords": [
      90.0208,
      24.3771
    ],
    "bbox": [
      89.74,
      23.97,
      90.31,
      24.79
    ],
    "aliases": [
      "tangail",
      "টাঙ্গাইল",
      "tangail"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD3093"
    }
  },
  "bagerhat": {
    "key": "bagerhat",
    "name": "Bagerhat, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.7491,
      22.3567
    ],
    "bbox": [
      89.53,
      21.73,
      89.97,
      22.98
    ],
    "aliases": [
      "bagerhat",
      "বাগেরহাট",
      "bagerhat"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4001"
    }
  },
  "chuadanga": {
    "key": "chuadanga",
    "name": "Chuadanga, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      88.8259,
      23.6036
    ],
    "bbox": [
      88.64,
      23.37,
      89.02,
      23.84
    ],
    "aliases": [
      "chuadanga",
      "চুয়াডাঙ্গা",
      "chuadanga"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4018"
    }
  },
  "jashore": {
    "key": "jashore",
    "name": "Jashore, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.2029,
      23.0838
    ],
    "bbox": [
      88.85,
      22.8,
      89.56,
      23.37
    ],
    "aliases": [
      "jashore",
      "যশোর",
      "jashore"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4041"
    }
  },
  "jhenaidah": {
    "key": "jhenaidah",
    "name": "Jhenaidah, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.0365,
      23.4951
    ],
    "bbox": [
      88.7,
      23.22,
      89.38,
      23.77
    ],
    "aliases": [
      "jhenaidah",
      "ঝিনাইদহ",
      "jhenaidah"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4044"
    }
  },
  "kushtia": {
    "key": "kushtia",
    "name": "Kushtia, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.029,
      23.9565
    ],
    "bbox": [
      88.69,
      23.69,
      89.36,
      24.22
    ],
    "aliases": [
      "kushtia",
      "কুষ্টিয়া",
      "kushtia"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4050"
    }
  },
  "magura": {
    "key": "magura",
    "name": "Magura, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.4323,
      23.4705
    ],
    "bbox": [
      89.24,
      23.26,
      89.62,
      23.68
    ],
    "aliases": [
      "magura",
      "মাগুরা",
      "magura"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4055"
    }
  },
  "meherpur": {
    "key": "meherpur",
    "name": "Meherpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      88.7203,
      23.7891
    ],
    "bbox": [
      88.56,
      23.6,
      88.88,
      23.98
    ],
    "aliases": [
      "meherpur",
      "মেহেরপুর",
      "meherpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4057"
    }
  },
  "narail": {
    "key": "narail",
    "name": "Narail, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.5896,
      23.1372
    ],
    "bbox": [
      89.38,
      22.96,
      89.8,
      23.32
    ],
    "aliases": [
      "narail",
      "নড়াইল",
      "narail"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4065"
    }
  },
  "satkhira": {
    "key": "satkhira",
    "name": "Satkhira, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Khulna Division",
    "coords": [
      89.1339,
      22.2963
    ],
    "bbox": [
      88.9,
      21.65,
      89.37,
      22.95
    ],
    "aliases": [
      "satkhira",
      "সাতক্ষীরা",
      "satkhira"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4087"
    }
  },
  "jamalpur": {
    "key": "jamalpur",
    "name": "Jamalpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Mymensingh Division",
    "coords": [
      89.9206,
      25.0028
    ],
    "bbox": [
      89.64,
      24.57,
      90.2,
      25.43
    ],
    "aliases": [
      "jamalpur",
      "জামালপুর",
      "jamalpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4539"
    }
  },
  "mymensingh": {
    "key": "mymensingh",
    "name": "Mymensingh, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Mymensingh Division",
    "coords": [
      90.4501,
      24.7206
    ],
    "bbox": [
      90.08,
      24.25,
      90.82,
      25.19
    ],
    "aliases": [
      "mymensingh",
      "ময়মনসিংহ",
      "mymensingh"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4561"
    }
  },
  "netrakona": {
    "key": "netrakona",
    "name": "Netrakona, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Mymensingh Division",
    "coords": [
      90.8682,
      24.8863
    ],
    "bbox": [
      90.49,
      24.57,
      91.24,
      25.2
    ],
    "aliases": [
      "netrakona",
      "নেত্রকোণা",
      "netrakona"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4572"
    }
  },
  "sherpur": {
    "key": "sherpur",
    "name": "Sherpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Mymensingh Division",
    "coords": [
      90.0979,
      25.0951
    ],
    "bbox": [
      89.88,
      24.89,
      90.31,
      25.3
    ],
    "aliases": [
      "sherpur",
      "শেরপুর",
      "sherpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4589"
    }
  },
  "bogura": {
    "key": "bogura",
    "name": "Bogura, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      89.358,
      24.8289
    ],
    "bbox": [
      88.96,
      24.54,
      89.75,
      25.12
    ],
    "aliases": [
      "bogura",
      "বগুড়া",
      "bogura"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5010"
    }
  },
  "joypurhat": {
    "key": "joypurhat",
    "name": "Joypurhat, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      89.1015,
      25.0633
    ],
    "bbox": [
      88.92,
      24.85,
      89.28,
      25.28
    ],
    "aliases": [
      "joypurhat",
      "জয়পুরহাট",
      "joypurhat"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5038"
    }
  },
  "naogaon": {
    "key": "naogaon",
    "name": "Naogaon, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      88.7659,
      24.8742
    ],
    "bbox": [
      88.38,
      24.53,
      89.15,
      25.21
    ],
    "aliases": [
      "naogaon",
      "নওগাঁ",
      "naogaon"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5064"
    }
  },
  "natore": {
    "key": "natore",
    "name": "Natore, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      89.0907,
      24.3969
    ],
    "bbox": [
      88.84,
      24.11,
      89.34,
      24.69
    ],
    "aliases": [
      "natore",
      "নাটোর",
      "natore"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5069"
    }
  },
  "chapainababganj": {
    "key": "chapainababganj",
    "name": "Chapainababganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      88.2599,
      24.6912
    ],
    "bbox": [
      88.01,
      24.42,
      88.51,
      24.97
    ],
    "aliases": [
      "chapainababganj",
      "চাঁপাইনবাবগঞ্জ",
      "chapainababganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5070"
    }
  },
  "pabna": {
    "key": "pabna",
    "name": "Pabna, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      89.3647,
      24.0801
    ],
    "bbox": [
      89,
      23.81,
      89.73,
      24.35
    ],
    "aliases": [
      "pabna",
      "পাবনা",
      "pabna"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5076"
    }
  },
  "sirajganj": {
    "key": "sirajganj",
    "name": "Sirajganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rajshahi Division",
    "coords": [
      89.5371,
      24.3961
    ],
    "bbox": [
      89.25,
      24.01,
      89.83,
      24.78
    ],
    "aliases": [
      "sirajganj",
      "সিরাজগঞ্জ",
      "sirajganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5088"
    }
  },
  "dinajpur": {
    "key": "dinajpur",
    "name": "Dinajpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      88.8417,
      25.6435
    ],
    "bbox": [
      88.38,
      25.22,
      89.3,
      26.06
    ],
    "aliases": [
      "dinajpur",
      "দিনাজপুর",
      "dinajpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5527"
    }
  },
  "gaibandha": {
    "key": "gaibandha",
    "name": "Gaibandha, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      89.4706,
      25.34
    ],
    "bbox": [
      89.18,
      25.04,
      89.76,
      25.64
    ],
    "aliases": [
      "gaibandha",
      "গাইবান্ধা",
      "gaibandha"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5532"
    }
  },
  "kurigram": {
    "key": "kurigram",
    "name": "Kurigram, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      89.6686,
      25.8061
    ],
    "bbox": [
      89.45,
      25.37,
      89.89,
      26.24
    ],
    "aliases": [
      "kurigram",
      "কুড়িগ্রাম",
      "kurigram"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5549"
    }
  },
  "lalmonirhat": {
    "key": "lalmonirhat",
    "name": "Lalmonirhat, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      89.2401,
      26.1237
    ],
    "bbox": [
      88.9,
      25.79,
      89.58,
      26.46
    ],
    "aliases": [
      "lalmonirhat",
      "লালমনিরহাট",
      "lalmonirhat"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5552"
    }
  },
  "nilphamari": {
    "key": "nilphamari",
    "name": "Nilphamari, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      88.9391,
      26.0233
    ],
    "bbox": [
      88.73,
      25.74,
      89.14,
      26.31
    ],
    "aliases": [
      "nilphamari",
      "নীলফামারী",
      "nilphamari"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5573"
    }
  },
  "panchagarh": {
    "key": "panchagarh",
    "name": "Panchagarh, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      88.5586,
      26.3193
    ],
    "bbox": [
      88.32,
      26.01,
      88.8,
      26.63
    ],
    "aliases": [
      "panchagarh",
      "পঞ্চগড়",
      "panchagarh"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5577"
    }
  },
  "rangpur": {
    "key": "rangpur",
    "name": "Rangpur, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      89.2305,
      25.6336
    ],
    "bbox": [
      88.93,
      25.3,
      89.53,
      25.97
    ],
    "aliases": [
      "rangpur",
      "রংপুর",
      "rangpur"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5585"
    }
  },
  "thakurgaon": {
    "key": "thakurgaon",
    "name": "Thakurgaon, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Rangpur Division",
    "coords": [
      88.3631,
      25.9366
    ],
    "bbox": [
      88.09,
      25.67,
      88.64,
      26.2
    ],
    "aliases": [
      "thakurgaon",
      "ঠাকুরগাঁও",
      "thakurgaon"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD5594"
    }
  },
  "habiganj": {
    "key": "habiganj",
    "name": "Habiganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Sylhet Division",
    "coords": [
      91.4101,
      24.3364
    ],
    "bbox": [
      91.15,
      23.97,
      91.67,
      24.7
    ],
    "aliases": [
      "habiganj",
      "হবিগঞ্জ",
      "habiganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD6036"
    }
  },
  "moulvibazar": {
    "key": "moulvibazar",
    "name": "Moulvibazar, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Sylhet Division",
    "coords": [
      91.9483,
      24.4876
    ],
    "bbox": [
      91.6,
      24.14,
      92.3,
      24.84
    ],
    "aliases": [
      "moulvibazar",
      "মৌলভীবাজার",
      "moulvibazar"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD6058"
    }
  },
  "sunamganj": {
    "key": "sunamganj",
    "name": "Sunamganj, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Sylhet Division",
    "coords": [
      91.3316,
      24.8871
    ],
    "bbox": [
      90.93,
      24.57,
      91.73,
      25.2
    ],
    "aliases": [
      "sunamganj",
      "সুনামগঞ্জ",
      "sunamganj"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD6090"
    }
  },
  "sylhet": {
    "key": "sylhet",
    "name": "Sylhet, Bangladesh",
    "country": "Bangladesh",
    "stateOrDivision": "Sylhet Division",
    "coords": [
      92.0654,
      24.8912
    ],
    "bbox": [
      91.63,
      24.6,
      92.5,
      25.19
    ],
    "aliases": [
      "sylhet",
      "সিলেট",
      "sylhet"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD6091"
    }
  },
  "punjab": {
    "key": "punjab",
    "name": "Punjab, India",
    "country": "India",
    "stateOrDivision": "Punjab",
    "coords": [
      75.3412,
      31.1471
    ],
    "bbox": [
      73.85,
      29.53,
      76.92,
      32.51
    ],
    "aliases": [
      "punjab",
      "punjab, india",
      "punjab",
      "punjab"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3249"
      ]
    }
  },
  "haryana": {
    "key": "haryana",
    "name": "Haryana, India",
    "country": "India",
    "stateOrDivision": "Haryana",
    "coords": [
      76.0856,
      29.0588
    ],
    "bbox": [
      74.45,
      27.65,
      77.6,
      30.9
    ],
    "aliases": [
      "haryana",
      "haryana, india",
      "haryana",
      "haryana"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2430"
      ]
    }
  },
  "delhi": {
    "key": "delhi",
    "name": "Delhi NCR, India",
    "country": "India",
    "stateOrDivision": "Delhi NCR",
    "coords": [
      77.1025,
      28.7041
    ],
    "bbox": [
      76.84,
      28.4,
      77.35,
      28.88
    ],
    "aliases": [
      "delhi",
      "delhi ncr, india",
      "delhi ncr",
      "delhincr"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2428"
      ]
    }
  },
  "uttarpradesh": {
    "key": "uttarpradesh",
    "name": "Uttar Pradesh, India",
    "country": "India",
    "stateOrDivision": "Uttar Pradesh",
    "coords": [
      80.9462,
      26.8467
    ],
    "bbox": [
      77.1,
      23.85,
      84.65,
      30.4
    ],
    "aliases": [
      "uttarpradesh",
      "uttar pradesh, india",
      "uttar pradesh",
      "uttarpradesh"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3253"
      ]
    }
  },
  "bihar": {
    "key": "bihar",
    "name": "Bihar, India",
    "country": "India",
    "stateOrDivision": "Bihar",
    "coords": [
      85.3131,
      25.0961
    ],
    "bbox": [
      83.3,
      24.28,
      88.29,
      27.52
    ],
    "aliases": [
      "bihar",
      "bihar, india",
      "bihar",
      "bihar"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3258"
      ]
    }
  },
  "westbengal": {
    "key": "westbengal",
    "name": "West Bengal, India",
    "country": "India",
    "stateOrDivision": "West Bengal",
    "coords": [
      87.855,
      22.9868
    ],
    "bbox": [
      85.8,
      21.5,
      89.9,
      27.2
    ],
    "aliases": [
      "westbengal",
      "west bengal, india",
      "west bengal",
      "westbengal"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3257"
      ]
    }
  },
  "rajasthan": {
    "key": "rajasthan",
    "name": "Rajasthan, India",
    "country": "India",
    "stateOrDivision": "Rajasthan",
    "coords": [
      74.2179,
      27.0238
    ],
    "bbox": [
      69.5,
      23.05,
      78.25,
      30.2
    ],
    "aliases": [
      "rajasthan",
      "rajasthan, india",
      "rajasthan",
      "rajasthan"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3250"
      ]
    }
  },
  "madhyapradesh": {
    "key": "madhyapradesh",
    "name": "Madhya Pradesh, India",
    "country": "India",
    "stateOrDivision": "Madhya Pradesh",
    "coords": [
      77.4126,
      22.9734
    ],
    "bbox": [
      74,
      21.05,
      82.8,
      26.85
    ],
    "aliases": [
      "madhyapradesh",
      "madhya pradesh, india",
      "madhya pradesh",
      "madhyapradesh"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3261"
      ]
    }
  },
  "gujarat": {
    "key": "gujarat",
    "name": "Gujarat, India",
    "country": "India",
    "stateOrDivision": "Gujarat",
    "coords": [
      71.1924,
      22.2587
    ],
    "bbox": [
      68.1,
      20.1,
      74.45,
      24.7
    ],
    "aliases": [
      "gujarat",
      "gujarat, india",
      "gujarat",
      "gujarat"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3264"
      ]
    }
  },
  "maharashtra": {
    "key": "maharashtra",
    "name": "Maharashtra, India",
    "country": "India",
    "stateOrDivision": "Maharashtra",
    "coords": [
      75.7139,
      19.7515
    ],
    "bbox": [
      72.6,
      15.6,
      80.9,
      22
    ],
    "aliases": [
      "maharashtra",
      "maharashtra, india",
      "maharashtra",
      "maharashtra"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2447"
      ]
    }
  },
  "myanmar": {
    "key": "myanmar",
    "name": "Myanmar (Burma)",
    "country": "Myanmar",
    "stateOrDivision": "Myanmar",
    "coords": [
      96.1603,
      21.9162
    ],
    "bbox": [
      92.2,
      9.6,
      101.2,
      28.5
    ],
    "aliases": [
      "myanmar",
      "myanmar (burma)",
      "myanmar"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "MMR"
      ]
    }
  },
  "thailand": {
    "key": "thailand",
    "name": "Thailand",
    "country": "Thailand",
    "stateOrDivision": "Thailand",
    "coords": [
      100.5018,
      13.7563
    ],
    "bbox": [
      97.35,
      5.6,
      105.65,
      20.45
    ],
    "aliases": [
      "thailand",
      "thailand",
      "thailand"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "THA"
      ]
    }
  },
  "vietnam": {
    "key": "vietnam",
    "name": "Vietnam",
    "country": "Vietnam",
    "stateOrDivision": "Vietnam",
    "coords": [
      105.8048,
      21.0285
    ],
    "bbox": [
      102.1,
      8.55,
      109.5,
      23.4
    ],
    "aliases": [
      "vietnam",
      "vietnam",
      "vietnam"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "VNM"
      ]
    }
  },
  "laos": {
    "key": "laos",
    "name": "Laos",
    "country": "Laos",
    "stateOrDivision": "Laos",
    "coords": [
      102.6331,
      17.9757
    ],
    "bbox": [
      100.1,
      13.9,
      107.65,
      22.5
    ],
    "aliases": [
      "laos",
      "laos",
      "laos"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "LAO"
      ]
    }
  },
  "cambodia": {
    "key": "cambodia",
    "name": "Cambodia",
    "country": "Cambodia",
    "stateOrDivision": "Cambodia",
    "coords": [
      104.9282,
      11.5564
    ],
    "bbox": [
      102.3,
      10.4,
      107.6,
      14.7
    ],
    "aliases": [
      "cambodia",
      "cambodia",
      "cambodia"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "KHM"
      ]
    }
  },
  "indonesia": {
    "key": "indonesia",
    "name": "Indonesia",
    "country": "Indonesia",
    "stateOrDivision": "Indonesia",
    "coords": [
      106.8456,
      -6.2088
    ],
    "bbox": [
      95,
      -11,
      141,
      6
    ],
    "aliases": [
      "indonesia",
      "indonesia",
      "indonesia"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IDN"
      ]
    }
  },
  "malaysia": {
    "key": "malaysia",
    "name": "Malaysia",
    "country": "Malaysia",
    "stateOrDivision": "Malaysia",
    "coords": [
      101.6869,
      3.139
    ],
    "bbox": [
      99.6,
      0.85,
      119.3,
      7.35
    ],
    "aliases": [
      "malaysia",
      "malaysia",
      "malaysia"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "MYS"
      ]
    }
  },
  "philippines": {
    "key": "philippines",
    "name": "Philippines",
    "country": "Philippines",
    "stateOrDivision": "Philippines",
    "coords": [
      120.9842,
      14.5995
    ],
    "bbox": [
      116.9,
      4.6,
      126.6,
      21.1
    ],
    "aliases": [
      "philippines",
      "philippines",
      "philippines"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "PHL"
      ]
    }
  },
  "pakistan": {
    "key": "pakistan",
    "name": "Pakistan",
    "country": "Pakistan",
    "stateOrDivision": "Pakistan",
    "coords": [
      69.3451,
      30.3753
    ],
    "bbox": [
      60.85,
      23.7,
      77.1,
      37.1
    ],
    "aliases": [
      "pakistan",
      "pakistan",
      "pakistan"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "PAK"
      ]
    }
  },
  "nepal": {
    "key": "nepal",
    "name": "Nepal",
    "country": "Nepal",
    "stateOrDivision": "Nepal",
    "coords": [
      84.124,
      28.3949
    ],
    "bbox": [
      80.05,
      26.35,
      88.2,
      30.45
    ],
    "aliases": [
      "nepal",
      "nepal",
      "nepal"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "NPL"
      ]
    }
  },
  "bhutan": {
    "key": "bhutan",
    "name": "Bhutan",
    "country": "Bhutan",
    "stateOrDivision": "Bhutan",
    "coords": [
      90.4336,
      27.5142
    ],
    "bbox": [
      88.75,
      26.7,
      92.15,
      28.35
    ],
    "aliases": [
      "bhutan",
      "bhutan",
      "bhutan"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "BTN"
      ]
    }
  },
  "srilanka": {
    "key": "srilanka",
    "name": "Sri Lanka",
    "country": "Sri Lanka",
    "stateOrDivision": "Sri Lanka",
    "coords": [
      80.7718,
      7.8731
    ],
    "bbox": [
      79.65,
      5.9,
      81.9,
      9.85
    ],
    "aliases": [
      "srilanka",
      "sri lanka",
      "sri lanka"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "LKA"
      ]
    }
  },
  "china": {
    "key": "china",
    "name": "China",
    "country": "China",
    "coords": [
      104.1954,
      35.8617
    ],
    "bbox": [
      73.5,
      18.15,
      134.75,
      53.55
    ],
    "aliases": [
      "china",
      "peoples republic of china",
      "prc",
      "mainland china",
      "hebei",
      "henan",
      "shandong"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "CHN"
      ]
    }
  },
  "japan": {
    "key": "japan",
    "name": "Japan",
    "country": "Japan",
    "coords": [
      138.2529,
      36.2048
    ],
    "bbox": [
      122.9,
      24.0,
      153.98,
      45.52
    ],
    "aliases": [
      "japan",
      "tokyo",
      "osaka",
      "kyoto",
      "hokkaido",
      "niigata"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "JPN"
      ]
    }
  },
  "southkorea": {
    "key": "southkorea",
    "name": "South Korea",
    "country": "South Korea",
    "coords": [
      127.7669,
      35.9078
    ],
    "bbox": [
      124.6,
      33.1,
      131.9,
      38.6
    ],
    "aliases": [
      "south korea",
      "korea",
      "republic of korea",
      "seoul",
      "busan",
      "incheon",
      "gangwon"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "KOR"
      ]
    }
  },
  "northkorea": {
    "key": "northkorea",
    "name": "North Korea",
    "country": "North Korea",
    "coords": [
      127.5101,
      40.3399
    ],
    "bbox": [
      124.2,
      37.6,
      130.7,
      43.0
    ],
    "aliases": [
      "north korea",
      "dprk",
      "pyongyang"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "PRK"
      ]
    }
  },
  "mongolia": {
    "key": "mongolia",
    "name": "Mongolia",
    "country": "Mongolia",
    "coords": [
      103.8467,
      46.8625
    ],
    "bbox": [
      87.75,
      41.58,
      119.9,
      52.15
    ],
    "aliases": [
      "mongolia",
      "ulaanbaatar"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "MNG"
      ]
    }
  },
  "taiwan": {
    "key": "taiwan",
    "name": "Taiwan",
    "country": "Taiwan",
    "coords": [
      120.9605,
      23.6978
    ],
    "bbox": [
      119.3,
      21.8,
      122.1,
      25.4
    ],
    "aliases": [
      "taiwan",
      "taipei",
      "kaohsiung",
      "taichung"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "TWN"
      ]
    }
  },
  "singapore": {
    "key": "singapore",
    "name": "Singapore",
    "country": "Singapore",
    "coords": [
      103.8198,
      1.3521
    ],
    "bbox": [
      103.6,
      1.2,
      104.05,
      1.48
    ],
    "aliases": [
      "singapore",
      "singapore city",
      "jurong",
      "changi"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "SGP"
      ]
    }
  },
  "brunei": {
    "key": "brunei",
    "name": "Brunei",
    "country": "Brunei",
    "coords": [
      114.7277,
      4.5353
    ],
    "bbox": [
      114.05,
      4.0,
      115.35,
      5.05
    ],
    "aliases": [
      "brunei",
      "brunei darussalam",
      "bandar seri begawan"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "BRN"
      ]
    }
  },
  "timorleste": {
    "key": "timorleste",
    "name": "Timor-Leste",
    "country": "Timor-Leste",
    "coords": [
      125.7275,
      -8.8742
    ],
    "bbox": [
      124.0,
      -9.5,
      127.35,
      -8.1
    ],
    "aliases": [
      "timor-leste",
      "east timor",
      "timor leste",
      "dili"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "TLS"
      ]
    }
  },
  "maldives": {
    "key": "maldives",
    "name": "Maldives",
    "country": "Maldives",
    "coords": [
      73.2207,
      3.2028
    ],
    "bbox": [
      72.5,
      -0.7,
      73.8,
      7.1
    ],
    "aliases": [
      "maldives",
      "male",
      "malé"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "MDV"
      ]
    }
  },
  "goa": {
    "key": "goa",
    "name": "Goa, India",
    "country": "India",
    "stateOrDivision": "Goa",
    "coords": [
      74.05,
      15.3
    ],
    "bbox": [
      73.65,
      14.85,
      74.35,
      15.8
    ],
    "aliases": [
      "goa",
      "goa, india",
      "panaji",
      "margao",
      "vasco",
      "western ghats goa"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3265"
      ]
    }
  },
  "kerala": {
    "key": "kerala",
    "name": "Kerala, India",
    "country": "India",
    "stateOrDivision": "Kerala",
    "coords": [
      76.2711,
      10.8505
    ],
    "bbox": [
      74.85,
      8.18,
      77.6,
      12.8
    ],
    "aliases": [
      "kerala",
      "kerala, india",
      "kochi",
      "thiruvananthapuram",
      "kozhikode",
      "wayanad",
      "idukki"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2442"
      ]
    }
  },
  "karnataka": {
    "key": "karnataka",
    "name": "Karnataka, India",
    "country": "India",
    "stateOrDivision": "Karnataka",
    "coords": [
      75.7139,
      15.3173
    ],
    "bbox": [
      74.05,
      11.55,
      78.6,
      18.45
    ],
    "aliases": [
      "karnataka",
      "karnataka, india",
      "bengaluru",
      "bangalore",
      "mysuru",
      "mysore",
      "bandipur"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2446"
      ]
    }
  },
  "tamilnadu": {
    "key": "tamilnadu",
    "name": "Tamil Nadu, India",
    "country": "India",
    "stateOrDivision": "Tamil Nadu",
    "coords": [
      78.6569,
      11.1271
    ],
    "bbox": [
      76.24,
      8.08,
      80.35,
      13.58
    ],
    "aliases": [
      "tamil nadu",
      "tamilnadu",
      "tamil nadu, india",
      "chennai",
      "coimbatore",
      "madurai",
      "thanjavur"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3263"
      ]
    }
  },
  "andhrapradesh": {
    "key": "andhrapradesh",
    "name": "Andhra Pradesh, India",
    "country": "India",
    "stateOrDivision": "Andhra Pradesh",
    "coords": [
      79.74,
      15.91
    ],
    "bbox": [
      76.75,
      12.6,
      84.75,
      19.15
    ],
    "aliases": [
      "andhra pradesh",
      "andhra",
      "andhra pradesh, india",
      "visakhapatnam",
      "vijayawada",
      "guntur",
      "amaravati"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2441"
      ]
    }
  },
  "telangana": {
    "key": "telangana",
    "name": "Telangana, India",
    "country": "India",
    "stateOrDivision": "Telangana",
    "coords": [
      79.0193,
      18.1124
    ],
    "bbox": [
      77.2,
      15.8,
      81.3,
      19.9
    ],
    "aliases": [
      "telangana",
      "telangana, india",
      "hyderabad",
      "warangal",
      "nizamabad"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-20011"
      ]
    }
  },
  "odisha": {
    "key": "odisha",
    "name": "Odisha, India",
    "country": "India",
    "stateOrDivision": "Odisha",
    "coords": [
      85.0985,
      20.9517
    ],
    "bbox": [
      81.4,
      17.8,
      87.5,
      22.55
    ],
    "aliases": [
      "odisha",
      "orissa",
      "odisha, india",
      "bhubaneswar",
      "cuttack",
      "similipal",
      "mayurbhanj"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2444"
      ]
    }
  },
  "jharkhand": {
    "key": "jharkhand",
    "name": "Jharkhand, India",
    "country": "India",
    "stateOrDivision": "Jharkhand",
    "coords": [
      85.2799,
      23.6102
    ],
    "bbox": [
      83.3,
      21.95,
      87.95,
      25.35
    ],
    "aliases": [
      "jharkhand",
      "jharkhand, india",
      "ranchi",
      "jamshedpur",
      "dhanbad"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3256"
      ]
    }
  },
  "chhattisgarh": {
    "key": "chhattisgarh",
    "name": "Chhattisgarh, India",
    "country": "India",
    "stateOrDivision": "Chhattisgarh",
    "coords": [
      81.8661,
      21.2787
    ],
    "bbox": [
      80.25,
      17.75,
      84.4,
      24.1
    ],
    "aliases": [
      "chhattisgarh",
      "chhattisgarh, india",
      "raipur",
      "bilaspur",
      "bastar"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3260"
      ]
    }
  },
  "assam": {
    "key": "assam",
    "name": "Assam, India",
    "country": "India",
    "stateOrDivision": "Assam",
    "coords": [
      92.9376,
      26.2006
    ],
    "bbox": [
      89.7,
      24.15,
      96.0,
      27.95
    ],
    "aliases": [
      "assam",
      "assam, india",
      "guwahati",
      "kaziranga",
      "dibrugarh",
      "silchar"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2477"
      ]
    }
  },
  "jammuandkashmir": {
    "key": "jammuandkashmir",
    "name": "Jammu and Kashmir, India",
    "country": "India",
    "stateOrDivision": "Jammu and Kashmir",
    "coords": [
      74.7973,
      34.0837
    ],
    "bbox": [
      73.25,
      32.25,
      77.5,
      35.5
    ],
    "aliases": [
      "jammu and kashmir",
      "kashmir",
      "jammu",
      "srinagar",
      "jammu & kashmir",
      "jammu and kashmir, india"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2431"
      ]
    }
  },
  "ladakh": {
    "key": "ladakh",
    "name": "Ladakh, India",
    "country": "India",
    "stateOrDivision": "Ladakh",
    "coords": [
      77.5771,
      34.1526
    ],
    "bbox": [
      75.2,
      32.5,
      80.5,
      36.0
    ],
    "aliases": [
      "ladakh",
      "leh",
      "kargil",
      "ladakh, india"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-20012"
      ]
    }
  },
  "himachalpradesh": {
    "key": "himachalpradesh",
    "name": "Himachal Pradesh, India",
    "country": "India",
    "stateOrDivision": "Himachal Pradesh",
    "coords": [
      77.1734,
      31.1048
    ],
    "bbox": [
      75.6,
      30.35,
      79.0,
      33.25
    ],
    "aliases": [
      "himachal pradesh",
      "himachal",
      "himachal pradesh, india",
      "shimla",
      "dharamshala",
      "kullu",
      "manali"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-2429"
      ]
    }
  },
  "uttarakhand": {
    "key": "uttarakhand",
    "name": "Uttarakhand, India",
    "country": "India",
    "stateOrDivision": "Uttarakhand",
    "coords": [
      79.0193,
      30.0668
    ],
    "bbox": [
      77.55,
      28.7,
      81.05,
      31.45
    ],
    "aliases": [
      "uttarakhand",
      "uttarakhand, india",
      "dehradun",
      "nainital",
      "rishikesh",
      "haridwar",
      "garhwal",
      "kumaon"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IND-3254"
      ]
    }
  },
  "afghanistan": {
    "key": "afghanistan",
    "name": "Afghanistan",
    "country": "Afghanistan",
    "coords": [
      67.7099,
      33.9391
    ],
    "bbox": [
      60.5,
      29.4,
      74.9,
      38.5
    ],
    "aliases": [
      "afghanistan",
      "kabul",
      "kandahar",
      "herat",
      "mazar-i-sharif"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "AFG"
      ]
    }
  },
  "iran": {
    "key": "iran",
    "name": "Iran",
    "country": "Iran",
    "coords": [
      53.688,
      32.4279
    ],
    "bbox": [
      44.0,
      25.0,
      63.3,
      39.8
    ],
    "aliases": [
      "iran",
      "tehran",
      "isfahan",
      "shiraz",
      "tabriz",
      "khuzestan"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IRN"
      ]
    }
  },
  "iraq": {
    "key": "iraq",
    "name": "Iraq",
    "country": "Iraq",
    "coords": [
      43.6793,
      33.2232
    ],
    "bbox": [
      38.8,
      29.0,
      48.6,
      37.4
    ],
    "aliases": [
      "iraq",
      "baghdad",
      "basra",
      "erbil",
      "mosul"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "IRQ"
      ]
    }
  },
  "saudiarabia": {
    "key": "saudiarabia",
    "name": "Saudi Arabia",
    "country": "Saudi Arabia",
    "coords": [
      45.0792,
      23.8859
    ],
    "bbox": [
      34.5,
      16.3,
      55.7,
      32.2
    ],
    "aliases": [
      "saudi arabia",
      "saudi",
      "ksa",
      "riyadh",
      "jeddah",
      "mecca",
      "medina"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "SAU"
      ]
    }
  },
  "uae": {
    "key": "uae",
    "name": "United Arab Emirates",
    "country": "United Arab Emirates",
    "coords": [
      53.8478,
      23.4241
    ],
    "bbox": [
      51.5,
      22.6,
      56.4,
      26.1
    ],
    "aliases": [
      "uae",
      "united arab emirates",
      "dubai",
      "abu dhabi",
      "sharjah"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "ARE"
      ]
    }
  },
  "turkey": {
    "key": "turkey",
    "name": "Turkey",
    "country": "Turkey",
    "coords": [
      35.2433,
      38.9637
    ],
    "bbox": [
      25.6,
      35.8,
      44.8,
      42.1
    ],
    "aliases": [
      "turkey",
      "türkiye",
      "turkiye",
      "istanbul",
      "ankara",
      "antalya",
      "izmir"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "TUR"
      ]
    }
  },
  "kazakhstan": {
    "key": "kazakhstan",
    "name": "Kazakhstan",
    "country": "Kazakhstan",
    "coords": [
      66.9237,
      48.0196
    ],
    "bbox": [
      46.5,
      40.5,
      87.3,
      55.4
    ],
    "aliases": [
      "kazakhstan",
      "astana",
      "almaty",
      "shymkent"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "KAZ"
      ]
    }
  },
  "uzbekistan": {
    "key": "uzbekistan",
    "name": "Uzbekistan",
    "country": "Uzbekistan",
    "coords": [
      64.5853,
      41.3775
    ],
    "bbox": [
      56.0,
      37.15,
      73.15,
      45.6
    ],
    "aliases": [
      "uzbekistan",
      "tashkent",
      "samarkand",
      "bukhara",
      "fergana"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "UZB"
      ]
    }
  },
  "sundarbans": {
    "key": "sundarbans",
    "name": "Sundarbans Mangrove Reserve",
    "country": "Bangladesh / India",
    "stateOrDivision": "Khulna Division / West Bengal",
    "coords": [
      89.5,
      21.9
    ],
    "bbox": [
      88.8,
      21.4,
      90.1,
      22.5
    ],
    "aliases": [
      "sundarbans",
      "sundarban",
      "shundarbans",
      "shundarban",
      "sundorbon",
      "shundorbon",
      "sundarbans mangrove",
      "sundarban national park",
      "mangrove forest"
    ],
    "unit": {
      "kind": "bd",
      "unit_id": "BD4001"
    },
    "alsoUnits": [
      "BD4047",
      "BD4087"
    ]
  },
  "beijing": {
    "key": "beijing",
    "name": "Beijing, China",
    "country": "China",
    "stateOrDivision": "North China Plain",
    "coords": [
      116.4074,
      39.9042
    ],
    "bbox": [
      115.42,
      39.44,
      117.51,
      41.06
    ],
    "aliases": [
      "beijing",
      "peking",
      "beijing municipality",
      "jing jin ji",
      "capital of china"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "CHN-1155"
      ]
    }
  },
  "shanghai": {
    "key": "shanghai",
    "name": "Shanghai, China",
    "country": "China",
    "stateOrDivision": "Yangtze River Delta",
    "coords": [
      121.4737,
      31.2304
    ],
    "bbox": [
      120.85,
      30.68,
      122.25,
      31.88
    ],
    "aliases": [
      "shanghai",
      "shanghai municipality",
      "yangtze river delta"
    ],
    "unit": {
      "kind": "ne",
      "ids": [
        "CHN-1819"
      ]
    }
  }
}

export function findRegionInQuery(rawQuery: string): RegionProfile | null {
  // Normalize punctuation and extra spaces
  const q = rawQuery.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!q) return null;
  
  const profiles = Object.values(REGION_REGISTRY);

  // 1. Direct Alias Substring Matching (Longest matching alias first)
  let bestMatch: RegionProfile | null = null;
  let maxLen = 0;

  for (const profile of profiles) {
    for (const alias of profile.aliases) {
      const normAlias = alias.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (normAlias.length > maxLen && q.includes(normAlias)) {
        bestMatch = profile;
        maxLen = normAlias.length;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // 2. Individual Word Token Matching (e.g. user types "rajstan", "beijing", "goa")
  const tokens = q.split(' ').filter(t => t.length >= 3);
  for (const t of tokens) {
    for (const profile of profiles) {
      // Check if token matches start of alias or profile key
      if (profile.key.startsWith(t) || t.startsWith(profile.key)) {
        return profile;
      }
      for (const alias of profile.aliases) {
        const normAlias = alias.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
        // Common typo toleration (e.g., 'rajstan' -> 'rajasthan')
        if (normAlias.includes(t) || (t.length >= 5 && normAlias.startsWith(t.slice(0, 4)))) {
          return profile;
        }
      }
    }
  }

  // 3. Keyword special fallbacks
  if (q.includes('jhum') || q.includes('hill tract') || q.includes('cht')) {
    return REGION_REGISTRY['bandarban'];
  }
  if (q.includes('sundarban') || q.includes('shundarban') || q.includes('sundorbon') || q.includes('shundorbon') || q.includes('mangrove')) {
    return REGION_REGISTRY['sundarbans'] || REGION_REGISTRY['bagerhat'];
  }
  if (q.includes('ncr') || q.includes('new delhi')) {
    return REGION_REGISTRY['delhi'];
  }
  if (q.includes('burma')) {
    return REGION_REGISTRY['myanmar'];
  }
  if (q.includes('bengal') && !q.includes('west bengal') && !q.includes('bay')) {
    return REGION_REGISTRY['dhaka'];
  }

  return null;
}
