import { useSearchParams } from 'react-router'
import type { Lang } from './url'

// UI chrome only. Long-form Story/Method prose is English, with a visible note under ?lang=bn.
const S = {
  story: ['Story', 'গল্প'], explore: ['Explore', 'অন্বেষণ'], kilns: ['Kiln seasons', 'ভাটা মৌসুম'], season: ['This season', 'এই মৌসুম'],
  evidence: ['Evidence', 'প্রমাণ'], method: ['Method', 'পদ্ধতি'],
  pick: ['Find a district or upazila', 'জেলা বা উপজেলা খুঁজুন'], harm: ['Harmonized', 'সমন্বিত'], raw: ['Raw', 'অপরিশোধিত'],
  cal: ['Calendar year', 'পঞ্জিকা বছর'], seasonLayout: ['Season year (Jul–Jun)', 'মৌসুম বছর (জুলাই–জুন)'],
  all: ['All sources', 'সব উৎস'], download: ['Download', 'ডাউনলোড'], provisional: ['Provisional', 'অস্থায়ী'],
  unit: ['MYD-eq cell-days per 1,000 clear cells', 'প্রতি ১,০০০ মেঘমুক্ত ঘরে MYD-সমতুল্য ঘর-দিন'],
  skip: ['Skip to content', 'মূল অংশে যান'], themeDay: ['Switch to day theme', 'দিনের থিমে যান'], themeNight: ['Switch to night theme', 'রাতের থিমে যান'],
  district: ['District', 'জেলা'], upazila: ['Upazila', 'উপজেলা'], level: ['Area level', 'এলাকার স্তর'],
  draw: ['Draw an area', 'এলাকা আঁকুন'], drawing: ['Drag to draw · min 100 km² · Esc cancels', 'টেনে আঁকুন · কমপক্ষে ১০০ বর্গকিমি · Esc বাতিল'],
  coords: ['Enter coordinates', 'স্থানাঙ্ক লিখুন'], apply: ['Open this area', 'এই এলাকা খুলুন'],
  startWith: ['Start with an area', 'একটি এলাকা দিয়ে শুরু করুন'], aboveNow: ['Running above normal this season', 'এই মৌসুমে স্বাভাবিকের চেয়ে বেশি'],
  recent: ['Recently viewed', 'সম্প্রতি দেখা'], noMatch: ['No area by that name. Try the Bangla name, or draw an area.', 'এই নামে কোনো এলাকা নেই। বাংলা নাম লিখুন বা এলাকা আঁকুন।'],
  calendar: ['Calendar', 'পঞ্জিকা'], vsNormal: ['Season vs normal', 'মৌসুম বনাম স্বাভাবিক'], sources: ['Sources', 'উৎস'], data: ['Data', 'তথ্য'],
  everyDay: ['Every day since 2003', '২০০৩ থেকে প্রতিদিন'], whereHeat: ['Where the heat comes from', 'তাপ কোথা থেকে আসে'],
  metrics: ['Season metrics (95% intervals)', 'মৌসুমের পরিমাপ (৯৫% ব্যবধান)'], viewTable: ['View as table', 'সারণি হিসেবে দেখুন'],
  patterns: ['Patterns', 'নকশা'], pass: ['Pass', 'উত্তীর্ণ'], fail: ['Fail', 'অনুত্তীর্ণ'], replay: ['Replay', 'আবার দেখুন'],
  openDistrict: ['Open your district', 'আপনার জেলা খুলুন'], seeSeason: ['See this season', 'এই মৌসুম দেখুন'],
  mapNote: ['Use search to pick an area by keyboard.', 'কিবোর্ডে এলাকা বাছতে খোঁজ ব্যবহার করুন।'],
  englishOnly: ['', 'এই অংশটি এখনো ইংরেজিতে।'], ctrlZoom: ['Hold Ctrl to zoom the map', 'মানচিত্র বড় করতে Ctrl চেপে রাখুন'],
  daysAbove: ['days above normal this season', 'এই মৌসুমে স্বাভাবিকের চেয়ে বেশি দিন'], showMap: ['Map', 'মানচিত্র'],
  seasonShort: ['Season', 'মৌসুম'], kilnsShort: ['Kilns', 'ভাটা'],
  area: ['My area', 'আমার এলাকা'], areaShort: ['Area', 'এলাকা'], region: ['World map', 'বিশ্ব মানচিত্র'], regionShort: ['World', 'বিশ্ব'], planner: ['Kiln planner (extension)', 'ভাটা (সংযোজন)'],
  ask: ['AI agent', 'এআই এজেন্ট'], askShort: ['Ask', 'এআই'],
  sensors: ['Sensor switch', 'সেন্সর বদল'], sensorsShort: ['Sensors', 'সেন্সর'], timeline: ['Timeline', 'সময়রেখা'], timelineShort: ['Events', 'ঘটনা'],
  impact: ['Who benefits', 'কারা উপকৃত'], impactShort: ['Uses', 'ব্যবহার'], experts: ['For experts', 'বিশেষজ্ঞদের জন্য'], expertsShort: ['Experts', 'বিশেষজ্ঞ'],
  how: ['How it works', 'কীভাবে কাজ করে'], howShort: ['How', 'কীভাবে'], trust: ['Can you trust it?', 'বিশ্বাস করা যায়?'], trustShort: ['Trust', 'আস্থা'],
  ctrlScroll: ['Hold Ctrl and scroll to zoom.', 'জুম করতে Ctrl চেপে স্ক্রল করুন।'],
  bangladesh: ['Bangladesh', 'বাংলাদেশ'], division: ['division', 'বিভাগ'], yourArea: ['Your area', 'আপনার এলাকা'],
  mappedKilns: ['mapped kilns (APAD inventory)', 'তালিকাভুক্ত ভাটা (APAD)'],
  twoSeasons: ['Fires and kilns', 'আগুন ও ভাটা'], twoSeasonsTitle: ['Two burning seasons: fires and kilns', 'দুই পোড়ানোর মৌসুম: আগুন ও ভাটা'],
  normalRange: ['Normal range (middle 80%)', 'স্বাভাবিক পরিসর (মাঝের ৮০%)'], median: ['Median', 'মধ্যমা'], mean7: ['7-day mean', '৭ দিনের গড়'],
  unusualDay: ['Unusual day (above p90)', 'অস্বাভাবিক দিন (p90-এর উপরে)'], critical: ['critical', 'সংকটকাল'], today: ['today', 'আজ'],
  notObserved: ['Not observed (cloud)', 'দেখা যায়নি (মেঘ)'], cloud: ['Cloud', 'মেঘ'], low: ['Low', 'কম'], high: ['High', 'বেশি'],
  clickSeason: ['Click to open this season', 'ক্লিক করে এই মৌসুম খুলুন'], perClear: ['MYD-eq per 1,000 clear cells', 'প্রতি ১,০০০ মেঘমুক্ত ঘরে MYD-eq'],
  kilnTypical: ['Kilns: typical season', 'ভাটা: সাধারণ মৌসুম'], middleHalf: ['Middle half of seasons', 'মৌসুমগুলোর মাঝের অর্ধেক'],
  firesAvg: ['Fires: average season', 'আগুন: গড় মৌসুম'], lowerPanel: ['lower panel', 'নিচের প্যানেল'],
  kilnExcess: ['Kiln excess', 'ভাটার বাড়তি সংকেত'], fireActivity: ['Fire activity (MYD-eq)', 'আগুনের মাত্রা (MYD-eq)'], seasonSum: ['Season sum (MYD-eq)', 'মৌসুমের মোট (MYD-eq)'],
  harvest: ['harvest', 'ধান কাটা'], aman: ['Aman', 'আমন'], boro: ['Boro', 'বোরো'],
  colSeason: ['Season', 'মৌসুম'], colMid: ['Midpoint (day)', 'মধ্যবিন্দু (দিন)'], colDur: ['Duration (days)', 'স্থায়িত্ব (দিন)'], colPeak: ['Peak', 'শীর্ষ'],
  colFirst: ['First*', 'প্রথম*'], colLast: ['Last*', 'শেষ*'],
  dlCsv: ['spreadsheet', 'স্প্রেডশিট'], dlJson: ['full data', 'পূর্ণ তথ্য'], dlPng: ['chart image', 'চার্টের ছবি'],
  demoReal: ['Real satellite data: offline copy of the real pipeline build (the live site refreshes daily)', 'প্রকৃত স্যাটেলাইট তথ্য: প্রকৃত পাইপলাইন বিল্ডের অফলাইন অনুলিপি (লাইভ সাইট প্রতিদিন হালনাগাদ হয়)'],
  demoSynthetic: ['Demo mode: synthetic data, not real satellite observations. The live site serves real data.', 'ডেমো মোড: কৃত্রিম তথ্য, প্রকৃত স্যাটেলাইট পর্যবেক্ষণ নয়। লাইভ সাইটে প্রকৃত তথ্য রয়েছে।'],
  // News page (docs/news_plan.md §7). {x} placeholders are filled by tr(); numbers arrive already in the UI language's digits.
  news: ['News', 'খবর'],
  newsTitle: ['Fire in the news, beside the satellite record', 'খবরে আগুন, পাশে স্যাটেলাইটের রেকর্ড'],
  newsIntro: ['Newspaper stories about open burning, brick kilns, enforcement and smoke in Bangladesh. Beside each story: what satellites saw around that date, how common fire is in that place, and earlier news about fires there.',
    'বাংলাদেশে খোলা জায়গায় পোড়ানো, ইটভাটা, অভিযান ও ধোঁয়া নিয়ে সংবাদপত্রের খবর। প্রতিটি খবরের পাশে: সেই তারিখের আশপাশে স্যাটেলাইট কী দেখেছে, ওই এলাকায় আগুন কতটা সাধারণ, আর সেখানে আগুন নিয়ে আগের খবর।'],
  newsLabel: ['Collected by AI from newspapers. Not reviewed by a person. Satellite figures and verdicts come from Kiln Watch’s own data, not from the article.',
    'সংবাদপত্র থেকে এআই দিয়ে সংগ্রহ করা। কোনো মানুষ পর্যালোচনা করেননি। স্যাটেলাইটের সংখ্যা ও মূল্যায়ন কিলন ওয়াচের নিজস্ব তথ্য থেকে, খবর থেকে নয়।'],
  newsMissing: ['No news has been published for this data build.', 'এই ডেটা বিল্ডে কোনো খবর প্রকাশিত হয়নি।'],
  newsLoading: ['Loading news…', 'খবর আসছে…'],
  newsSeasonMissing: ['The stories for this season could not be loaded. Reload to try again.', 'এই মৌসুমের খবর আনা যায়নি। আবার চেষ্টা করতে পাতাটি নতুন করে খুলুন।'],
  unknownDistrict: ['No district has the code {id}. Showing all districts.', 'কোনো জেলার কোড {id} নয়। সব জেলা দেখানো হচ্ছে।'],
  newsFilters: ['Filter stories', 'খবর বাছুন'], allDistricts: ['All districts', 'সব জেলা'], nationalStories: ['Bangladesh (national stories)', 'বাংলাদেশ (জাতীয় খবর)'],
  newsKind: ['Kind of story', 'খবরের ধরন'], allKinds: ['All kinds', 'সব ধরন'], allSeasons: ['All seasons', 'সব মৌসুম'],
  kind_burning: ['Open burning', 'খোলা জায়গায় পোড়ানো'], kind_enforcement: ['Enforcement', 'অভিযান'],
  kind_kilns_operating: ['Kilns operating', 'ভাটা চালু'], kind_air_health: ['Smoke and air quality', 'ধোঁয়া ও বায়ুর মান'],
  newsCount: ['{n} stories', '{n}টি খবর'], newsCountOne: ['1 story', '১টি খবর'],
  noMatches: ['No stories match these filters.', 'এই বাছাইয়ে কোনো খবর নেই।'],
  pickDistrictAll: ['Pick a district to list its stories from every season, or open one season:', 'সব মৌসুমের খবর দেখতে একটি জেলা বাছুন, অথবা একটি মৌসুম খুলুন:'],
  allSeasonsList: ['Every story about {name}, newest first. Open a season to see each story beside its satellite record.', '{name} নিয়ে সব খবর, নতুনগুলো আগে। প্রতিটি খবরের পাশে স্যাটেলাইট রেকর্ড দেখতে একটি মৌসুম খুলুন।'],
  openSeason: ['Open {season}', '{season} খুলুন'],
  paperSays: ['What the paper says', 'পত্রিকা যা বলছে'], satSaw: ['What satellites saw', 'স্যাটেলাইট যা দেখেছে'],
  howCommon: ['How common is fire here?', 'এখানে আগুন কতটা সাধারণ?'], recordSince: ['Kiln Watch satellite record since {from}', '{from} থেকে কিলন ওয়াচের স্যাটেলাইট রেকর্ড'],
  recordAll: ['Kiln Watch satellite record', 'কিলন ওয়াচের স্যাটেলাইট রেকর্ড'],
  seasonSoFar: ['This season so far', 'এই মৌসুমে এ পর্যন্ত'], summary: ['Summary', 'সারসংক্ষেপ'], verdict: ['Verdict', 'মূল্যায়ন'],
  earlierNews: ['Earlier news about fires here ({n})', 'এখানে আগুন নিয়ে আগের খবর ({n})'],
  earlierNote: ['Newspapers don’t report every fire. The satellite record above is the full count.', 'সংবাদপত্র সব আগুনের খবর দেয় না। উপরের স্যাটেলাইট রেকর্ডই পূর্ণ হিসাব।'],
  earlierNone: ['No earlier stories about this district in our collection.', 'আমাদের সংগ্রহে এই জেলা নিয়ে আগের কোনো খবর নেই।'],
  earlierCoverage: ['{n} stories about {name} collected since {from}.', '{from} থেকে {name} নিয়ে {n}টি খবর সংগ্রহ করা হয়েছে।'],
  earlierCoverageOne: ['1 story about {name} collected since {from}.', '{from} থেকে {name} নিয়ে ১টি খবর সংগ্রহ করা হয়েছে।'],
  seeAll: ['See all', 'সব দেখুন'], areaLink: ['{name}’s burning season', '{name}-এর পোড়ানোর মৌসুম'],
  alsoReported: ['Also reported by', 'আরও যারা খবর দিয়েছে'], alsoMentions: ['also mentions {names}', 'আরও উল্লেখ: {names}'],
  newTab: ['opens the news site in a new tab', 'নতুন ট্যাবে সংবাদ সাইট খুলবে'],
  eventOn: ['event on {date}', 'ঘটনার তারিখ {date}'],
  // News map (#/news/map) and one story (#/news/story/…)
  newsViews: ['News views', 'খবর দেখার ধরন'], newsMapTab: ['Map', 'মানচিত্র'], newsListTab: ['All stories', 'সব খবর'],
  newsMapTitle: ['Fire news on the map', 'মানচিত্রে আগুনের খবর'],
  newsMapIntro: ['Recent newspaper stories beside the fire satellites see now. Pick a story to see where it happened.',
    'সাম্প্রতিক সংবাদপত্রের খবর, পাশে স্যাটেলাইট এখন যে আগুন দেখছে। কোথায় ঘটেছে দেখতে একটি খবর বাছুন।'],
  recentNews: ['Recent news', 'সাম্প্রতিক খবর'], viewMore: ['View more', 'আরও দেখুন'], closeCard: ['Close', 'বন্ধ করুন'],
  mapColour: ['Map colour', 'মানচিত্রের রং'], fireRecent: ['Fire, last {n} days', 'আগুন, গত {n} দিন'], fireUnusual: ['Unusual days this season', 'এই মৌসুমে অস্বাভাবিক দিন'],
  fireLess: ['less', 'কম'], fireMore: ['more', 'বেশি'],
  fireRange: ['{range}, provisional', '{range}, অস্থায়ী'],
  newsPinKey: ['News stories (number = stories)', 'খবর (সংখ্যা = খবরের সংখ্যা)'],
  noLiveFire: ['No live fire data in this build; the map shows districts only.', 'এই বিল্ডে চলতি আগুনের তথ্য নেই; মানচিত্রে শুধু জেলা দেখানো হচ্ছে।'],
  noStoriesHere: ['No stories about {name} in {season}.', '{season}-এ {name} নিয়ে কোনো খবর নেই।'],
  nationalOnMap: ['A Bangladesh-wide story: no single district on the map.', 'সারা দেশের খবর: মানচিত্রে নির্দিষ্ট কোনো জেলা নেই।'],
  unusualSoFar: ['{n} unusual burning {days} since 1 July', '১ জুলাই থেকে {n} দিন অস্বাভাবিক পোড়ানো'],
  backToMap: ['Back to the news map', 'খবরের মানচিত্রে ফিরুন'],
  storyMissing: ['This story is not in our collection. It may have been removed in a later data build.', 'এই খবরটি আমাদের সংগ্রহে নেই। পরের কোনো ডেটা বিল্ডে হয়তো সরানো হয়েছে।'],
  day: ['day', 'দিন'], days: ['days', 'দিন'],
  winDays: ['{range}: {n} unusual burning {days}', '{range}: {n} দিন অস্বাভাবিক পোড়ানো'],
  winNone: ['{range}: no unusual burning days', '{range}: অস্বাভাবিক পোড়ানোর কোনো দিন নেই'],
  notObs: ['{n} {days} not observed (cloud)', '{n} দিন দেখা যায়নি (মেঘ)'],
  cantTellOf: ['{range}: satellites couldn’t see the ground on {k} of {n} days (cloud), so we can’t tell', '{range}: {n} দিনের মধ্যে {k} দিন মেঘের কারণে স্যাটেলাইট মাটি দেখতে পায়নি, তাই বলা যাচ্ছে না'],
  cantTell: ['{range}: satellites couldn’t see the ground, so we can’t tell', '{range}: স্যাটেলাইট মাটি দেখতে পায়নি, তাই বলা যাচ্ছে না'],
  provisionalNote: ['provisional; cloud cover not checked', 'অস্থায়ী; মেঘ যাচাই করা হয়নি'],
  winNational: ['{range}: {n} of {total} districts had at least one unusual burning day', '{range}: {total}টি জেলার মধ্যে {n}টিতে অন্তত এক দিন অস্বাভাবিক পোড়ানো'],
  winBefore: ['{n} days before', 'আগের {n} দিন'], winAfter: ['{n} days after', 'পরের {n} দিন'], afterPending: ['not complete yet', 'এখনো পূর্ণ হয়নি'],
  kilnInside: ['The story date falls in the months kilns here usually work ({months}).', 'খবরের তারিখটি সেই মাসগুলোর মধ্যে পড়ে, যখন এখানে ভাটা সাধারণত চলে ({months})।'],
  kilnOutside: ['The story date falls outside the months kilns here usually work ({months}).', 'খবরের তারিখটি সেই মাসগুলোর বাইরে, যখন এখানে ভাটা সাধারণত চলে ({months})।'],
  kilnNone: ['We have no estimate of when kilns work here, so we can’t tell.', 'এখানে ভাটা কখন চলে তার কোনো হিসাব আমাদের নেই, তাই বলা যাচ্ছে না।'],
  kilnLimit: ['Kiln months come from NASA night lights: daily fire data can’t separate kiln heat from crop burning.', 'ভাটার মাস নাসার রাতের আলো থেকে নেওয়া: দৈনিক আগুনের তথ্য ভাটার তাপ আর ফসল পোড়ানো আলাদা করতে পারে না।'],
  burnInside: ['The story date falls inside the usual burning months here ({months}).', 'খবরের তারিখটি এখানকার স্বাভাবিক পোড়ানোর মাসগুলোর মধ্যে পড়ে ({months})।'],
  burnOutside: ['The story date falls outside the usual burning months here ({months}).', 'খবরের তারিখটি এখানকার স্বাভাবিক পোড়ানোর মাসগুলোর বাইরে ({months})।'],
  burnNone: ['We have no estimate of the usual burning months here.', 'এখানকার স্বাভাবিক পোড়ানোর মাসের কোনো হিসাব আমাদের নেই।'],
  outlookLine: ['Two-week outlook: {pct}% chance of at least one unusual day.', 'দুই সপ্তাহের পূর্বাভাস: অন্তত এক দিন অস্বাভাবিক হওয়ার সম্ভাবনা {pct}%।'],
  soFarDays: ['{n} unusual {days} from {from} to {to}', '{from} থেকে {to} পর্যন্ত {n} দিন অস্বাভাবিক'],
  soFarCantTell: ['From {from} to {to}: satellites couldn’t see the ground often enough to tell', '{from} থেকে {to}: মেঘের কারণে স্যাটেলাইট যথেষ্ট দেখতে পায়নি, তাই বলা যাচ্ছে না'],
  soFarNational: ['{n} of {total} districts had at least one unusual day from {from} to {to}', '{from} থেকে {to} পর্যন্ত {total}টি জেলার মধ্যে {n}টিতে অন্তত এক দিন অস্বাভাবিক'],
  typicalRuns: ['Burning here usually runs {months}, busiest in {busiest}.', 'এখানে পোড়ানো সাধারণত চলে {months}, সবচেয়ে বেশি {busiest} মাসে।'],
  typicalNone: ['Satellites have recorded very little burning here.', 'স্যাটেলাইট এখানে খুব কম পোড়ানো দেখেছে।'],
  recordLine: ['A burning season was recorded in {n} of {total} seasons', '{total}টি মৌসুমের মধ্যে {n}টিতে পোড়ানোর মৌসুম দেখা গেছে'],
  recordLasts: ['; it usually lasts about {d} days', '; সাধারণত প্রায় {d} দিন চলে'],
  verdict_common_now: ['Common. Burning at this time of year is normal for {name}.', 'সাধারণ। বছরের এই সময়ে {name}-এ পোড়ানো স্বাভাবিক।'],
  verdict_outside_season: ['Less common. Burning here usually runs {first}–{last}; this story falls outside that.', 'কম সাধারণ। এখানে পোড়ানো সাধারণত চলে {first}–{last}; এই খবর তার বাইরে।'],
  verdict_rare: ['Rare. Satellites recorded a burning season here in only {n} of {total} seasons.', 'বিরল। স্যাটেলাইট এখানে {total}টি মৌসুমের মধ্যে মাত্র {n}টিতে পোড়ানোর মৌসুম দেখেছে।'],
  verdictOutsideNoMonths: ['Less common. This story falls outside the usual burning months here.', 'কম সাধারণ। এই খবর এখানকার স্বাভাবিক পোড়ানোর মাসগুলোর বাইরে।'],
  unusualWord: ['unusual day', 'অস্বাভাবিক দিন'],
  verdictNote: ['A verdict about our satellite data, never about the story.', 'এটি আমাদের স্যাটেলাইট তথ্যের মূল্যায়ন, খবরের নয়।'],
  sourcesTitle: ['Sources and coverage', 'উৎস ও পরিধি'],
  sourcesIntro: ['Articles are found through each newspaper’s own sitemap. “No stories” and “not scanned” are different facts: an outlet that was never scanned tells us nothing.',
    'প্রতিটি পত্রিকার নিজস্ব সাইটম্যাপ থেকে খবর খোঁজা হয়। “কোনো খবর নেই” আর “খোঁজা হয়নি” আলাদা কথা: যে পত্রিকা খোঁজা হয়নি, তা থেকে কিছুই জানা যায় না।'],
  srcReadBack: ['read back to {date}', '{date} পর্যন্ত পেছনে পড়া হয়েছে'], srcNoHistory: ['history not read yet', 'পুরোনো খবর এখনো পড়া হয়নি'],
  srcScanned: ['last scanned {date}', 'শেষ খোঁজা {date}'], srcNotScanned: ['not scanned yet', 'এখনো খোঁজা হয়নি'],
  srcStories: ['{n} stories this season', 'এই মৌসুমে {n}টি খবর'], srcNoStories: ['no stories this season', 'এই মৌসুমে কোনো খবর নেই'],
  srcExcluded: ['Excluded', 'বাদ দেওয়া'], droppedTitle: ['Items dropped by our checks', 'আমাদের যাচাইয়ে বাদ পড়া খবর'], droppedNone: ['None.', 'নেই।'],
  newsBuild: ['Stories read by {model}; collection updated {updated}; satellite figures from data build {build}.', 'খবর পড়েছে {model}; সংগ্রহ হালনাগাদ {updated}; স্যাটেলাইটের সংখ্যা ডেটা বিল্ড {build} থেকে।'],
  areaNews: ['{n} news stories about {name} this season', 'এই মৌসুমে {name} নিয়ে {n}টি খবর'],
  areaNewsOne: ['1 news story about {name} this season', 'এই মৌসুমে {name} নিয়ে ১টি খবর'],
} as const

