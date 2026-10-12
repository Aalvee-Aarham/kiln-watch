// Auto-generated comprehensive geospatial registry
// Covers all 64 districts of Bangladesh, Indian states, Southeast Asian nations, and key Asian territories.

export type HistoricalNews = {
  year: number
  title: string
  source: string
  date: string
  summary: string
  severity: 'high' | 'medium' | 'info'
}

export type RegionProfile = {
  key: string
  name: string
  country: string
  stateOrDivision?: string
  coords: [number, number]
  bbox: [number, number, number, number]
  defaultMultiplier: number
  criticalWeeks: string
  criticalSpan: [number, number]
  months: string[]
  normalCurve: number[]
  thisSeasonCurve: number[]
  aliases: string[]
  news: HistoricalNews[]
  contextNote: string
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "dhaka",
      "ঢাকা",
      "dhaka"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Dhaka District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Dhaka.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "rajshahi",
      "রাজশাহী",
      "rajshahi"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Rajshahi District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Rajshahi.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "khulna",
      "খুলনা",
      "khulna"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Khulna District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Khulna.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "barguna",
      "বরগুনা",
      "barguna"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Barguna District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Barguna.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "barishal",
      "বরিশাল",
      "barishal"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Barishal District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Barishal.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "bhola",
      "ভোলা",
      "bhola"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Bhola District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Bhola.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "jhalokati",
      "ঝালকাঠি",
      "jhalokati"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Jhalokati District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Jhalokati.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "patuakhali",
      "পটুয়াখালী",
      "patuakhali"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Patuakhali District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Patuakhali.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "pirojpur",
      "পিরোজপুর",
      "pirojpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Pirojpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Pirojpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 2.4,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (JHUM BURNING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB (EARLY)",
      "FEB (LATE)",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      25,
      60,
      140,
      380,
      820,
      1250,
      780,
      110
    ],
    "thisSeasonCurve": [
      30,
      80,
      190,
      680,
      1750,
      2980,
      1420,
      150
    ],
    "aliases": [
      "bandarban",
      "বান্দরবান",
      "bandarban"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Shifting Cultivation (Jhum) Slashing & Burning on Hill Slopes",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Widespread traditional jhum clearing on steep terrain in Bandarban, Rangamati, and Khagrachhari registered thermal anomalies on MODIS Aqua and VIIRS NOAA-20.",
        "severity": "high"
      }
    ],
    "contextNote": "Shifting cultivation (Jhum) on hill slopes involves clearing vegetative regrowth followed by controlled burns before pre-monsoon rains."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "brahmanbaria",
      "ব্রাহ্মণবাড়িয়া",
      "brahmanbaria"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Brahmanbaria District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Brahmanbaria.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "chandpur",
      "চাঁদপুর",
      "chandpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Chandpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Chandpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
  },
  "chattogram": {
    "key": "chattogram",
    "name": "Chittagong Hill Tracts, Bangladesh",
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
    "defaultMultiplier": 2.4,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (JHUM BURNING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB (EARLY)",
      "FEB (LATE)",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      25,
      60,
      140,
      380,
      820,
      1250,
      780,
      110
    ],
    "thisSeasonCurve": [
      30,
      80,
      190,
      680,
      1750,
      2980,
      1420,
      150
    ],
    "aliases": [
      "chattogram",
      "চট্টগ্রাম",
      "chattogram",
      "chittagong",
      "chittagong hill tracts",
      "cht",
      "jhum"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Shifting Cultivation (Jhum) Slashing & Burning on Hill Slopes",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Widespread traditional jhum clearing on steep terrain in Bandarban, Rangamati, and Khagrachhari registered thermal anomalies on MODIS Aqua and VIIRS NOAA-20.",
        "severity": "high"
      }
    ],
    "contextNote": "Shifting cultivation (Jhum) on hill slopes involves clearing vegetative regrowth followed by controlled burns before pre-monsoon rains."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "cumilla",
      "কুমিল্লা",
      "cumilla"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Cumilla District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Cumilla.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "cox's bazar",
      "কক্সবাজার",
      "coxsbazar"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Cox's Bazar District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Cox's Bazar.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "feni",
      "ফেনী",
      "feni"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Feni District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Feni.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 2.4,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (JHUM BURNING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB (EARLY)",
      "FEB (LATE)",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      25,
      60,
      140,
      380,
      820,
      1250,
      780,
      110
    ],
    "thisSeasonCurve": [
      30,
      80,
      190,
      680,
      1750,
      2980,
      1420,
      150
    ],
    "aliases": [
      "khagrachhari",
      "খাগড়াছড়ি",
      "khagrachhari"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Shifting Cultivation (Jhum) Slashing & Burning on Hill Slopes",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Widespread traditional jhum clearing on steep terrain in Bandarban, Rangamati, and Khagrachhari registered thermal anomalies on MODIS Aqua and VIIRS NOAA-20.",
        "severity": "high"
      }
    ],
    "contextNote": "Shifting cultivation (Jhum) on hill slopes involves clearing vegetative regrowth followed by controlled burns before pre-monsoon rains."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "lakshmipur",
      "লক্ষ্মীপুর",
      "lakshmipur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Lakshmipur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Lakshmipur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "noakhali",
      "নোয়াখালী",
      "noakhali"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Noakhali District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Noakhali.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 2.4,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (JHUM BURNING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB (EARLY)",
      "FEB (LATE)",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      25,
      60,
      140,
      380,
      820,
      1250,
      780,
      110
    ],
    "thisSeasonCurve": [
      30,
      80,
      190,
      680,
      1750,
      2980,
      1420,
      150
    ],
    "aliases": [
      "rangamati",
      "রাঙ্গামাটি",
      "rangamati"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Shifting Cultivation (Jhum) Slashing & Burning on Hill Slopes",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Widespread traditional jhum clearing on steep terrain in Bandarban, Rangamati, and Khagrachhari registered thermal anomalies on MODIS Aqua and VIIRS NOAA-20.",
        "severity": "high"
      }
    ],
    "contextNote": "Shifting cultivation (Jhum) on hill slopes involves clearing vegetative regrowth followed by controlled burns before pre-monsoon rains."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "faridpur",
      "ফরিদপুর",
      "faridpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Faridpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Faridpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "gazipur",
      "গাজীপুর",
      "gazipur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Gazipur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Gazipur.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "gopalganj",
      "গোপালগঞ্জ",
      "gopalganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Gopalganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Gopalganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "kishoreganj",
      "কিশোরগঞ্জ",
      "kishoreganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Kishoreganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Kishoreganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "madaripur",
      "মাদারীপুর",
      "madaripur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Madaripur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Madaripur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "manikganj",
      "মানিকগঞ্জ",
      "manikganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Manikganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Manikganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "munshiganj",
      "মুন্সিগঞ্জ",
      "munshiganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Munshiganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Munshiganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "narayanganj",
      "নারায়ণগঞ্জ",
      "narayanganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Narayanganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Narayanganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "narsingdi",
      "নরসিংদী",
      "narsingdi"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Narsingdi District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Narsingdi.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "rajbari",
      "রাজবাড়ী",
      "rajbari"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Rajbari District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Rajbari.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "shariatpur",
      "শরীয়তপুর",
      "shariatpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Shariatpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Shariatpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "tangail",
      "টাঙ্গাইল",
      "tangail"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Tangail District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Tangail.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: MARCH (BORO HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN"
    ],
    "normalCurve": [
      8,
      18,
      42,
      95,
      140,
      85,
      25,
      5
    ],
    "thisSeasonCurve": [
      9,
      20,
      45,
      105,
      155,
      90,
      28,
      6
    ],
    "aliases": [
      "bagerhat",
      "বাগেরহাট",
      "bagerhat"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Bagerhat District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Bagerhat.",
        "severity": "medium"
      }
    ],
    "contextNote": "Haor wetlands and high groundwater retain moisture into spring, keeping fire counts low outside elevated agricultural boundaries."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "chuadanga",
      "চুয়াডাঙ্গা",
      "chuadanga"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Chuadanga District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Chuadanga.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "jashore",
      "যশোর",
      "jashore"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Jashore District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Jashore.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "jhenaidah",
      "ঝিনাইদহ",
      "jhenaidah"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Jhenaidah District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Jhenaidah.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "kushtia",
      "কুষ্টিয়া",
      "kushtia"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Kushtia District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Kushtia.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "magura",
      "মাগুরা",
      "magura"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Magura District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Magura.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "meherpur",
      "মেহেরপুর",
      "meherpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Meherpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Meherpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "narail",
      "নড়াইল",
      "narail"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Narail District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Narail.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: MARCH (BORO HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN"
    ],
    "normalCurve": [
      8,
      18,
      42,
      95,
      140,
      85,
      25,
      5
    ],
    "thisSeasonCurve": [
      9,
      20,
      45,
      105,
      155,
      90,
      28,
      6
    ],
    "aliases": [
      "satkhira",
      "সাতক্ষীরা",
      "satkhira"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Satkhira District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Satkhira.",
        "severity": "medium"
      }
    ],
    "contextNote": "Haor wetlands and high groundwater retain moisture into spring, keeping fire counts low outside elevated agricultural boundaries."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "jamalpur",
      "জামালপুর",
      "jamalpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Jamalpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Jamalpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "mymensingh",
      "ময়মনসিংহ",
      "mymensingh"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Mymensingh District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Mymensingh.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "netrakona",
      "নেত্রকোণা",
      "netrakona"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Netrakona District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Netrakona.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "sherpur",
      "শেরপুর",
      "sherpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Sherpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Sherpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – FEB (PEAK KILN OPERATIONS)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      30,
      80,
      220,
      550,
      680,
      390,
      140,
      45
    ],
    "thisSeasonCurve": [
      36,
      110,
      310,
      890,
      1120,
      480,
      160,
      50
    ],
    "aliases": [
      "bogura",
      "বগুড়া",
      "bogura"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Bogura District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Bogura.",
        "severity": "medium"
      }
    ],
    "contextNote": "High concentration of licensed and unpermitted brick kilns elevates atmospheric aerosol loading during dry north-westerly winter winds."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "joypurhat",
      "জয়পুরহাট",
      "joypurhat"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Joypurhat District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Joypurhat.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "naogaon",
      "নওগাঁ",
      "naogaon"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Naogaon District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Naogaon.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "natore",
      "নাটোর",
      "natore"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Natore District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Natore.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "chapainababganj",
      "চাঁপাইনবাবগঞ্জ",
      "chapainababganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Chapainababganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Chapainababganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "pabna",
      "পাবনা",
      "pabna"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Pabna District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Pabna.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "sirajganj",
      "সিরাজগঞ্জ",
      "sirajganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Sirajganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Sirajganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "dinajpur",
      "দিনাজপুর",
      "dinajpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Dinajpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Dinajpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "gaibandha",
      "গাইবান্ধা",
      "gaibandha"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Gaibandha District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Gaibandha.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "kurigram",
      "কুড়িগ্রাম",
      "kurigram"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Kurigram District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Kurigram.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "lalmonirhat",
      "লালমনিরহাট",
      "lalmonirhat"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Lalmonirhat District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Lalmonirhat.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "nilphamari",
      "নীলফামারী",
      "nilphamari"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Nilphamari District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Nilphamari.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "panchagarh",
      "পঞ্চগড়",
      "panchagarh"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Panchagarh District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Panchagarh.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "rangpur",
      "রংপুর",
      "rangpur"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Rangpur District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Rangpur.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE NOV – DEC (POST-AMAN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY"
    ],
    "normalCurve": [
      15,
      45,
      160,
      320,
      240,
      110,
      65,
      25
    ],
    "thisSeasonCurve": [
      18,
      60,
      260,
      510,
      370,
      140,
      80,
      30
    ],
    "aliases": [
      "thakurgaon",
      "ঠাকুরগাঁও",
      "thakurgaon"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Thakurgaon District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Thakurgaon.",
        "severity": "medium"
      }
    ],
    "contextNote": "Agricultural multi-cropping drives concentrated field clearance episodes between crop rotations."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: MARCH (BORO HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN"
    ],
    "normalCurve": [
      8,
      18,
      42,
      95,
      140,
      85,
      25,
      5
    ],
    "thisSeasonCurve": [
      9,
      20,
      45,
      105,
      155,
      90,
      28,
      6
    ],
    "aliases": [
      "habiganj",
      "হবিগঞ্জ",
      "habiganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Habiganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Habiganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Haor wetlands and high groundwater retain moisture into spring, keeping fire counts low outside elevated agricultural boundaries."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: MARCH (BORO HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN"
    ],
    "normalCurve": [
      8,
      18,
      42,
      95,
      140,
      85,
      25,
      5
    ],
    "thisSeasonCurve": [
      9,
      20,
      45,
      105,
      155,
      90,
      28,
      6
    ],
    "aliases": [
      "moulvibazar",
      "মৌলভীবাজার",
      "moulvibazar"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Moulvibazar District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Moulvibazar.",
        "severity": "medium"
      }
    ],
    "contextNote": "Haor wetlands and high groundwater retain moisture into spring, keeping fire counts low outside elevated agricultural boundaries."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: MARCH (BORO HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN"
    ],
    "normalCurve": [
      8,
      18,
      42,
      95,
      140,
      85,
      25,
      5
    ],
    "thisSeasonCurve": [
      9,
      20,
      45,
      105,
      155,
      90,
      28,
      6
    ],
    "aliases": [
      "sunamganj",
      "সুনামগঞ্জ",
      "sunamganj"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Sunamganj District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Sunamganj.",
        "severity": "medium"
      }
    ],
    "contextNote": "Haor wetlands and high groundwater retain moisture into spring, keeping fire counts low outside elevated agricultural boundaries."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: MARCH (BORO HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN"
    ],
    "normalCurve": [
      8,
      18,
      42,
      95,
      140,
      85,
      25,
      5
    ],
    "thisSeasonCurve": [
      9,
      20,
      45,
      105,
      155,
      90,
      28,
      6
    ],
    "aliases": [
      "sylhet",
      "সিলেট",
      "sylhet"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Winter Season",
        "title": "Satellite FIRMS Monitoring in Sylhet District",
        "source": "Department of Environment & NASA FIRMS",
        "summary": "Harmonized MODIS and VIIRS satellite tracks monitored agricultural and brick kiln thermal emissions across Sylhet.",
        "severity": "medium"
      }
    ],
    "contextNote": "Haor wetlands and high groundwater retain moisture into spring, keeping fire counts low outside elevated agricultural boundaries."
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
    "defaultMultiplier": 2.1,
    "criticalWeeks": "CRITICAL WEEKS: LATE OCT – MID NOV",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1785,
      1042,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "punjab",
      "punjab, india",
      "punjab",
      "punjab"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Punjab, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Punjab, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Post-monsoon rice-wheat crop rotation creates an ultra-compressed 2-3 week window where farmers clear paddy residue before sowing wheat."
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
    "defaultMultiplier": 1.6,
    "criticalWeeks": "CRITICAL WEEKS: MID OCT – EARLY NOV",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1360,
      794,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "haryana",
      "haryana, india",
      "haryana",
      "haryana"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Haryana, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Haryana, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Haryana farmers transition rapidly between Basmati harvest and Rabi winter sowing."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: LATE OCT – NOV",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1275,
      744,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "delhi",
      "delhi ncr, india",
      "delhi ncr",
      "delhincr"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Delhi NCR, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Delhi NCR, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Trapped transboundary smoke plumes during meteorological inversion elevate surface particulate readings."
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
    "defaultMultiplier": 1.6,
    "criticalWeeks": "CRITICAL WEEKS: NOV (PADDY) & MAY (WHEAT)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1360,
      794,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "uttarpradesh",
      "uttar pradesh, india",
      "uttar pradesh",
      "uttarpradesh"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Uttar Pradesh, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Uttar Pradesh, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Dual-peak agricultural fires occur in late autumn after rice and in late spring after wheat harvest."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: NOV – DEC & APR – MAY",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1275,
      744,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "bihar",
      "bihar, india",
      "bihar",
      "bihar"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Bihar, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Bihar, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Gangetic alluvial farmlands clear stubble for boro and rabi sowing."
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
    "defaultMultiplier": 1.4,
    "criticalWeeks": "CRITICAL WEEKS: DEC – JAN (RICE HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1190,
      694,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "westbengal",
      "west bengal, india",
      "west bengal",
      "westbengal"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in West Bengal, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across West Bengal, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Winter rice straw clearing and peripheral brick kiln clusters along the Hooghly corridor."
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
    "defaultMultiplier": 1.3,
    "criticalWeeks": "CRITICAL WEEKS: OCT – NOV & APR – MAY",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1105,
      645,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "rajasthan",
      "rajasthan, india",
      "rajasthan",
      "rajasthan"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Rajasthan, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Rajasthan, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Canal-irrigated zones in northern Rajasthan practice wheat and mustard stubble clearing."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: NOV (SOYBEAN) & APR (WHEAT)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1275,
      744,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "madhyapradesh",
      "madhya pradesh, india",
      "madhya pradesh",
      "madhyapradesh"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Madhya Pradesh, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Madhya Pradesh, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Soybean residue clearing followed by extensive central Indian wheat harvest fires."
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
    "defaultMultiplier": 1.2,
    "criticalWeeks": "CRITICAL WEEKS: NOV – DEC (COTTON/GROUNDNUT)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1020,
      595,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "gujarat",
      "gujarat, india",
      "gujarat",
      "gujarat"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Gujarat, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Gujarat, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Agricultural residue clearance after cotton and groundnut harvest."
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
    "defaultMultiplier": 1.4,
    "criticalWeeks": "CRITICAL WEEKS: DEC – FEB (SUGARCANE TRASH)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "SEP",
      "OCT",
      "NOV",
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR"
    ],
    "normalCurve": [
      80,
      240,
      850,
      620,
      280,
      130,
      70,
      30
    ],
    "thisSeasonCurve": [
      95,
      310,
      1190,
      694,
      320,
      140,
      75,
      32
    ],
    "aliases": [
      "maharashtra",
      "maharashtra, india",
      "maharashtra",
      "maharashtra"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Autumn Cycle",
        "title": "NASA FIRMS Hotspots in Maharashtra, India",
        "source": "NASA Applied Sciences / Central Pollution Control Board",
        "summary": "Coordinated satellite observations captured agricultural burning patterns across Maharashtra, India.",
        "severity": "high"
      }
    ],
    "contextNote": "Sugarcane harvesting belts in western Maharashtra burn field trash prior to ratoon crop cycle."
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
    "defaultMultiplier": 1.9,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (DRY SEASON CLEARING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      532,
      1292,
      840,
      230,
      85,
      28
    ],
    "aliases": [
      "myanmar",
      "myanmar (burma)",
      "myanmar"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Myanmar (Burma)",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Myanmar (Burma).",
        "severity": "high"
      }
    ],
    "contextNote": "Intense dry-season agricultural burning and shifting cultivation occur across Shan hills, Sagaing, and Bago."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: JAN – MARCH (SUGARCANE & PADDY)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      476,
      1156,
      751,
      230,
      85,
      28
    ],
    "aliases": [
      "thailand",
      "thailand",
      "thailand"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Thailand",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Thailand.",
        "severity": "high"
      }
    ],
    "contextNote": "Northern highland forest clearance and central plain sugarcane trash burning generate seasonal transboundary haze."
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (RICE DELTA CLEARING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      420,
      1020,
      663,
      230,
      85,
      28
    ],
    "aliases": [
      "vietnam",
      "vietnam",
      "vietnam"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Vietnam",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Vietnam.",
        "severity": "high"
      }
    ],
    "contextNote": "Intense seasonal straw burning episodes in the Mekong and Red River deltas following winter-spring harvests."
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
    "defaultMultiplier": 2,
    "criticalWeeks": "CRITICAL WEEKS: FEB – APRIL (UPLAND SLASH & BURN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      560,
      1360,
      884,
      230,
      85,
      28
    ],
    "aliases": [
      "laos",
      "laos",
      "laos"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Laos",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Laos.",
        "severity": "high"
      }
    ],
    "contextNote": "Widespread mountainous slash-and-burn operations for upland rice prepare fields before monsoon arrival."
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
    "defaultMultiplier": 1.6,
    "criticalWeeks": "CRITICAL WEEKS: JAN – MARCH (TONLE SAP PLAIN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      448,
      1088,
      707,
      230,
      85,
      28
    ],
    "aliases": [
      "cambodia",
      "cambodia",
      "cambodia"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Cambodia",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Cambodia.",
        "severity": "high"
      }
    ],
    "contextNote": "Dry season recession rice stubble clearance around the Tonle Sap lake floodplain."
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
    "defaultMultiplier": 2.3,
    "criticalWeeks": "CRITICAL WEEKS: AUG – OCT (PEATLAND BURNING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      644,
      1564,
      1017,
      230,
      85,
      28
    ],
    "aliases": [
      "indonesia",
      "indonesia",
      "indonesia"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Indonesia",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Indonesia.",
        "severity": "high"
      }
    ],
    "contextNote": "El Niño-amplified dry seasons induce deep peatland smoldering fires across Sumatra and Central Kalimantan."
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
    "defaultMultiplier": 1.4,
    "criticalWeeks": "CRITICAL WEEKS: JUL – SEP (PLANTATION CLEARING)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      392,
      952,
      619,
      230,
      85,
      28
    ],
    "aliases": [
      "malaysia",
      "malaysia",
      "malaysia"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Malaysia",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Malaysia.",
        "severity": "high"
      }
    ],
    "contextNote": "Occasional agricultural residue burning and exposure to regional cross-strait transboundary smoke."
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
    "defaultMultiplier": 1.3,
    "criticalWeeks": "CRITICAL WEEKS: MAR – MAY (DRY HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      364,
      884,
      575,
      230,
      85,
      28
    ],
    "aliases": [
      "philippines",
      "philippines",
      "philippines"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Philippines",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Philippines.",
        "severity": "high"
      }
    ],
    "contextNote": "Post-harvest rice straw and sugarcane burning in Central Luzon and Western Visayas."
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
    "defaultMultiplier": 1.7,
    "criticalWeeks": "CRITICAL WEEKS: OCT – NOV (INDUS BASIN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      476,
      1156,
      751,
      230,
      85,
      28
    ],
    "aliases": [
      "pakistan",
      "pakistan",
      "pakistan"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Pakistan",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Pakistan.",
        "severity": "high"
      }
    ],
    "contextNote": "Intense post-paddy burning across Pakistan Punjab and Sindh drives heavy Lahore smog episodes."
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
    "defaultMultiplier": 1.4,
    "criticalWeeks": "CRITICAL WEEKS: MAR – MAY (TERAI AGRI-FIRES)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      392,
      952,
      619,
      230,
      85,
      28
    ],
    "aliases": [
      "nepal",
      "nepal",
      "nepal"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Nepal",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Nepal.",
        "severity": "high"
      }
    ],
    "contextNote": "Southern Terai agricultural plains clear wheat residue, with pre-monsoon forest edge burns."
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
    "defaultMultiplier": 1.1,
    "criticalWeeks": "CRITICAL WEEKS: FEB – MAR (DRY VALLEY SEASON)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      308,
      748,
      486,
      230,
      85,
      28
    ],
    "aliases": [
      "bhutan",
      "bhutan",
      "bhutan"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Bhutan",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Bhutan.",
        "severity": "high"
      }
    ],
    "contextNote": "Protected forest policies maintain minimal fire footprint outside dry valley agricultural borders."
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
    "defaultMultiplier": 1.2,
    "criticalWeeks": "CRITICAL WEEKS: AUG – SEP (YALA HARVEST)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      336,
      816,
      530,
      230,
      85,
      28
    ],
    "aliases": [
      "srilanka",
      "sri lanka",
      "sri lanka"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: Sri Lanka",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of Sri Lanka.",
        "severity": "high"
      }
    ],
    "contextNote": "Chena shifting cultivation and dry zone paddy stubble burning following the Yala harvest."
  },
  "china": {
    "key": "china",
    "name": "China",
    "country": "China",
    "stateOrDivision": "China",
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
    "defaultMultiplier": 1.5,
    "criticalWeeks": "CRITICAL WEEKS: JUNE (SUMMER) & OCT (AUTUMN)",
    "criticalSpan": [
      3,
      5
    ],
    "months": [
      "DEC",
      "JAN",
      "FEB",
      "MAR",
      "APR",
      "MAY",
      "JUN",
      "JUL"
    ],
    "normalCurve": [
      40,
      90,
      280,
      680,
      520,
      210,
      80,
      25
    ],
    "thisSeasonCurve": [
      45,
      110,
      420,
      1020,
      663,
      230,
      85,
      28
    ],
    "aliases": [
      "china",
      "china",
      "china"
    ],
    "news": [
      {
        "year": 2023,
        "date": "Regional Assessment",
        "title": "NASA FIRMS Regional Fire Report: China",
        "source": "NASA Earth Observatory / ASEAN Haze Center",
        "summary": "VIIRS and MODIS fire detection statistics recorded across agrarian and forest boundaries of China.",
        "severity": "high"
      }
    ],
    "contextNote": "North China Plain and northeastern provinces enforce mechanized straw baling during harvest peaks."
  }
};

export function findRegionInQuery(rawQuery: string): RegionProfile | null {
  const q = rawQuery.toLowerCase().trim();
  
  // Sort candidates by longest matching alias first
  const profiles = Object.values(REGION_REGISTRY);
  let bestMatch: RegionProfile | null = null;
  let maxLen = 0;

  for (const profile of profiles) {
    for (const alias of profile.aliases) {
      if (alias.length > maxLen && q.includes(alias)) {
        bestMatch = profile;
        maxLen = alias.length;
      }
    }
  }

  if (bestMatch) return bestMatch;

  // Keyword special fallbacks
  if (q.includes('jhum') || q.includes('hill tract') || q.includes('cht')) {
    return REGION_REGISTRY['chattogram'] || REGION_REGISTRY['bandarban'];
  }
  if (q.includes('sundarban') || q.includes('mangrove')) {
    return REGION_REGISTRY['bagerhat'] || REGION_REGISTRY['satkhira'];
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
