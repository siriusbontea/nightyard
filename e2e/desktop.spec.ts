import { expect, test } from '@playwright/test'
import { openApp, tryFirst } from './helpers'

test('desktop sidebar searches, filters, and moves with the keyboard', async ({ page }) => {
  await openApp(page)
  await tryFirst(page)

  await expect(page.locator('.desk-book')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Choose File' })).toHaveCount(0)
  await expect(page.locator('.top')).not.toContainText('Choose File')
  await expect(page.getByText('Example plays')).toBeVisible()
  await expect(page.getByText('Make a free account to save plays')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move a player' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Draw a path' }).click()
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Draw a path' })).toHaveAttribute('aria-pressed', 'true')

  const search = page.locator('.desk-book').getByRole('textbox', { name: 'Find a play' })
  await search.fill('stick')
  await expect(page.locator('.desk-book').getByText('Stick', { exact: true })).toBeVisible()
  await expect(page.locator('.desk-book').getByText('Corndog', { exact: true })).toHaveCount(0)
  await search.fill('')

  await page.getByLabel('Play type').selectOption('Run play')
  await expect(page.locator('.desk-book').getByText('No plays match.')).toBeVisible()
  await page.getByLabel('Play type').selectOption('All')
  await expect(page.locator('.desk-book').getByText('Corndog', { exact: true })).toBeVisible()
  await expect(page.locator('.desk-book').getByText('Stick', { exact: true })).toBeVisible()

  const title = page.locator('.stage .play-title')
  const before = (await title.evaluate((el) => el.textContent ?? '')).trim()
  await page.getByLabel('Example plays').focus()
  await page.keyboard.press('ArrowDown')
  await expect.poll(async () => (await title.evaluate((el) => el.textContent ?? '')).trim()).not.toBe(before)
  const after = (await title.evaluate((el) => el.textContent ?? '')).trim()
  expect(['Corndog', 'Stick']).toContain(after)

  await page.getByRole('button', { name: 'Change the lineup' }).hover()
  await expect(page.locator('.tip-pop')).toHaveText('Change the lineup')

  const fit = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth + 1)
})
