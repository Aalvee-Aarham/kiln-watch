import { expect, test, type Page } from '@playwright/test'

const ROUTES = ['#/', '#/explore', '#/explore/district/BD3026', '#/kilns', '#/evidence', '#/season', '#/method', '#/explore/box/90.2500,23.6000,90.6000,23.9000']

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
  await page.mouse.click(b.x + b.width * 0.85, b.y + b.height * 0.3)
  await expect(page).toHaveURL(/season=\d{4}-\d{2}/)
})

test('a box under 100 km² is refused at draw time', async ({ page }) => {
  await page.goto('#/explore')
  await page.locator('aside button[aria-pressed]').click()
  const m = (await page.locator('.leaflet-container').boundingBox())!
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
  await page.goto('#/')
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
  // The tooltip covers part of the line; a vanished line keeps about a quarter (its end-label dot and tooltip swatch).
  expect(await heat()).toBeGreaterThan(before * 0.6)
})
