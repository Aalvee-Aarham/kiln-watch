/**
 * Outside statements on the Crops page, each tied to the sentence that states it (docs/real_data_plan.md, section 6).
 * `quote` is copied verbatim from `url` as opened on `checked`; every number in `text` must appear in `quote`
 * (cropSources.test.ts). A person spot-checks them (docs/VERIFICATION.md, row RD-2). Kiln Watch's own figures are
 * computed on the page from the export, never written here.
 */
export type CropSource = {
  id: string
  kind: 'statement' | 'window'
  text: string
  months?: number[]   // window entries: calendar months 1–12
  url: string
  publisher: string
  title: string
  quote: string
  checked: string
}

const REVIEW = {
  url: 'https://doi.org/10.3390/ijerph16050832',
  publisher: 'Bhuvaneshwari, Hettiarachchi & Meegoda, Int. J. Environ. Res. Public Health 16(5):832 (2019), peer-reviewed',
  title: 'Crop Residue Burning in India: Policy Challenges and Potential Solutions',
  checked: '2026-10-13',
}
const JHUM = { url: 'https://en.banglapedia.org/index.php/Jhum', publisher: 'Banglapedia, Asiatic Society of Bangladesh', title: 'Jhum', checked: '2026-10-13' }

export const CROP_SOURCES: CropSource[] = [
  { id: 'wheat-window', kind: 'window', months: [4], text: 'In Bangladesh, the 2026 wheat crop was harvested in April.',
    url: 'https://www.fao.org/giews/countrybrief/country.jsp?code=BGD', publisher: 'FAO GIEWS', title: 'GIEWS Country Brief: Bangladesh',
    quote: 'Production of the 2026 wheat crop, harvested in April, is officially estimated at a bumper level of 1.2 million tonnes, owing to above‑average area planted and yields.', checked: '2026-10-13' },
  { id: 'sugarcane-window', kind: 'window', months: [10, 11, 12, 1, 2, 3], text: 'In Bangladesh, sugarcane is harvested from October to March.',
    url: 'https://en.banglapedia.org/index.php/Sugarcane', publisher: 'Banglapedia, Asiatic Society of Bangladesh', title: 'Sugarcane',
    quote: 'In Bangladesh the harvesting season extends from October to March.', checked: '2026-10-13' },
  { id: 'jhum-sowing', kind: 'statement', text: 'In jhum, seeds are sown after the first rain in April.', ...JHUM,
    quote: 'In jhuming, seeds are sown after the first rain in April.' },
  { id: 'jhum-fallow', kind: 'statement', text: 'Jhum fallows have been cut from the traditional ten years to two to three years.', ...JHUM,
    quote: 'But in recent times, it has been dangerously reduced from its traditional ten year fallow period to two to three years.' },
  { id: 'jhum-rotation', kind: 'statement', text: 'The usual minimum rotation of 7-8 years has fallen to 3-4 years, which is still not sustainable.', ...JHUM,
    quote: 'The widely followed 7-8 years minimum rotation cycle has now been reduced to just 3-4 years but is still not sustainable.' },
  { id: 'jhum-harm', kind: 'statement', text: 'Jhum lowers soil fertility and brings erosion, deforestation and silting of rivers and lakes.', ...JHUM,
    quote: 'Harmful results of jhum cultivation include reduction of soil fertility, erosion of land, deforestation, and siltation of rivers and lakes.' },
  { id: 'burning-season', kind: 'statement', text: 'In India, 80% of crop residue burning happens after the April–May and November–December harvests.', ...REVIEW,
    quote: 'Jitendra et al. [ 45 ], reported that 80% of the crop residue burning took place during the post-harvest period of April-May and November-December.' },
  { id: 'residue-shares', kind: 'statement', text: 'In India, rice makes up about 43% of the crop residue burned, wheat about 21% and sugarcane about 19%.', ...REVIEW,
    quote: 'Among different crop residue, major contribution was 43% of rice, followed by wheat to around 21%, sugarcane to 19% and oilseed crops around 5% [ 43 , 44 ].' },
  { id: 'soil-nutrients', kind: 'statement', text: 'Burning one tonne of straw loses all of its organic carbon, 5.5 kg of nitrogen, 2.3 kg of phosphorus, 25 kg of potassium and 1.2 kg of sulphur.', ...REVIEW,
    quote: 'According to NPMCR [ 7 ], it is reported that burning of one ton of straw accounts for the loss of entire amount of organic carbon, 5.5 kg of nitrogen, 2.3 kg of phosphorous, 25 kg of potassium and 1.2 kg of sulphur.' },
  { id: 'soil-residue-content', kind: 'statement', text: 'Crop residues hold about 80% of the nitrogen, 25% of the phosphorus, 50% of the sulphur and 20% of the potassium.', ...REVIEW,
    quote: 'On an average crop residue of different crops contain approximately 80% of nitrogen (N), 25% of phosphorus (P), 50% of sulphur (S) and 20% of potassium (K).' },
  { id: 'soil-heat', kind: 'statement', text: 'Burning heats the soil to about 33.8–42.2 °C at 10 mm depth and depletes its bacteria and fungi; long-term effects reach 15 cm down.', ...REVIEW,
    quote: 'Heat from burning of residues raises the soil temperature and causes depletion of the bacterial and fungal population. The residue burning increases the subsoil temperatures to nearly 33.8–42.2 °C at 10 mm depth [ 48 ], and long-term effects can even reach up to 15 cm of the top soil.' },
  { id: 'soil-microflora', kind: 'statement', text: 'Frequent burning lowers the soil’s nitrogen and carbon and kills the microflora and fauna that benefit it.', ...REVIEW,
    quote: 'Frequent burning reduces nitrogen and carbon potential of the soil and kills the microflora and fauna beneficial to the soil, and further removes the large portion of the organic matter.' },
  { id: 'smoke-pollutants', kind: 'statement', text: 'Residue burning raises CO₂, CO, NH₃, NOₓ, SOₓ, non-methane hydrocarbons, volatile organic compounds and particulate matter in the air.', ...REVIEW,
    quote: 'Crop residue burning significantly increases the quantity of air pollutants such as CO 2 , CO, NH 3 , NO X , SO X , Non-methane hydrocarbon (NMHC), volatile organic compounds (VOCs), semi volatile organic compounds (SVOCs) and PM [ 46 , 47 ].' },
  { id: 'smoke-hazard', kind: 'statement', text: 'The particulate matter and smog from residue burning are a health hazard.', ...REVIEW,
    quote: 'The main adverse effects of crop residue burning include the emission of greenhouse gases (GHGs) that contributes to the global warming, increased levels of particulate matter (PM) and smog that cause health hazards, loss of biodiversity of agricultural lands, and the deterioration of soil fertility [ 22 ].' },
  { id: 'pm25-body', kind: 'statement', text: 'Fine particles (PM2.5) from stubble smoke can enter the respiratory and cardiovascular systems.',
    url: 'https://doi.org/10.1038/s41598-025-21235-8', publisher: 'Scientific Reports (2025), peer-reviewed', title: 'Perceptions of air pollution from stubble burning and its health risks in Punjab, India',
    quote: 'The PM 2.5 with aerodynamic diameter of 2.5 μm can enter the human respiratory and cardiovascular systems.', checked: '2026-10-13' },
  { id: 'haryana-survey', kind: 'statement', text: 'In a rural Haryana survey, around 70% of participants named respiratory illness as the worst effect of the air pollution.',
    url: 'https://doi.org/10.4103/ijcm.ijcm_820_22', publisher: 'Indian Journal of Community Medicine (2024), peer-reviewed', title: 'Perception and Practices Regarding Stubble Burning in Rural Community of Haryana',
    quote: 'Around 70% of the participants mentioned that respiratory illness is the most severe effect of air pollution.', checked: '2026-10-13' },
  { id: 'happy-seeder', kind: 'statement', text: 'Zero-tillage drills such as the Turbo Happy Seeder sow wheat straight into the rice stubble right after the rice harvest.',
    url: 'https://doi.org/10.4103/ijcm.ijcm_820_22', publisher: 'Indian Journal of Community Medicine (2024), peer-reviewed', title: 'Perception and Practices Regarding Stubble Burning in Rural Community of Haryana',
    quote: 'Furthermore, the enhanced version of zero tillage drills with the Turbo Happy Seeder may sow wheat seed directly in the standing and lost rice stubbles immediately after rice harvesting.', checked: '2026-10-13' },
  { id: 'in-situ', kind: 'statement', text: 'India’s crop residue policy promotes mixing residue into the soil and mulching instead of burning.', ...REVIEW,
    quote: 'The National Policy for Management of Crop Residue [ 7 ] specifically mentions in-situ management through methods such as direct incorporation into soils and mulching as methods that should be promoted in India not only to control crop residue burning but also to prevent environmental degradation in the croplands.' },
  { id: 'satellite-monitoring', kind: 'statement', text: 'The same policy calls for satellite remote sensing to monitor how crop residue is managed.', ...REVIEW,
    quote: '(3) Use satellite-based remote sensing technologies to monitor crop residue management with the National Remote Sensing Agency (NRSA) and Central Pollution Control Board (CPCB).' },
  { id: 'firms-min-fire', kind: 'statement', text: 'MODIS routinely detects flaming and smouldering fires of 1000 m².',
    url: 'https://www.earthdata.nasa.gov/faq/firms-faq', publisher: 'NASA FIRMS', title: 'FIRMS Frequently Asked Questions: What size fires can be detected?',
    quote: 'MODIS routinely detects both flaming and smoldering fires 1000 m 2 in size. Under very good observing conditions (e.g., near nadir, little or no smoke, relatively homogeneous land surface, etc.) flaming fires one tenth this size can be detected.', checked: '2026-10-13' },
  { id: 'terra', kind: 'statement', text: 'Terra MODIS: launched December 18,1999; crosses the equator at 10:30 a.m., descending.',
    url: 'https://terra.nasa.gov/about', publisher: 'NASA', title: 'About Terra',
    quote: 'Launch Date: December 18,1999 … Equatorial crossing: 10:30 a.m., descending mode', checked: '2026-10-13' },
  { id: 'aqua', kind: 'statement', text: 'Aqua MODIS crosses the equator in the afternoon and is now drifting to later crossing times.',
    url: 'https://science.nasa.gov/mission/aqua/', publisher: 'NASA', title: 'Aqua',
    quote: 'Aqua was formerly named EOS PM, signifying its afternoon equatorial crossing time. … slowly descending below the A-Train and drifting to later equatorial crossing times, and lower altitudes.', checked: '2026-10-13' },
]

export const source = (id: string): CropSource => {
  const s = CROP_SOURCES.find((x) => x.id === id)
  if (!s) throw new Error(`unknown source ${id}`)
  return s
}
