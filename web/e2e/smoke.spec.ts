import { expect, test, type Page } from '@playwright/test'

const ROUTES = ['#/', '#/area', '#/area/BD3026', '#/kilns', '#/kilns/BD3026', '#/sensors', '#/timeline', '#/impact', '#/impact/families/BD1004', '#/how', '#/trust', '#/experts',
  '#/story', '#/explore', '#/explore/district/BD3026', '#/experts/kilns', '#/evidence', '#/season', '#/method', '#/explore/box/90.2500,23.6000,90.6000,23.9000']

function watchErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|cartocdn|ERR_INTERNET|Failed to load resource/i.test(m.text())) errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

for (const [theme, width] of [['day', 1366], ['night', 1366], ['day', 390]] as const) {
  for (const route of ROUTES) {
    test(`renders ${route} (${theme}, ${width}px) with no console errors`, async ({ page }) => {
      const errors = watchErrors(page)
      await page.setViewportSize({ width, height: 900 })
      await page.addInitScript((t) => localStorage.setItem('kwTheme', t), theme)
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()
      await page.waitForTimeout(1500)
      await expect(page.getByText(/This view failed to draw|Couldn’t load this data/)).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme)
      // no horizontal page scroll at any width
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
      await page.screenshot({ path: `test-results/${theme}_${width}_${route.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true })
      expect(errors).toEqual([])
    })
  }
}

test('reduced motion: the Ledger starts on the harmonized view', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('#/')
  await expect(page.getByRole('radio', { name: 'Harmonized' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('button', { name: 'Replay' })).toHaveCount(0)
})

test('"/" focuses area search and Enter opens the match', async ({ page }) => {
  await page.goto('#/explore')
  await page.waitForTimeout(800)
  await page.keyboard.press('/')
  await expect(page.locator('#unit-search')).toBeFocused()
  await page.keyboard.type('Dhaka')
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/#\/explore\/district\/BD3026/)
})

test('clicking a heatmap day opens that season', async ({ page }) => {
  await page.goto('#/explore/district/BD3026')
  const hm = page.locator('#calendar .measure')
  await expect(hm).toBeVisible()
  await page.waitForTimeout(1200)
  const b = (await hm.boundingBox())!
  // Real calendars have empty (cloud / no-fire) days: sweep a bounded grid until a populated day is clicked.
  const xs = [0.85, 0.7, 0.9, 0.6, 0.5, 0.8]
  const ys = [0.3, 0.5, 0.7, 0.4, 0.6]
  outer: for (const fy of ys) {
    for (const fx of xs) {
      await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy)
      if (await page.url().match(/season=\d{4}-\d{2}/)) break outer
      await page.waitForTimeout(150)
    }
  }
  await expect(page).toHaveURL(/season=\d{4}-\d{2}/)
})

test('a box under 100 km² is refused at draw time', async ({ page }) => {
  await page.goto('#/explore')
  await page.locator('aside button[aria-pressed]').click()
  const m = (await page.locator('.bd-map').boundingBox())!
  await page.mouse.move(m.x + 150, m.y + 150)
  await page.mouse.down()
  await page.mouse.move(m.x + 155, m.y + 155, { steps: 3 })
  await expect(page.getByText(/too small \(min 100 km²\)/)).toBeVisible()
  await page.mouse.up()
  await expect(page).toHaveURL(/#\/explore$/)
})

test('evidence shows every pre-registered test as a verdict', async ({ page }) => {
  await page.goto('#/evidence')
  await expect(page.getByText(/^(Pass|Fail)$/).first()).toBeVisible()
  await expect(page.locator('[role="img"][aria-label^="observed"]').first()).toBeVisible()
})

test('hovering a chart keeps its series drawn', async ({ page }) => {
  await page.goto('#/story') // the science story moved here from the home page (redesign_plan.md §3)
  const canvas = page.locator('section', { has: page.getByRole('heading', { name: /record lies/ }) }).locator('canvas').first()
  await canvas.scrollIntoViewIfNeeded()
  await page.waitForTimeout(1200)
  // Orange pixels on screen in the plot area (end labels excluded) = the harmonized line; hovering must not erase it.
  // Counted from a screenshot, not getImageData: the canvas buffer can hold strokes the compositor never shows.
  const heat = async () => {
    const png = (await canvas.screenshot()).toString('base64')
    return page.evaluate(async (src) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode()
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
      const x = c.getContext('2d')!; x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, Math.floor(c.width * 0.85), c.height).data
      let n = 0
      for (let i = 0; i < d.length; i += 4) if (d[i] > 190 && d[i + 1] < 130 && d[i + 2] < 90) n++
      return n
    }, png)
  }
  const before = await heat()
  const b = (await canvas.boundingBox())!
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5, { steps: 5 })
  await page.waitForTimeout(600)
  expect(before).toBeGreaterThan(150)
  // A tooltip may cover any share of the line (data-dependent); the regression under test is the series
  // being erased on hover. Move the pointer away and require the line fully back.
  await page.mouse.move(b.x - 30, b.y - 30, { steps: 5 })
  await page.waitForTimeout(600)
  expect(await heat()).toBeGreaterThan(before * 0.9)
})

test('cursors say what a click or drag will do (bg_cursor_plan.md §3)', async ({ page }) => {
  const cursor = (sel: string) => page.locator(sel).first().evaluate((e) => getComputedStyle(e).cursor)
  await page.goto('#/explore')
  await page.waitForTimeout(1500)
  expect(await cursor('.bd-map svg')).toBe('grab')
  const pickDay = await cursor('.bd-feat')
  expect(pickDay).toMatch(/^(image-set|url)\(/)
  // empty ground pans: grabbing while the button is down, released after
  const svg = (await page.locator('.bd-map svg').boundingBox())!
  const empty = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName.toLowerCase(), [svg.x + 3, svg.y + 3])
  expect(empty).toBe('svg')
  await page.mouse.move(svg.x + 3, svg.y + 3)
  await page.mouse.down()
  await expect(page.locator('html')).toHaveClass(/is-panning/)
  await page.mouse.up()
  await expect(page.locator('html')).not.toHaveClass(/is-panning/)
  // draw mode: the box cursor replaces grab
  await page.locator('aside button[aria-pressed]').click()
  expect(await cursor('.bd-map svg')).toMatch(/^(image-set|url)\(/)
  // night swaps the art, not the meaning
  await page.locator('aside button[aria-pressed]').click()
  await page.evaluate(() => { document.documentElement.dataset.theme = 'night' })
  expect(await cursor('.bd-feat')).not.toBe(pickDay)
  await page.goto('#/explore/district/BD3026')
  await expect(page.locator('#calendar .measure canvas').first()).toBeVisible()
  expect(await cursor('#calendar .measure canvas')).toMatch(/^(image-set|url)\(/)
})

test('forced colours fall back to system cursors and drop the page ground', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('#/explore/district/BD3026')
  await expect(page.locator('#calendar .measure canvas').first()).toBeVisible()
  expect(await page.locator('#calendar .measure canvas').first().evaluate((e) => getComputedStyle(e).cursor)).toBe('crosshair')
  expect(await page.locator('.bd-feat').first().evaluate((e) => getComputedStyle(e).cursor)).toBe('crosshair')
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').display)).toBe('none')
})

test('page ground: band tilts with the pass, never on phones', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('#/')
  const tilt = () => page.locator('.hero-ground').evaluate((e) => {
    const m = new DOMMatrix(getComputedStyle(e, '::before').transform)
    return Math.round((Math.atan2(m.b, m.a) * 180) / Math.PI)
  })
  // S-NPP ground track over 23.7°N: N13°W on the 13:30 pass, mirrored on the 01:30 pass
  expect(await tilt()).toBe(-13)
  await page.evaluate(() => { document.documentElement.dataset.theme = 'night' })
  expect(await tilt()).toBe(13)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.locator('.hero-ground').evaluate((e) => getComputedStyle(e, '::before').content)).toBe('none')
  expect(await page.evaluate(() => getComputedStyle(document.body, '::before').content)).toBe('none')
})

for (const width of [700, 1440]) {
  test(`compact bar sits flush under the header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('#/explore/district/BD3026')
    await expect(page.locator('#calendar .measure').first()).toBeVisible()
    await page.evaluate(() => scrollTo(0, 900))
    await expect(page.locator('.compact-bar')).toHaveAttribute('data-on', 'true')
    await page.locator('.compact-bar').evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished))) // 160ms entrance
    const [headerBottom, barTop] = await page.evaluate(() => [
      document.querySelector('header')!.getBoundingClientRect().bottom,
      document.querySelector('.compact-bar')!.getBoundingClientRect().top,
    ])
    expect(Math.abs(barTop - headerBottom)).toBeLessThanOrEqual(1)
  })
}

