import { expect, test } from '@playwright/test'
import { openApp, tryFirst } from './helpers'

test('tall phone keeps the welcome card, field, and tools on screen', async ({ page }) => {
  await openApp(page)
  const welcome = page.locator('.welcome-card')
  const box = await welcome.boundingBox()
  expect(box).toBeTruthy()
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height).toBeLessThanOrEqual(874)
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(402)

  await tryFirst(page)
  const toolbar = await page.locator('.toolbar').boundingBox()
  expect(toolbar).toBeTruthy()
  expect(toolbar!.y).toBeGreaterThanOrEqual(0)
  expect(toolbar!.y + toolbar!.height).toBeLessThanOrEqual(874)
  const field = await page.locator('svg.field').boundingBox()
  expect(field).toBeTruthy()
  expect(field!.height).toBeGreaterThan(120)

  const fit = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    appHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim(),
  }))
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1)
  expect(fit.appHeight).toMatch(/px$/)

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).toContain('maximum-scale=1')
  expect(viewport).toContain('user-scalable=no')
})
