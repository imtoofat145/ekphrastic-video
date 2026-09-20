import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildVisitorSessionKey,
  resetTrackVisitorStartBootstrapForTests,
  trackVisitorStart
} from './trackingAdapter.js'

const VISIT_START_URL = 'https://cdn.ekphrastic.io/api/wf/track_visit_start'

describe('trackVisitorStart', () => {
  beforeEach(() => {
    resetTrackVisitorStartBootstrapForTests()
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetTrackVisitorStartBootstrapForTests()
  })

  it('posts uid, id, optional uaid without email by default', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ response: { analytics: 'visit-1' } }), { status: 200 })
    )

    await trackVisitorStart({
      uid: 'user-1',
      payloadListId: 'payload-1',
      uaid: 'existing-uaid'
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(VISIT_START_URL)
    expect(JSON.parse(String(init.body))).toEqual({
      uid: 'user-1',
      id: 'payload-1',
      uaid: 'existing-uaid'
    })
  })

  it('includes trimmed approved email when provided', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ response: { analytics: 'visit-email' } }), { status: 200 })
    )

    await trackVisitorStart({
      uid: 'user-1',
      payloadListId: 'payload-1',
      email: '  John.Smith@Acme.COM  '
    })

    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      uid: 'user-1',
      id: 'payload-1',
      email: 'John.Smith@Acme.COM'
    })
  })

  it('dedupes visit-start by asset/user bootstrap key, not email', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ response: { analytics: 'visit-dedup' } }), { status: 200 })
    )

    const first = await trackVisitorStart({
      uid: 'user-1',
      payloadListId: 'payload-1',
      email: 'a@b.com'
    })
    const second = await trackVisitorStart({
      uid: 'user-1',
      payloadListId: 'payload-1',
      email: 'c@d.com'
    })

    expect(first).toBe('visit-dedup')
    expect(second).toBe('visit-dedup')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('keeps visitor session cache key independent of email', () => {
    expect(
      buildVisitorSessionKey({ uid: 'u', payloadListId: 'p', uaid: 'x', modeTest: false })
    ).toBe('u:p:live:x')
  })
})
