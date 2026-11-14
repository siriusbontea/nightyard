import dmRegularUrl from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url'
import dmBoldUrl from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url'
import oswaldUrl from '@fontsource/oswald/files/oswald-latin-600-normal.woff2?url'
import graduateUrl from '@fontsource/graduate/files/graduate-latin-400-normal.woff2?url'
import { END_ZONE_COLOR, END_ZONE_LINE } from './endZoneArt'
import { EXPORT_H, EXPORT_W, renderExportSvg, type ExportStyle } from './exportSvg'
import type { Play } from './types'

let fontCssPromise: Promise<string> | null = null

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function fontCss(): Promise<string> {
  if (!fontCssPromise) {
    fontCssPromise = (async () => {
      const [regular, bold, display, graduate] = await Promise.all([
        fetch(dmRegularUrl).then((response) => response.arrayBuffer()),
        fetch(dmBoldUrl).then((response) => response.arrayBuffer()),
        fetch(oswaldUrl).then((response) => response.arrayBuffer()),
        fetch(graduateUrl).then((response) => response.arrayBuffer()),
      ])
      return `
        @font-face { font-family: 'DM Sans'; src: url(data:font/woff2;base64,${toBase64(regular)}) format('woff2'); font-weight: 400; font-style: normal; }
        @font-face { font-family: 'DM Sans'; src: url(data:font/woff2;base64,${toBase64(bold)}) format('woff2'); font-weight: 700; font-style: normal; }
        @font-face { font-family: 'Oswald'; src: url(data:font/woff2;base64,${toBase64(display)}) format('woff2'); font-weight: 600; font-style: normal; }
        @font-face { font-family: 'Graduate'; src: url(data:font/woff2;base64,${toBase64(graduate)}) format('woff2'); font-weight: 400; font-style: normal; }
      `
    })()
  }
  return fontCssPromise
}

async function inlineEndZoneArt(svg: string): Promise<string> {
  let next = svg
  for (const url of [END_ZONE_COLOR, END_ZONE_LINE]) {
    if (!next.includes(url)) continue
    const buffer = await fetch(url).then((response) => {
      if (!response.ok) throw new Error('Could not load the end zone art.')
      return response.arrayBuffer()
    })
    const mime = url.endsWith('.webp') ? 'image/webp' : 'image/png'
    next = next.split(url).join(`data:${mime};base64,${toBase64(buffer)}`)
  }
  return next
}

export async function renderPng(
  play: Play,
  style: ExportStyle,
  options: { includeNotes: boolean; includeAssignments: boolean; byline?: string },
): Promise<Blob> {
  let css = ''
  try {
    css = await fontCss()
  } catch {
    css = ''
  }
  const svg = await inlineEndZoneArt(renderExportSvg(play, style, { ...options, fontCss: css }))
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'sync'
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not draw the export.'))
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = EXPORT_W
    canvas.height = EXPORT_H
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')
    context.drawImage(image, 0, 0, EXPORT_W, EXPORT_H)
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!png) throw new Error('Could not encode the PNG.')
    return png
  } finally {
    URL.revokeObjectURL(url)
  }
}
