import { mkdir } from 'node:fs/promises'
import sharp from 'sharp'

const anyIcon = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0b1220"/>
  <rect x="64" y="118" width="384" height="276" rx="28" fill="#165a33"/>
  <rect x="64" y="118" width="384" height="78" fill="#0e3a2c"/>
  <path d="M64 286h384" stroke="#2ee6c8" stroke-width="14" />
  <polygon points="256,196 312,268 256,324 200,268" fill="#f0c14a"/>
</svg>`

const maskable = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0b1220"/>
  <rect x="86" y="150" width="340" height="230" rx="24" fill="#165a33"/>
  <rect x="86" y="150" width="340" height="64" fill="#0e3a2c"/>
  <path d="M86 292h340" stroke="#2ee6c8" stroke-width="16"/>
  <polygon points="256,214 304,276 256,322 208,276" fill="#f0c14a"/>
</svg>`

await mkdir('public/icons', { recursive: true })
await sharp(Buffer.from(anyIcon(192))).png().toFile('public/icons/icon-192.png')
await sharp(Buffer.from(anyIcon(512))).png().toFile('public/icons/icon-512.png')
await sharp(Buffer.from(maskable)).png().toFile('public/icons/icon-maskable-512.png')
await sharp(Buffer.from(anyIcon(180))).resize(180, 180).png().toFile('public/icons/apple-touch-icon.png')
console.log('icons written')
