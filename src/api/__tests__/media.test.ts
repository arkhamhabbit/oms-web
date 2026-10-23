import { afterEach, describe, expect, it, vi } from 'vitest'

import { mediaKindOf, putToSignedUrl } from '@/api/media'
import { pickedFromRef } from '@/components/media/MediaPicker'

describe('mediaKindOf', () => {
  it('files images and videos, and refuses anything else', () => {
    expect(mediaKindOf('image/png')).toBe('IMAGE')
    expect(mediaKindOf('video/mp4')).toBe('VIDEO')
    expect(mediaKindOf('text/plain')).toBeUndefined()
    expect(mediaKindOf('')).toBeUndefined()
  })
})

describe('pickedFromRef', () => {
  it('gives no library id for a legacy URL or for nothing', () => {
    expect(pickedFromRef(undefined)).toBeNull()
    expect(pickedFromRef({ legacy: true, url: 'https://old/x.png' })).toBeNull()
    expect(pickedFromRef({ mediaId: 'm1', thumbUrl: 't' })?.id).toBe('m1')
  })
})

describe('putToSignedUrl', () => {
  const sent: { method: string; url: string; headers: Record<string, string> }[] = []

  class FakeXhr {
    upload: {
      onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void
    } = {}
    status = 200
    onload?: () => void
    onerror?: () => void
    onabort?: () => void
    private record = { method: '', url: '', headers: {} as Record<string, string> }
    open(method: string, url: string) {
      this.record.method = method
      this.record.url = url
    }
    setRequestHeader(name: string, value: string) {
      this.record.headers[name] = value
    }
    send() {
      sent.push(this.record)
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
      this.onload?.()
    }
    abort() {}
  }

  afterEach(() => {
    sent.length = 0
    vi.unstubAllGlobals()
  })

  it('sends the issued method and exactly the issued headers — no cookie, no CSRF header', async () => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    const progress = vi.fn()
    await putToSignedUrl(
      { url: 'https://bucket/obj?sig=1', method: 'PUT', headers: { 'Content-Type': 'image/png' } },
      new Blob(['x']),
      progress
    )
    expect(sent).toEqual([
      { method: 'PUT', url: 'https://bucket/obj?sig=1', headers: { 'Content-Type': 'image/png' } },
    ])
    expect(progress).toHaveBeenCalledWith(0.5)
    expect(progress).toHaveBeenLastCalledWith(1)
  })

  it('names CORS when the browser blocks the request', async () => {
    class Blocked extends FakeXhr {
      send() {
        this.onerror?.()
      }
    }
    vi.stubGlobal('XMLHttpRequest', Blocked)
    await expect(putToSignedUrl({ url: 'https://bucket/obj' }, new Blob(['x']))).rejects.toThrow(
      /CORS/
    )
  })
})
