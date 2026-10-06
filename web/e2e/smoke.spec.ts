import { expect, test } from '@playwright/test'

for (const route of ['#/', '#/explore/district/BD3026', '#/kilns', '#/evidence', '#/season', '#/method', '#/explore/box/90.2500,23.6000,90.6000,23.9000']) {
  test(`renders ${route} with no console errors`, async ({ page }) => {
    const errors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error' && !/tile|cartocdn|ERR_INTERNET|Failed to load resource/i.test(m.text())) errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(route)
    await expect(page.locator('main')).toBeVisible()
    await page.waitForTimeout(1500)
    await expect(page.getByText(/Something went wrong|Could not load data/)).toHaveCount(0)
    await page.screenshot({ path: `test-results/${route.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}
