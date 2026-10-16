import { expect, test, type Page } from '@playwright/test'
import { openApp } from './helpers'

const shots = '/opt/cursor/artifacts'

test.describe('iPhone 17 Pro', () => {
  test.use({
    viewport: { width: 402, height: 874 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  })

  test('the first play offers home screen with a picture guide', async ({ page }) => {
    await landOnFirstPlay(page)
    await page.screenshot({ path: `${shots}/install-tip-iphone.png` })
    await page.getByRole('button', { name: 'Show me' }).click()
    const guide = page.getByRole('dialog', { name: 'Add to Home Screen' })
    await expect(guide.getByText('Tap the menu button')).toBeVisible()
    await expect(guide.getByText('Next to the web address, at the bottom.')).toBeVisible()
    await expect(guide.locator('.install-menu')).toBeVisible()
    await expect(guide.getByText('Tap Share')).toBeVisible()
    await expect(guide.getByText('Tap Add to Home Screen')).toBeVisible()
    await expect(guide.getByText('Scroll down if you need to.')).toBeVisible()
    await expect(guide.getByText('Add', { exact: true })).toBeVisible()
    await expect(guide.getByText('Older iPhones may show the Share button (square with up arrow) right in the bottom bar.')).toBeVisible()
    const viewport = page.viewportSize()
    for (const name of ['Tap the menu button', 'Tap Share', 'Tap Add to Home Screen', 'Tap Add']) {
      const box = await guide.getByText(name, { exact: true }).boundingBox()
      expect(box, name).toBeTruthy()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height)
    }
    const ok = await guide.getByRole('button', { name: 'OK' }).boundingBox()
    expect(ok!.y + ok!.height).toBeLessThanOrEqual(viewport!.height)
    await page.screenshot({ path: `${shots}/install-guide-iphone.png` })
    await guide.getByRole('button', { name: 'OK' }).click()

    await page.getByRole('button', { name: 'More choices' }).click()
    const more = page.getByRole('dialog', { name: 'More' })
    await expect(more.getByRole('button', { name: 'Add to Home Screen' })).toBeVisible()
    await page.screenshot({ path: `${shots}/install-more-iphone.png` })
  })
})

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('the first play offers home screen with menu instructions', async ({ page }) => {
    await landOnFirstPlay(page)
    await page.screenshot({ path: `${shots}/install-tip-desktop.png` })
    await page.getByRole('button', { name: 'Not now' }).click()
    await expect(page.getByRole('dialog', { name: 'Put Night Yard on your home screen' })).toBeHidden()

    await page.reload()
    await expect(page.locator('svg.field')).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Put Night Yard on your home screen' })).toHaveCount(0)

    await page.getByRole('button', { name: 'More choices' }).click()
    const more = page.getByRole('dialog', { name: 'More' })
    const add = more.getByRole('button', { name: 'Add to Home Screen' })
    await expect(add).toBeVisible()
    await add.hover()
    await expect(page.locator('.tip-pop')).toHaveText('Put Night Yard on your home screen')
    await page.screenshot({ path: `${shots}/install-more-desktop.png` })
    await add.click()
    await expect(page.getByText('Open the browser menu. Then choose Install Night Yard.')).toBeVisible()
    await page.screenshot({ path: `${shots}/install-menu-desktop.png` })
  })

  test('an installed app hides the home screen offer', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = window.matchMedia.bind(window)
      window.matchMedia = (query: string) => {
        if (query.includes('display-mode')) {
          return {
            matches: query.includes('standalone'),
            media: query,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return false
            },
          } as MediaQueryList
        }
        return orig(query)
      }
    })
    await openApp(page)
    await page.getByRole('button', { name: 'Try it first' }).click()
    const tour = page.getByRole('dialog', { name: 'Tip' })
    await expect(tour).toBeVisible()
    await tour.getByRole('button', { name: 'Skip' }).click()
    await expect(page.getByRole('dialog', { name: 'Put Night Yard on your home screen' })).toHaveCount(0)
    await page.getByRole('button', { name: 'More choices' }).click()
    await expect(page.getByRole('dialog', { name: 'More' }).getByRole('button', { name: 'Add to Home Screen' })).toHaveCount(0)
  })
})

async function landOnFirstPlay(page: Page) {
  await openApp(page)
  await page.getByRole('button', { name: 'Try it first' }).click()
  const tour = page.getByRole('dialog', { name: 'Tip' })
  await expect(tour).toBeVisible()
  await tour.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByRole('dialog', { name: 'Put Night Yard on your home screen' })).toBeVisible()
}
