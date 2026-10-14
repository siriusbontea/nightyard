import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Twemoji 14.0.2 football (U+1F3C8), CC-BY 4.0. See scripts/emoji/LICENSE.txt. */
const emojiPath = join(dirname(fileURLToPath(import.meta.url)), 'emoji', '1f3c8.svg')
const BG = { r: 0x19, g: 0x19, b: 0x19, alpha: 1 }

async function icon(size, paddingRatio) {
  const inner = Math.max(1, Math.round(size * (1 - paddingRatio * 2)))
  const glyph = await sharp(await readFile(emojiPath))
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: glyph, gravity: 'centre' }])
    .png()
    .toBuffer()
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
await mkdir(join(out, 'icons'), { recursive: true })

const files = [
  ['icons/icon-192.png', 192, 0.14],
  ['icons/icon-512.png', 512, 0.14],
  ['icons/icon-maskable-192.png', 192, 0.22],
  ['icons/icon-maskable-512.png', 512, 0.22],
  ['icons/apple-touch-icon.png', 180, 0.16],
  ['favicon-32.png', 32, 0.08],
  ['favicon-16.png', 16, 0.06],
]

for (const [name, size, pad] of files) {
  const png = await icon(size, pad)
  const meta = await sharp(png).metadata()
  if (meta.width !== size || meta.height !== size) {
    throw new Error(`${name} is ${meta.width}x${meta.height}`)
  }
  await sharp(png).toFile(join(out, name))
}

console.log('football icons written')
