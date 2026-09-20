import { describe, expect, it } from 'vitest'
import { shouldDeferTrackVisitorStart } from './videoVisitorAnalytics.js'

describe('shouldDeferTrackVisitorStart', () => {
  it('defers until asset tracking context is ready', () => {
    expect(
      shouldDeferTrackVisitorStart({
        assetTrackingReady: false,
        awaitingEmailGate: false,
        approvedAccessEmail: null
      })
    ).toBe(true)
  })

  it('does not defer public/password when asset is ready', () => {
    expect(
      shouldDeferTrackVisitorStart({
        assetTrackingReady: true,
        awaitingEmailGate: false,
        approvedAccessEmail: null
      })
    ).toBe(false)
  })

  it('defers email-gated visit-start until approved email exists', () => {
    expect(
      shouldDeferTrackVisitorStart({
        assetTrackingReady: true,
        awaitingEmailGate: true,
        approvedAccessEmail: null
      })
    ).toBe(true)

    expect(
      shouldDeferTrackVisitorStart({
        assetTrackingReady: true,
        awaitingEmailGate: true,
        approvedAccessEmail: '  Person@Acme.com  '
      })
    ).toBe(false)
  })
})
