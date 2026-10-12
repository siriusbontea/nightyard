import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import { PDFDocument } from 'pdf-lib'
import { accountUser, closeSheet, openApp, openPlays, skipTour } from './helpers'

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let page: Page
const password = 'nightyard'
const nextPassword = 'nightyard2'
const username = accountUser()

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  page = await context.newPage()
  page.on('dialog', (dialog) => dialog.accept())
})

test.afterAll(async () => {
  await context.close()
})

async function fieldHtml() {
  return page.locator('svg.field').innerHTML()
}

async function labelX(label: string) {
  const loc = page.locator('svg.field text').filter({ hasText: new RegExp(`^${label}$`) }).first()
  await expect(loc).toBeAttached()
  return loc.evaluate((el) => el.getBoundingClientRect().x)
}

test('welcome card opens a signup form you can type in', async () => {
  await openApp(page)
  await page.getByRole('button', { name: 'Make free account' }).click()
  const form = page.getByRole('dialog', { name: 'Make a free account' })
  await expect(form).toBeVisible()
  await form.getByLabel('Username').fill('tempname')
  await expect(form.getByLabel('Username')).toHaveValue('tempname')
  await form.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign in' }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in' })
  await expect(signIn.getByRole('textbox', { name: 'Password', exact: true })).toBeVisible()
  await signIn.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome' })).toBeVisible()
})

test('try first shows the tour, then Corndog and Stick', async () => {
  await page.getByRole('button', { name: 'Try it first' }).click()
  const tip = page.getByRole('dialog', { name: 'Tip' })
  await expect(tip).toContainText('Orange players are your team.')
  await tip.getByRole('button', { name: 'Next' }).click()
  await expect(tip).toContainText('Move, draw, and pick paths here.')
  await tip.getByRole('button', { name: 'Next' }).click()
  await expect(tip).toContainText('Tap Draw. Then drag from a player to draw a route.')
  await tip.getByRole('button', { name: 'Next' }).click()
  await expect(tip).toContainText('Your plays save by themselves. Open them in Plays.')
  const ring = page.locator('.tour-ring')
  await expect(ring).toBeVisible()
  await expect(ring).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await skipTour(page)

  await expect(page.locator('.guest-chip')).toHaveCount(0)
  await expect(page.locator('.save-chip')).toHaveCount(1)
  await expect(page.locator('.save-chip')).toHaveText('Not saved — make a free account')
  await expect(page.locator('.hint')).not.toContainText(/account/i)
  await expect(page.locator('.play-title')).toHaveText('Corndog')
  await expect(page.locator('.sub')).toContainText('Start on the 3')

  await openPlays(page)
  const plays = page.getByRole('dialog', { name: 'Plays' })
  await expect(plays.getByRole('textbox', { name: 'Find a play' })).toHaveCount(0)
  await expect(plays.locator('.save-chip')).toHaveCount(0)
  await expect(plays.getByText('Not saved — make a free account')).toHaveCount(0)
  await expect(plays.getByRole('button', { name: 'Make a PDF (needs free account)' })).toBeVisible()
  await expect(plays.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(plays.getByText('Example plays')).toBeVisible()
  await expect(plays.getByText('Make a free account to save plays')).toBeVisible()
  await expect(plays.getByText('Your saved plays')).toBeVisible()
  const more = plays.locator('.row-more').first()
  const box = await more.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
  await plays.locator('.saved-open').filter({ hasText: 'Stick' }).click()
  await expect(page.locator('.play-title')).toHaveText('Stick')
  await expect(page.locator('.sub')).toContainText('Start on the 30')

  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).toContain('maximum-scale=1')
  expect(viewport).toContain('user-scalable=no')
  const appHeight = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--app-height').trim())
  expect(appHeight).toMatch(/px$/)
})