test('main nav fits without scrolling on common widths', async ({ page }) => {
  for (const width of [390, 700, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('#/explore')
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav).toBeVisible()
    expect(await nav.evaluate((n) => n.scrollWidth - n.clientWidth), `nav overflow at ${width}px`).toBeLessThanOrEqual(0)
  }
})

// --- plain-language apps (redesign_plan.md §4) ---
test('my area: a refused location falls back to search, a granted one opens the area', async ({ page, context }) => {
  await page.goto('#/area')
  await page.getByRole('button', { name: 'Use my location' }).click()
  await expect(page.getByText(/Location is off or was refused/)).toBeVisible()
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: 23.81, longitude: 90.41 }) // central Dhaka
  await page.getByRole('button', { name: 'Use my location' }).click()
  await expect(page).toHaveURL(/#\/area\/BD3026/)
  await expect(page.getByText('Fire season here')).toBeVisible()
})

test('my area: search by name opens the area', async ({ page }) => {
  await page.goto('#/area')
  await page.getByLabel('Search by name').fill('Rajshahi (district, Rajshahi)')
  await expect(page).toHaveURL(/#\/area\/BD\d{4}$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Rajshahi' })).toBeVisible()
})

test('kiln planner: the season slider recolours the map', async ({ page }) => {
  await page.goto('#/kilns')
  const feats = page.locator('.bd-feat')
  await expect(feats.first()).toBeVisible()
  const fills = () => feats.evaluateAll((els) => els.map((e) => e.getAttribute('fill')).join('|'))
  const before = await fills()
  await page.locator('input[type="range"]').fill('0')
  await expect(page.locator('input[type="range"]')).toHaveAttribute('aria-valuetext', '2012-13')
  await expect(page.getByText(/^In 2012-13, the kiln season across Bangladesh lasted/)).toBeVisible()
  expect(await fills()).not.toBe(before)
})

test('sensor switch: answering reveals the steps and the correction shrinks the jump', async ({ page }) => {
  await page.goto('#/sensors')
  await expect(page.getByRole('button', { name: 'Apply the correction' })).toHaveCount(0)
  await page.getByRole('button', { name: 'No, something else changed' }).click()
  await page.getByRole('button', { name: 'Apply the correction' }).click()
  await expect(page.getByText(/After correction, the 2012 jump shrinks/)).toBeVisible()
})

test('timeline: an event opens to its source', async ({ page }) => {
  await page.goto('#/timeline')
  const ev = page.locator('details', { hasText: 'Brick Kiln Control Act 2013 passed' })
  await ev.locator('summary').click()
  await expect(ev.getByRole('link', { name: 'Source' })).toHaveAttribute('href', /^https:\/\//)
})

test('glossary words explain themselves on tap', async ({ page }) => {
  await page.goto('#/sensors')
  await page.getByRole('button', { name: 'No, something else changed' }).click()
  await page.getByRole('button', { name: /^VIIRS: what does this mean/ }).first().click()
  await expect(page.getByText(/375 m by 375 m/).first()).toBeVisible()
})

// --- v2: approach, playbooks, trust (redesign_plan.md §9) ---
test('who benefits: picking a person and a district rewrites the plan and its address', async ({ page }) => {
  await page.goto('#/impact')
  await page.getByRole('button', { name: /^Environment inspectors/ }).click()
  await expect(page).toHaveURL(/#\/impact\/inspector\/BD3026/)
  await page.getByLabel('District').selectOption({ label: 'Rajshahi' })
  await expect(page).toHaveURL(/#\/impact\/inspector\/BD\d{4}$/)
  await expect(page.getByRole('heading', { level: 2, name: 'Environment inspectors in Rajshahi' })).toBeVisible()
})

test('how it works: Next walks the six steps in order', async ({ page }) => {
  await page.goto('#/how')
  for (const s of ['They spot heat', 'One scale', 'A calendar', 'People act', 'Extension: kilns']) {
    await page.getByRole('button', { name: `Next: ${s}` }).click()
    await expect(page.getByRole('heading', { level: 2, name: new RegExp(s) })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /^Next/ })).toBeDisabled()
})

test('trust: the country switch shows each tested country on its own data', async ({ page }) => {
  await page.goto('#/trust')
  const sw = page.getByRole('radiogroup', { name: 'Country' })
  await expect(sw.getByRole('radio').first()).toHaveText('Bangladesh') // the switch fills once kiln_activity.json loads
  const names = await sw.getByRole('radio').allTextContents()
  expect(names.length).toBeGreaterThan(1)
  for (const n of names.slice(1)) {
    await sw.getByRole('radio', { name: n }).click()
    await expect(page.getByText(`Extra night glow at kiln sites, month by month: ${n}`)).toBeVisible()
    await expect(page.getByText(new RegExp(`^(Passed in|Did not pass in|Not tested)`)).first()).toBeVisible()
  }
})