const DIVISION_BN: Record<string, string> = { Dhaka: 'ঢাকা', Chattogram: 'চট্টগ্রাম', Chittagong: 'চট্টগ্রাম', Rajshahi: 'রাজশাহী', Khulna: 'খুলনা',
  Barishal: 'বরিশাল', Barisal: 'বরিশাল', Sylhet: 'সিলেট', Rangpur: 'রংপুর', Mymensingh: 'ময়মনসিংহ' }
/** "Dhaka division" / "ঢাকা বিভাগ". */
export const divisionName = (d: string, lang: Lang) => (lang === 'bn' ? `${DIVISION_BN[d] ?? d} বিভাগ` : `${d} division`)

/** Short month names, January first ("Sep", never en-GB "Sept"). */
export const monthNames = (lang: Lang) => Array.from({ length: 12 }, (_, m) =>
  new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', timeZone: 'UTC' }).format(Date.UTC(2001, m, 1)))
export type Key = keyof typeof S

export function useLang(): Lang {
  const [sp] = useSearchParams()
  return sp.get('lang') === 'bn' ? 'bn' : 'en'
}

export function useT() {
  const lang = useLang()
  return (k: Key) => S[k][lang === 'bn' ? 1 : 0] || S[k][0]
}

/** A string in either language, outside React: `{name}` placeholders are filled from `vars`. Pure. */
export const tr = (k: Key, lang: Lang, vars: Record<string, string | number> = {}) =>
  (S[k][lang === 'bn' ? 1 : 0] || S[k][0]).replace(/\{(\w+)\}/g, (m, v: string) => (v in vars ? String(vars[v]) : m))

export const fmtNumber = (v: number, lang: Lang, digits = 2) =>
  new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-US', { maximumFractionDigits: digits }).format(v)