test('tools stay selected, routes change, and the play plays back', async () => {
  await expect(page.getByRole('button', { name: 'Move a player' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Draw a path' }).click()
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  await closeSheet(page)
  await expect(page.getByRole('button', { name: 'Draw a path' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Move a player' }).click()
  await openPlays(page)
  await closeSheet(page)
  await expect(page.getByRole('button', { name: 'Move a player' })).toHaveAttribute('aria-pressed', 'true')

  await page.getByRole('button', { name: 'Watch the play' }).click()
  await expect(page.getByRole('button', { name: 'Pause the play' })).toBeVisible()
  await page.getByRole('button', { name: 'Pause the play' }).click()
  await page.getByRole('slider', { name: 'Slide through the play' }).fill('400')
  await expect(page.getByRole('slider', { name: 'Slide through the play' })).toHaveValue('400')

  const beforeFlip = await fieldHtml()
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  const paths = page.getByRole('dialog', { name: 'Paths' })
  await paths.getByRole('button', { name: 'WR1', exact: true }).click()
  await expect(paths.getByRole('button', { name: 'Block Stop them' })).toHaveCount(1)
  await expect(paths.locator('.route-options').getByRole('button', { name: 'Block', exact: true })).toHaveCount(0)
  await expect(paths.getByRole('button', { name: 'Redraw' })).toBeVisible()
  await expect(paths.getByRole('button', { name: 'Remove route' })).toBeVisible()
  await expect(paths.getByRole('button', { name: 'Flip', exact: true })).toBeVisible()
  await paths.getByRole('button', { name: 'Flip', exact: true }).click()
  await closeSheet(page)
  await expect.poll(fieldHtml).not.toBe(beforeFlip)

  await expect(page.getByRole('button', { name: 'Block in front' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Change this path' })).toBeVisible()
  await page.getByRole('button', { name: 'Change this path' }).click()
  await expect(page.getByRole('dialog', { name: 'Paths' })).toBeVisible()
  await closeSheet(page)
  const beforeBar = await fieldHtml()
  await page.getByRole('button', { name: 'Flip this path' }).click()
  await expect.poll(fieldHtml).not.toBe(beforeBar)

  await page.getByRole('button', { name: 'Draw a path' }).click()
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  await page.getByRole('dialog', { name: 'Paths' }).getByRole('button', { name: 'WR1', exact: true }).click()
  await page.getByRole('dialog', { name: 'Paths' }).getByRole('button', { name: 'Redraw' }).click()
  await expect(page.getByRole('dialog', { name: 'Paths' })).toBeHidden()
  await expect(page.getByRole('button', { name: 'Draw a path' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.hint')).toContainText('Draw a new path from here.')
  await page.getByRole('button', { name: 'Move a player' }).click()

  await page.getByRole('button', { name: 'Remove this route' }).click()
  await expect(page.getByText('Removed. Tap Undo.')).toBeVisible()
  await page.locator('.toast-undo').click()
  await expect(page.getByRole('button', { name: 'Remove this route' })).toBeVisible()

  const beforePlay = await labelX('WR1')
  await page.getByRole('button', { name: 'More choices' }).click()
  await page.getByRole('button', { name: /Flip play/ }).click()
  await expect(page.getByRole('dialog', { name: 'More' })).toBeHidden()
  const afterPlay = await labelX('WR1')
  expect(Math.abs(afterPlay - beforePlay)).toBeGreaterThan(8)

  await page.getByRole('button', { name: 'More choices' }).click()
  await page.getByRole('button', { name: /Show the other team/ }).click()
  await closeSheet(page)
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  const defense = page.getByRole('dialog', { name: 'Paths' })
  await defense.getByRole('button', { name: /^(CB|LB|DE|S|FS|SS)/ }).first().click()
  await defense.getByRole('button', { name: 'Deep third' }).click()
  await expect(defense.getByRole('button', { name: 'Deep third' })).toHaveAttribute('aria-pressed', 'true')
  await closeSheet(page)

  await page.getByRole('button', { name: 'More choices' }).click()
  await page.getByRole('button', { name: 'Show tips again' }).click()
  await expect(page.getByRole('dialog', { name: 'Tip' })).toBeVisible()
  await skipTour(page)
})

test('setup covers flag, tackle, kicking, and the start line', async () => {
  await page.getByRole('button', { name: 'Change the lineup' }).click()
  const setup = page.getByRole('dialog', { name: 'Setup' })
  await expect(setup.getByRole('button', { name: '30', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(setup.getByText('Where the play starts')).toBeVisible()
  await expect(setup.getByText('Changing who has the ball or the lineup clears the lines.')).toBeVisible()
  await expect(setup.getByText('Quarterback stands back. Three receivers on one side.')).toBeVisible()
  await setup.getByRole('button', { name: 'Them' }).click()
  await acceptClear(page)
  await expect(setup.getByRole('button', { name: 'Them' })).toHaveAttribute('aria-pressed', 'true')
  await expect(setup.getByRole('button', { name: 'Us', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await setup.getByRole('button', { name: 'Us', exact: true }).click()
  await acceptClear(page)
  await expect(setup.getByRole('button', { name: 'Us', exact: true })).toHaveAttribute('aria-pressed', 'true')

  await setup.getByRole('button', { name: '5 on 5 flag' }).click()
  await acceptClear(page)
  await expect(setup.getByText('Flag does not use kicking.')).toBeVisible()
  await expect(setup.getByRole('button', { name: 'Kickoff' })).toHaveCount(0)
  await expect(setup.getByRole('button', { name: 'Special teams' })).toHaveCount(0)
  await closeSheet(page)

  await page.getByRole('button', { name: 'Draw a path' }).click()
  await expect(page.getByRole('button', { name: 'Draw a route' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Move before the snap' })).toBeVisible()
  await expect(page.locator('.kind-row').getByRole('button', { name: 'Block', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  const flagPaths = page.getByRole('dialog', { name: 'Paths' })
  await flagPaths.getByRole('button', { name: 'QB', exact: true }).click()
  await expect(flagPaths.getByRole('button', { name: 'Block', exact: true })).toHaveCount(0)
  await closeSheet(page)
  await page.getByRole('button', { name: 'Move a player' }).click()
  await page.getByRole('button', { name: 'Change this player' }).click()
  const player = page.getByRole('dialog', { name: 'QB' })
  await expect(player.getByRole('button', { name: 'WR', exact: true })).toBeVisible()
  await expect(player.getByRole('button', { name: 'C', exact: true })).toBeVisible()
  await expect(player.getByRole('button', { name: 'TE', exact: true })).toHaveCount(0)
  await expect(player.getByRole('button', { name: 'T', exact: true })).toHaveCount(0)
  await closeSheet(page)

  await page.getByRole('button', { name: 'Change the lineup' }).click()
  await setup.getByRole('button', { name: '11 on 11 tackle' }).click()
  await acceptClear(page)
  for (const name of ['Kickoff', 'Kick return', 'Punt', 'Punt return', 'Field goal', 'FG block']) {
    await expect(setup.locator('.lineup-pick').filter({ has: page.locator('span', { hasText: new RegExp(`^${name}$`) }) })).toBeVisible()
  }
  await expect(setup.getByText('Your team kicks the ball to start.')).toBeVisible()
  await setup.locator('.lineup-pick').filter({ has: page.locator('span', { hasText: /^Kickoff$/ }) }).click()
  await acceptClear(page)
  await expect(setup.locator('.lineup-pick').filter({ has: page.locator('span', { hasText: /^Kickoff$/ }) })).toHaveAttribute('aria-pressed', 'true')
  await closeSheet(page)
  await expect(page.locator('.sub')).toContainText('Kickoff')

  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  const kick = page.getByRole('dialog', { name: 'Paths' })
  await kick.locator('.player-chip').first().click()
  await expect(kick.getByRole('button', { name: /Kick|Cover lane|Return|Block/ }).first()).toBeVisible()
  await closeSheet(page)

  await page.getByRole('button', { name: 'Change the lineup' }).click()
  await setup.getByRole('button', { name: /^Shotgun Trips/ }).click()
  await acceptClear(page)
  await closeSheet(page)
  await page.getByRole('button', { name: 'Pick a ready path' }).click()
  await page.getByRole('dialog', { name: 'Paths' }).getByRole('button', { name: 'QB', exact: true }).click()
  await closeSheet(page)
  await page.getByRole('button', { name: 'Change this player' }).click()
  const tackle = page.getByRole('dialog', { name: 'QB' })
  await expect(tackle.getByRole('button', { name: 'TE', exact: true })).toBeVisible()
  await expect(tackle.getByRole('button', { name: 'T', exact: true })).toBeVisible()
  await closeSheet(page)

  await openPlays(page)
  const plays = page.getByRole('dialog', { name: 'Plays' })
  await plays.locator('.current-play').getByRole('button', { name: 'Run play' }).click()
  await expect(plays.locator('.current-play').getByRole('button', { name: 'Run play' })).toHaveAttribute('aria-pressed', 'true')
  await plays.locator('.filter-row').getByRole('button', { name: 'Run play' }).click()
  await expect(plays.locator('.saved-open').filter({ hasText: 'Stick' })).toBeVisible()
  await plays.locator('.filter-row').getByRole('button', { name: 'Defense' }).click()
  await expect(plays.getByText('No plays in Defense.')).toBeVisible()
  await plays.locator('.current-play').getByRole('button', { name: 'Pass play' }).click()
  await closeSheet(page)
})

test('a guest is asked for an account before a new playbook', async () => {
  await openPlays(page)
  await page.getByRole('button', { name: /Playbook / }).click()
  await expect(page.getByRole('button', { name: 'Keep one playbook' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0)
  await page.getByRole('button', { name: 'New playbook' }).click()
  await expect(page.getByRole('dialog', { name: 'Save your plays' })).toBeVisible()
  await page.getByRole('button', { name: 'Not now' }).click()
})

test('sign up settles, then an idle phone makes no account requests', async () => {
  test.setTimeout(45_000)
  const hits: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/api/collections/') || url.includes('/api/realtime')) hits.push(`${request.method()} ${url}`)
  })
  await page.locator('.save-chip.guest').click()
  const form = page.getByRole('dialog', { name: 'Make a free account' })
  await form.getByLabel('Username').fill(username)
  await form.getByRole('textbox', { name: 'Password', exact: true }).fill(password)
  await form.getByRole('textbox', { name: 'Password again', exact: true }).fill(password)
  await form.getByRole('button', { name: 'Make free account' }).click()
  await expect(page.locator('.save-chip')).toContainText('Saved to your account', { timeout: 25_000 })
  hits.length = 0
  await page.waitForTimeout(10_000)
  expect(hits).toEqual([])
})

test('an offline edit syncs after the phone reconnects and survives reload', async () => {
  await page.getByRole('button', { name: 'Change the lineup' }).click()
  await context.setOffline(true)
  await page.getByRole('dialog', { name: 'Setup' }).getByRole('button', { name: '40', exact: true }).click()
  await closeSheet(page)
  await expect(page.locator('.sub')).toContainText('Start on the 40')
  await expect(page.locator('.save-chip')).toContainText('Saved on this phone — will sync')
  await context.setOffline(false)
  await expect(page.locator('.save-chip')).toContainText('Saved to your account', { timeout: 20_000 })
  await page.reload()
  await expect(page.locator('.play-title')).toHaveText('Stick', { timeout: 20_000 })
  await expect(page.locator('.sub')).toContainText('Start on the 40')
  await expect(page.locator('.save-chip')).toContainText('Saved to your account', { timeout: 20_000 })
})

test('pictures, play files, and color and white playbook PDFs download', async () => {
  test.setTimeout(180_000)
  await page.getByRole('button', { name: 'More choices' }).click()
  await page.getByRole('button', { name: 'Download pictures' }).click()
  const save = page.getByRole('dialog', { name: 'Save' })
  const whitePng = await downloadBytes(() => save.getByRole('button', { name: 'Download white picture' }).click())
  expect(whitePng[0]).toBe(0x89)
  expect(whitePng[1]).toBe(0x50)
  const colorPng = await downloadBytes(() => save.getByRole('button', { name: 'Download color picture' }).click())
  expect(colorPng[0]).toBe(0x89)
  await closeSheet(page)

  await openPlays(page)
  const plays = page.getByRole('dialog', { name: 'Plays' })
  const playFile = await downloadBytes(() => plays.getByRole('button', { name: 'Download this play (file)' }).click())
  expect(playFile.toString('utf8')).toContain('"app": "night-yard"')
  const bookFile = await downloadBytes(() => plays.getByRole('button', { name: 'Download this playbook (file)' }).click())
  expect(bookFile.toString('utf8')).toContain('"kind": "playbook"')

  await plays.locator('.current-play').getByRole('button', { name: 'Rename' }).click()
  await plays.getByRole('textbox', { name: /Rename / }).fill('Stick2')
  await plays.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.locator('.play-title')).toHaveText('Stick2')
  await page.locator('input.file').setInputFiles({
    name: 'stick.json',
    mimeType: 'application/json',
    buffer: playFile,
  })
  await expect(page.locator('.play-title')).toHaveText('Stick', { timeout: 15_000 })

  await page.getByRole('button', { name: 'Make a PDF', exact: true }).click()
  const maker = page.getByRole('dialog', { name: 'Make a PDF' })
  await expect(maker.getByText('Cover, a quick view, then one page for each play.')).toBeVisible()
  const colorPdf = await downloadBytes(() => maker.getByRole('button', { name: 'Make a PDF' }).click())
  expect(colorPdf.subarray(0, 4).toString('utf8')).toBe('%PDF')
  const colorDoc = await PDFDocument.load(colorPdf)
  expect(colorDoc.getPageCount()).toBeGreaterThanOrEqual(3)
  await openPlays(page)
  await page.getByRole('button', { name: 'Make a PDF', exact: true }).click()
  const whiteMaker = page.getByRole('dialog', { name: 'Make a PDF' })
  await whiteMaker.getByRole('button', { name: 'White playbook' }).click()
  const whitePdf = await downloadBytes(() => whiteMaker.getByRole('button', { name: 'Make a PDF' }).click())
  expect(whitePdf.subarray(0, 4).toString('utf8')).toBe('%PDF')
  const whiteDoc = await PDFDocument.load(whitePdf)
  expect(whiteDoc.getPageCount()).toBe(colorDoc.getPageCount())
  expect(colorPdf.length).toBeGreaterThan(whitePdf.length)

  await page.locator('input.file').setInputFiles({
    name: 'book.json',
    mimeType: 'application/json',
    buffer: bookFile,
  })
  await expect(page.getByText(/Opened /)).toBeVisible()
  await openPlays(page)
  await page.getByRole('button', { name: /Playbook / }).first().click()
  await page.getByRole('button', { name: /^Delete / }).first().click()
  await expect(page.getByText('Playbook deleted.')).toBeVisible()
  await closeSheet(page)
})

test('playbooks can be created, renamed, copied, and plays can move', async () => {
  await openPlays(page)
  await page.getByRole('button', { name: 'New play' }).click()
  const fresh = page.getByRole('dialog', { name: 'Setup' })
  await expect(fresh.getByRole('button', { name: '30', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await closeSheet(page)
  await expect(page.locator('.play-title')).toHaveText('Shotgun Trips 1')
  await expect(page.locator('.sub')).toContainText('Start on the 30')

  await openPlays(page)
  await page.getByRole('button', { name: /Playbook / }).click()
  await page.getByRole('button', { name: 'New playbook' }).click()
  await expect(page.getByRole('button', { name: 'Playbook New playbook' })).toBeVisible()
  await page.getByRole('button', { name: 'Playbook New playbook' }).click()
  await page.getByRole('button', { name: 'Rename New playbook' }).click()
  await page.getByRole('textbox', { name: 'Rename New playbook' }).fill('Friday')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Playbook Friday' })).toBeVisible()
  await page.getByRole('button', { name: 'Copy Friday' }).click()
  await expect(page.getByRole('button', { name: 'Playbook Friday copy' })).toBeVisible()
  await page.getByRole('button', { name: 'Playbook Friday copy' }).click()
  await page.getByRole('button', { name: 'Delete Friday copy' }).click()
  await expect(page.getByText('Playbook deleted.')).toBeVisible()

  await page.getByRole('button', { name: 'Playbook Friday' }).click()
  await page.getByRole('button', { name: 'Night Yard', exact: true }).click()
  await page.locator('.saved-open').filter({ hasText: 'Stick' }).click()
  await expect(page.locator('.play-title')).toHaveText('Stick')

  await openPlays(page)
  await page.getByRole('button', { name: 'Copy to another playbook' }).click()
  await page.locator('.dest-list').getByRole('button', { name: 'Friday' }).click()
  await expect(page.getByText('Copied to Friday')).toBeVisible()
  await page.getByRole('button', { name: 'Move to another playbook' }).click()
  await page.locator('.dest-list').getByRole('button', { name: 'Friday' }).click()
  await expect(page.getByText('Moved to Friday')).toBeVisible()
  await page.getByRole('button', { name: /Playbook / }).click()
  await page.getByRole('button', { name: 'Friday', exact: true }).click()
  await expect(page.locator('.saved-open').filter({ hasText: 'Stick' })).toHaveCount(2)

  const doomed = (await page.locator('.play-title').evaluate((el) => el.textContent ?? '')).trim()
  await page.locator('.current-play').getByRole('button', { name: 'Delete' }).click()
  const confirmDelete = page.getByRole('dialog', { name: 'Delete this play?' })
  await expect(confirmDelete.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await confirmDelete.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Deleted. Tap Undo.')).toBeVisible()
  const toastBox = await page.locator('.toast').boundingBox()
  const copyBox = await page.getByRole('button', { name: 'Copy to another playbook' }).boundingBox()
  expect(toastBox).toBeTruthy()
  expect(copyBox).toBeTruthy()
  expect(overlaps(toastBox!, copyBox!)).toBe(false)
  await page.locator('.toast-undo').click()
  await expect(page.getByRole('dialog', { name: 'Plays' }).locator('.saved-open').filter({ hasText: doomed }).first()).toBeVisible()
  await closeSheet(page)
})

test('change password, sign out, and sign back in', async () => {
  await page.getByRole('button', { name: 'Your account' }).click()
  await page.getByRole('button', { name: 'Change password' }).click()
  const form = page.getByRole('dialog', { name: 'Change password' })
  await form.getByRole('textbox', { name: 'Old password', exact: true }).fill(password)
  await form.getByRole('textbox', { name: 'New password', exact: true }).fill(nextPassword)
  await form.getByRole('textbox', { name: 'Password again', exact: true }).fill(nextPassword)
  await form.getByRole('button', { name: 'Save password' }).click()
  await expect(page.getByText(`Signed in as`)).toBeVisible()
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.locator('button.avatar.guest')).toBeVisible()
  await expect(page.locator('.save-chip')).toHaveText('Saved')

  await page.getByRole('button', { name: 'Your account' }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in' })
  await signIn.getByLabel('Username').fill(username)
  await signIn.getByRole('textbox', { name: 'Password', exact: true }).fill(nextPassword)
  await signIn.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('.save-chip')).toContainText('Saved to your account', { timeout: 25_000 })
  await page.reload()
  await expect(page.locator('svg.field')).toBeVisible()
  await expect(page.locator('.save-chip')).toContainText('Saved to your account', { timeout: 25_000 })
  await expect(page.locator('button.avatar.guest')).toHaveCount(0)
})

test('delete account removes the login and returns to the welcome', async () => {
  await page.getByRole('button', { name: 'Your account', exact: true }).click()
  await page.getByRole('button', { name: 'Delete account' }).click()
  const ask = page.getByRole('dialog', { name: 'Delete account' })
  await expect(ask.getByText('gone forever')).toBeVisible()
  await expect(ask.getByRole('button', { name: 'Delete account' })).toBeDisabled()
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('dialog', { name: 'Your account' })).toBeVisible()
  await page.getByRole('button', { name: 'Delete account' }).click()
  await ask.getByLabel('Type your username').fill(username)
  await ask.getByRole('button', { name: 'Delete account' }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome' })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: 'Sign in' }).click()
  const signIn = page.getByRole('dialog', { name: 'Sign in' })
  await signIn.getByLabel('Username').fill(username)
  await signIn.getByRole('textbox', { name: 'Password', exact: true }).fill(nextPassword)
  await signIn.getByRole('button', { name: 'Sign in' }).click()
  await expect(signIn.getByRole('alert')).toBeVisible()
})

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

async function acceptClear(target: Page) {
  const ask = target.getByRole('dialog', { name: 'Clear the lines?' })
  try {
    await ask.waitFor({ state: 'visible', timeout: 1000 })
  } catch {
    return
  }
  await ask.getByRole('button', { name: 'Change it' }).click()
  await expect(ask).toBeHidden()
}

async function downloadBytes(click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60_000 }), click()])
  const stream = await download.createReadStream()
  if (!stream) throw new Error(`No file for ${download.suggestedFilename()}`)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}
