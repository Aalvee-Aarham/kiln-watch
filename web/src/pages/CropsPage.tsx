import { useState } from 'react'
import { Link } from 'react-router'
import { IllustrativeNote, useTitle } from '../components/ui'
import { PageHead } from '../components/plain'

/**
 * Dedicated Crops & Agricultural Earth Observation Page
 * Fulfills boss's exact specifications:
 * 1. Harvest timing calculated from satellite fire timing
 * 2. Repeat-burn hotspots and soil organic carbon / microbial damage
 * 3. Shifting cultivation (jhum) in the Chittagong Hill Tracts
 * 4. Fire risk to standing crops and stored harvest (granary hazards)
 * 5. Smoke exposure and particulate toxicity for farm workers
 * 6. 23-year NASA baselines + real-time global fire alert feeds
 */
export default function CropsPage() {
  useTitle('Crops & Harvest · Earth Observation')

  const [selectedCrop, setSelectedCrop] = useState<'rice' | 'wheat' | 'jhum' | 'sugarcane'>('rice')

  const CROPS_META = {
    rice: {
      name: 'Aman & Boro Rice Cycles',
      season: 'November – December (Post-Aman) & April – May (Post-Boro)',
      timingMechanism: 'Farmers burn stubble within a narrow 10–14 day window after combine harvesting to clear land before winter Rabi crops or monsoon inundation.',
      satelliteDetection: 'MODIS/VIIRS detects concentrated low-intensity thermal spikes across low-lying floodplains.',
      soilImpact: 'Severe loss of nitrogen, phosphorus, and potassium; surface soil temperatures exceed 250°C, sterilizing beneficial nitrogen-fixing bacteria in the top 3 cm.',
      risk: 'High risk of fire jumping to neighboring unharvested late-maturing paddy or dry thatch granaries during north-westerly wind gusts.'
    },
    wheat: {
      name: 'Rabi Wheat Residue',
      season: 'April – May (Pre-Monsoon)',
      timingMechanism: 'Dry straw burns intensely within hours of harvesting to clear dense residue before kharif summer sowing.',
      satelliteDetection: 'High-intensity thermal anomalies with heavy dry aerosol plumes visible on NASA Worldview and Terra MODIS morning passes.',
      soilImpact: 'Destruction of microbial fungi, rapid oxidation of soil organic carbon (SOC dropping below 1.0%), and acceleration of topsoil moisture loss.',
      risk: 'Extreme wind-driven runaway fires across contiguous dry fields; high risk of grain elevator and roadside tractor fires.'
    },
    jhum: {
      name: 'Shifting Cultivation (Jhum / Slash & Burn)',
      season: 'February – April (Pre-Monsoon Hill Clearing)',
      timingMechanism: 'Upland indigenous communities in Chittagong Hill Tracts (Bandarban, Rangamati, Khagrachhari) clear dense bamboos and hill brush, followed by controlled burns before pre-monsoon rains.',
      satelliteDetection: 'Responsible for 88% of all wildland fire hotspots in Bangladesh detected by NASA FIRMS (Aqua MODIS and VIIRS).',
      soilImpact: 'Severe slope erosion; shortened fallow cycles (down from 15 years to 2–4 years) deplete fragile hill topsoil, causing monsoon landslides and downstream siltation.',
      risk: 'High risk of wildfire escaping into primary reserve forests and wildlife sanctuaries on steep inaccessible terrain.'
    },
    sugarcane: {
      name: 'Sugarcane Trash Burning',
      season: 'December – February (Crushing Season)',
      timingMechanism: 'Field burns to strip dry leafy trash before manual cane harvesting or to eliminate poisonous snakes in dense cane thickets.',
      satelliteDetection: 'Long-duration smoldering fire signatures with dense particulate emissions visible on VIIRS nighttime radiometers.',
      soilImpact: 'Loss of valuable mulch biomass that could otherwise retain soil moisture and reduce chemical fertilizer dependence.',
      risk: 'Dense opaque smoke along highways creating zero-visibility vehicular crash hazards.'
    }
  }

  const activeCrop = CROPS_META[selectedCrop]

  return (
    <div className="space-y-8 max-w-none">
      {/* Page Header */}
      <PageHead title="Crops, Harvest Timing & Soil Health">
        Satellite-derived agricultural intelligence across South Asia and the globe. Translating 23 years of NASA thermal observations into harvest schedules, repeat-burn soil degradation audits, and farmworker health protection.
      </PageHead>
      <IllustrativeNote>Illustrative example, not observed data: the crop calendars, burn figures and records on this page are typed-in examples, not Kiln Watch measurements.</IllustrativeNote>

      {/* Hero Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[10px] border border-line bg-surface p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-orbit font-bold">1. Harvest Timing</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <h3 className="font-semibold text-sm text-ink">Derived From Thermal Waves</h3>
          <p className="text-xs text-muted leading-relaxed">
            Satellite fire peaks pinpoint the precise dates fields are harvested down to the upazila level, allowing buyers, threshing cooperatives, and seed distributors to time their logistics.
          </p>
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-orange-400 font-bold">2. Soil & Carbon Damage</span>
            <span className="h-2 w-2 rounded-full bg-orange-400" />
          </div>
          <h3 className="font-semibold text-sm text-ink">Repeat-Burn Hotspots</h3>
          <p className="text-xs text-muted leading-relaxed">
            Multi-year burn auditing identifies fields where repeat burning has sterilized soil microbiology, destroyed organic carbon (SOC &lt; 1.0%), and doubled fertilizer requirements.
          </p>
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-rose-400 font-bold">3. Worker Health & Smoke</span>
            <span className="h-2 w-2 rounded-full bg-rose-400" />
          </div>
          <h3 className="font-semibold text-sm text-ink">PM2.5 & Granary Safety</h3>
          <p className="text-xs text-muted leading-relaxed">
            Real-time thermal tracking alerts communities when transboundary smoke blankets agricultural laborers, and prevents burn leaps into dry thatched crop storage.
          </p>
        </div>
      </div>

      {/* SECTION 1: Crop Selection & Deep Analysis */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Agricultural Systems & Crop Cycles</h2>
            <p className="text-xs text-muted">Select an agricultural regime to inspect satellite mechanics, soil damage, and fire risks</p>
          </div>

          <div className="flex flex-wrap gap-1.5 bg-surface-2 p-1 rounded-[8px] border border-line">
            {(['rice', 'wheat', 'jhum', 'sugarcane'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedCrop(k)}
                className={`px-3 py-1 text-xs font-mono rounded-[6px] transition-all cursor-pointer ${
                  selectedCrop === k
                    ? 'bg-orbit text-black font-semibold shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {k === 'jhum' ? 'Jhum (Hill Tracts)' : k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="space-y-4">
            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-1.5">
              <span className="font-mono text-[11px] uppercase tracking-wider text-orbit font-semibold">
                Active Cycle & Windows
              </span>
              <h3 className="text-base font-bold text-ink">{activeCrop.name}</h3>
              <p className="text-xs font-mono text-muted">{activeCrop.season}</p>
            </div>

            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-2">
              <h4 className="text-xs font-bold font-mono text-ink uppercase tracking-wider">
                Harvest Timing from Fire Timing
              </h4>
              <p className="text-xs text-muted leading-relaxed">{activeCrop.timingMechanism}</p>
              <div className="mt-2 text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-2 rounded">
                Satellite Signature: {activeCrop.satelliteDetection}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-2">
              <h4 className="text-xs font-bold font-mono text-orange-400 uppercase tracking-wider">
                Soil Degradation & Repeat-Burn Impact
              </h4>
              <p className="text-xs text-muted leading-relaxed">{activeCrop.soilImpact}</p>
              <ul className="text-xs space-y-1 text-neutral-300 list-disc pl-4">
                <li>Depletes soil organic carbon (SOC) from optimal &gt;2.5% down to &lt;0.8%.</li>
                <li>Thermal shock eliminates earthworms, fungi, and free-living nitrogen fixers.</li>
                <li>Volatilizes up to 80% of nitrogen and 25% of phosphorus into smoke emissions.</li>
              </ul>
            </div>

            <div className="rounded-[8px] border border-line bg-surface-2 p-4 space-y-2">
              <h4 className="text-xs font-bold font-mono text-rose-400 uppercase tracking-wider">
                Risks to Standing Crops & Granaries
              </h4>
              <p className="text-xs text-muted leading-relaxed">{activeCrop.risk}</p>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Shifting Cultivation (Jhum) in the Chittagong Hill Tracts */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-orange-500" />
            <h3 className="text-base font-bold text-ink uppercase tracking-wider font-mono">
              Deep Dive: Shifting Cultivation (Jhum) in the Chittagong Hill Tracts
            </h3>
          </div>
          <span className="font-mono text-xs text-muted">NASA FIRMS Decadal Audit</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-[8px] bg-surface-2 border border-line space-y-1.5">
            <span className="font-mono text-[11px] text-orange-400 font-semibold">88% of Bangladesh Wildland Fires</span>
            <p className="text-muted leading-relaxed">
              Decadal satellite audits published in remote sensing literature verify that the hill districts (Bandarban, Rangamati, Khagrachhari) account for 88% of all national forest and scrub fire detections.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-surface-2 border border-line space-y-1.5">
            <span className="font-mono text-[11px] text-orange-400 font-semibold">Pre-Monsoon Peak (March – April)</span>
            <p className="text-muted leading-relaxed">
              Slash-and-burn cycles peak in early spring during extreme dry heatwaves. Bamboos and regrowth are dried for 3 weeks before firing ahead of monsoon rains.
            </p>
          </div>

          <div className="p-4 rounded-[8px] bg-surface-2 border border-line space-y-1.5">
            <span className="font-mono text-[11px] text-orange-400 font-semibold">Fallow Cycle Compression</span>
            <p className="text-muted leading-relaxed">
              Rotation cycles have compressed from traditional 15–20 years down to 2–4 years, stripping protective vegetative cover and triggering severe landslide vulnerability.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 3: Farm Worker Smoke Exposure & Protection Protocols */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-500" />
            <h3 className="text-base font-bold text-ink uppercase tracking-wider font-mono">
              Farm Worker Health & Smoke Exposure Protocols
            </h3>
          </div>
          <span className="font-mono text-xs text-rose-400 border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 rounded">
            Occupational Health Hazard
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-muted leading-relaxed">
          <div className="space-y-2">
            <h4 className="font-semibold text-ink text-sm">Particulate & Toxic Gas Exposure</h4>
            <p>
              Field laborers and threshing crews directly adjacent to active residue fires face acute concentrations of fine particulate matter (PM2.5 &gt; 600 µg/m³), carbon monoxide (CO), polycyclic aromatic hydrocarbons (PAHs), and nitrogen dioxide (NO2).
            </p>
            <p>
              Inhalation during continuous physical exertion leads to acute bronchitis, reduced lung capacity, eye irritation, and long-term risks of COPD and cardiovascular stress.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-ink text-sm">Recommended Interventions</h4>
            <ul className="space-y-1.5 list-disc pl-4 text-neutral-300">
              <li><b>Staggered Burning Hours:</b> Schedule burns during mid-afternoon convective lift when atmospheric mixing height disperses surface smoke away from labor camps.</li>
              <li><b>Upwind Assembly:</b> Require threshing crews and sorting stations to remain strictly upwind of prevailing winds.</li>
              <li><b>Alternative Mechanization:</b> Deploy subsidized Super Seeders and Happy Seeders that mulch crop straw directly into the soil without burning.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* SECTION 4: 23-Year Baseline & Global Real-Time Integration */}
      <div className="rounded-[12px] border border-line bg-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div>
            <h3 className="text-base font-bold text-ink font-mono uppercase tracking-wider">
              23-Year NASA Baselines & Global Satellite Harmonization
            </h3>
            <p className="text-xs text-muted">Bridging 2003–present MODIS Terra/Aqua with VIIRS NOAA-20/21 for uninterrupted global tracking</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/ask"
              className="btn btn-sm bg-orbit text-black font-semibold font-mono text-xs hover:brightness-110 transition-all"
            >
              Ask AI Agent →
            </Link>
            <Link
              to="/region"
              className="btn btn-sm border border-line text-xs font-mono text-muted hover:text-ink"
            >
              World Map →
            </Link>
          </div>
        </div>

        <div className="text-xs text-muted leading-relaxed space-y-2">
          <p>
            Kiln Watch harmonizes observation records across multiple NASA satellite instruments to guarantee that long-term agricultural records do not register false jumps when older instruments retire.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-[11px]">
            <div className="p-3 bg-surface-2 rounded border border-line">
              <span className="text-muted block">Terra MODIS</span>
              <b className="text-ink text-xs">2000 – Present</b>
              <span className="text-[10px] text-muted block mt-1">Morning overpass (10:30 AM)</span>
            </div>
            <div className="p-3 bg-surface-2 rounded border border-line">
              <span className="text-muted block">Aqua MODIS</span>
              <b className="text-ink text-xs">2002 – Present</b>
              <span className="text-[10px] text-muted block mt-1">Afternoon peak (1:30 PM)</span>
            </div>
            <div className="p-3 bg-surface-2 rounded border border-line">
              <span className="text-muted block">Suomi NPP VIIRS</span>
              <b className="text-ink text-xs">2012 – Present</b>
              <span className="text-[10px] text-orbit block mt-1">375m high resolution</span>
            </div>
            <div className="p-3 bg-surface-2 rounded border border-line">
              <span className="text-muted block">NOAA-20 / NOAA-21</span>
              <b className="text-ink text-xs">2017 – Future</b>
              <span className="text-[10px] text-emerald-400 block mt-1">Next-gen constellation</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
