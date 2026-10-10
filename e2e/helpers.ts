import { expect, type Page } from '@playwright/test'

export async function openApp(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('dialog', { name: 'Welcome' })).toBeVisible()
}

export async function skipTour(page: Page) {
  const tip = page.getByRole('dialog', { name: 'Tip' })
  await expect(tip).toBeVisible()
  await tip.getByRole('button', { name: 'Skip' }).click()
  await expect(tip).toBeHidden()
}

export async function tryFirst(page: Page) {
  await page.getByRole('button', { name: 'Try it first' }).click()
  await skipTour(page)
  await expect(page.locator('svg.field')).toBeVisible()
}

export async function signUp(page: Page, username: string, password: string) {
  await page.locator('.guest-chip').click()
  const form = page.getByRole('dialog', { name: 'Make a free account' })
  await expect(form).toBeVisible()
  await form.getByLabel('Username').fill(username)
  await form.getByRole('textbox', { name: 'Password', exact: true }).fill(password)
  await form.getByRole('textbox', { name: 'Password again', exact: true }).fill(password)
  await form.getByRole('button', { name: 'Make free account' }).click()
  await expect(page.locator('.save-chip')).toContainText('Saved to your account', { timeout: 25_000 })
}

export async function openPlays(page: Page) {
  await page.getByRole('button', { name: 'Open your plays' }).click()
  await expect(page.getByRole('dialog', { name: 'Plays' })).toBeVisible()
}

export async function closeSheet(page: Page) {
  await page.getByRole('button', { name: 'Close' }).click()
}

export function accountUser(): string {
  return `qa${Date.now().toString(36)}`
}
