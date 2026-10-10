export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(filename: string, text: string): void {
  downloadBlob(filename, new Blob([text], { type: 'application/json' }))
}

export interface ShareTarget {
  share?: (data: { files?: File[]; title?: string }) => Promise<void>
  canShare?: (data: { files?: File[] }) => boolean
}

/** Share the file when the phone offers it (iOS). Otherwise download it. */
export async function shareOrDownload(
  filename: string,
  blob: Blob,
  target: ShareTarget = navigator,
  download: (filename: string, blob: Blob) => void = downloadBlob,
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type || 'application/pdf' })
  if (typeof target.canShare === 'function' && target.canShare({ files: [file] }) && typeof target.share === 'function') {
    await target.share({ files: [file], title: filename.replace(/\.pdf$/i, '') })
    return 'shared'
  }
  download(filename, blob)
  return 'downloaded'
}
