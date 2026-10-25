/**
 * Outside statements on the farmers' page (#/crops), each tied to the sentence that states it (docs/real_data_plan.md,
 * section 6). `text` is our plain wording for farmers; `quote` is copied verbatim from `url` as opened on `checked`, and
 * every number in `text` must appear in `quote` (cropSources.test.ts). A person spot-checks them (docs/VERIFICATION.md,
 * row RD-2). Kiln Watch's own figures are computed on the page from the export, never written here.
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
const RESIDUE = { url: 'https://en.banglapedia.org/index.php?title=Crop_Residue', publisher: 'Banglapedia, Asiatic Society of Bangladesh', title: 'Crop Residue', checked: '2026-10-25' }

export const CROP_SOURCES: CropSource[] = [
  { id: 'wheat-window', kind: 'window', months: [4], text: 'In Bangladesh, the 2026 wheat crop was harvested in April.',
    url: 'https://www.fao.org/giews/countrybrief/country.jsp?code=BGD', publisher: 'FAO GIEWS', title: 'GIEWS Country Brief: Bangladesh',
    quote: 'Production of the 2026 wheat crop, harvested in April, is officially estimated at a bumper level of 1.2 million tonnes, owing to above‑average area planted and yields.', checked: '2026-10-13' },
  { id: 'sugarcane-window', kind: 'window', months: [10, 11, 12, 1, 2, 3], text: 'In Bangladesh, sugarcane is harvested from October to March.',
    url: 'https://en.banglapedia.org/index.php/Sugarcane', publisher: 'Banglapedia, Asiatic Society of Bangladesh', title: 'Sugarcane',
    quote: 'In Bangladesh the harvesting season extends from October to March.', checked: '2026-10-13' },
  { id: 'jhum-sowing', kind: 'statement', text: 'In jhum, seeds are sown after the first rain in April.', ...JHUM,
    quote: 'In jhuming, seeds are sown after the first rain in April.' },
  { id: 'jhum-fallow', kind: 'statement', text: 'Land used to rest for ten years between jhum crops. Now it often rests only two to three years.', ...JHUM,
    quote: 'But in recent times, it has been dangerously reduced from its traditional ten year fallow period to two to three years.' },
  { id: 'jhum-harm', kind: 'statement', text: 'Jhum makes the soil poorer. The land washes away, forests are lost, and rivers and lakes fill with mud.', ...JHUM,
    quote: 'Harmful results of jhum cultivation include reduction of soil fertility, erosion of land, deforestation, and siltation of rivers and lakes.' },
  { id: 'straw-feed', kind: 'statement', text: 'Straw can feed cattle, make bedding for animals, or be sold for industry.', ...RESIDUE,
    quote: 'Since straw has alternative uses such as cattle feed, litter and industrial processes.' },
  { id: 'straw-mulch', kind: 'statement', text: 'Straw spread on the field stops soil washing or blowing away, holds water, smothers weeds and helps plants grow.', ...RESIDUE,
    quote: 'A surface mulch of straw reduces soil detachment by water or wind, improves soil structure, increases the infiltration of water, reduces wind erosion, equalises soil temperature, smothers weeds, reduces evaporation, encourages earthworms and increases plant growth.' },
  { id: 'straw-soil-life', kind: 'statement', text: 'When straw rots into the soil, earthworms and other useful life in the soil increase.', ...RESIDUE,
    quote: 'bacteria, earthworms and other desirable life in the soil increase when crop residues turn into soil.' },
  { id: 'soil-nutrients', kind: 'statement', text: 'Burning one tonne of straw loses all of its organic carbon, 5.5 kg of nitrogen, 2.3 kg of phosphorus, 25 kg of potassium and 1.2 kg of sulphur.', ...REVIEW,
    quote: 'According to NPMCR [ 7 ], it is reported that burning of one ton of straw accounts for the loss of entire amount of organic carbon, 5.5 kg of nitrogen, 2.3 kg of phosphorous, 25 kg of potassium and 1.2 kg of sulphur.' },
  { id: 'soil-microflora', kind: 'statement', text: 'Burning again and again takes plant food out of the soil and kills the small living things that keep it healthy.', ...REVIEW,
    quote: 'Frequent burning reduces nitrogen and carbon potential of the soil and kills the microflora and fauna beneficial to the soil, and further removes the large portion of the organic matter.' },
  { id: 'pm25-body', kind: 'statement', text: 'The tiny bits of dust in straw smoke can get deep into your lungs and heart.',
    url: 'https://doi.org/10.1038/s41598-025-21235-8', publisher: 'Scientific Reports (2025), peer-reviewed', title: 'Perceptions of air pollution from stubble burning and its health risks in Punjab, India',
    quote: 'The PM 2.5 with aerodynamic diameter of 2.5 μm can enter the human respiratory and cardiovascular systems.', checked: '2026-10-13' },
  { id: 'happy-seeder', kind: 'statement', text: 'A no-till seed drill (such as the Happy Seeder) sows wheat straight into the rice stubble, right after the rice harvest.',
    url: 'https://doi.org/10.4103/ijcm.ijcm_820_22', publisher: 'Indian Journal of Community Medicine (2024), peer-reviewed', title: 'Perception and Practices Regarding Stubble Burning in Rural Community of Haryana',
    quote: 'Furthermore, the enhanced version of zero tillage drills with the Turbo Happy Seeder may sow wheat seed directly in the standing and lost rice stubbles immediately after rice harvesting.', checked: '2026-10-13' },
  { id: 'krishi-call', kind: 'statement', text: 'The government Krishi Call Centre, 16123, gives farmers expert advice on crops, pests and diseases, fertiliser and weather.',
    url: 'https://www.bssnews.net/special-stories/401845', publisher: 'BSS (Bangladesh Sangbad Sangstha)', title: 'Farmers’ trust in ‘Agriculture Call Centre’ grows, calls top 92,000 annually',
    quote: 'The call centre, operating under the short code 16123, received a total of 92,094 calls between July 2025 and June 2026, providing farmers with instant expert advice on crop cultivation, pest and disease management, fertiliser application, weather-related issues and modern farming technologies. … Operated under the Department of Agricultural Extension (DAE), the service is particularly beneficial for rural farmers, providing immediate technical support and helping them make informed decisions in crop management.', checked: '2026-10-25' },
  { id: 'firms-min-fire', kind: 'statement', text: 'MODIS routinely detects flaming and smouldering fires of 1000 m².',
    url: 'https://www.earthdata.nasa.gov/faq/firms-faq', publisher: 'NASA FIRMS', title: 'FIRMS Frequently Asked Questions: What size fires can be detected?',
    quote: 'MODIS routinely detects both flaming and smoldering fires 1000 m 2 in size. Under very good observing conditions (e.g., near nadir, little or no smoke, relatively homogeneous land surface, etc.) flaming fires one tenth this size can be detected.', checked: '2026-10-13' },
]

export const source = (id: string): CropSource => {
  const s = CROP_SOURCES.find((x) => x.id === id)
  if (!s) throw new Error(`unknown source ${id}`)
  return s
}
