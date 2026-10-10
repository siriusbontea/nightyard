import { describe, expect, it } from 'vitest'
import { shareOrDownload } from './download'

describe('share or download', () => {
  const blob = new Blob(['%PDF-'], { type: 'application/pdf' })

  it('shares the file when the phone can share files', async () => {
    const shared: { files?: File[]; title?: string }[] = []
    const result = await shareOrDownload('Dawgs Playbook.pdf', blob, {
      canShare: () => true,
      share: async (data) => {
        shared.push(data)
      },
    }, () => {
      throw new Error('should share, not download')
    })
    expect(result).toBe('shared')
    expect(shared[0]?.files?.[0]?.name).toBe('Dawgs Playbook.pdf')
    expect(shared[0]?.title).toBe('Dawgs Playbook')
  })

  it('downloads when sharing files is not available', async () => {
    const files: string[] = []
    const result = await shareOrDownload('book.pdf', blob, { canShare: () => false }, (filename) => {
      files.push(filename)
    })
    expect(result).toBe('downloaded')
    expect(files).toEqual(['book.pdf'])
  })
})
