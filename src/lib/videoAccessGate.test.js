import { describe, expect, it } from 'vitest'
import { resolveVideoAccessFromAssetMeta } from './videoAccessGate.js'

describe('resolveVideoAccessFromAssetMeta', () => {
  it('returns public when no protection flags', () => {
    expect(resolveVideoAccessFromAssetMeta({})).toEqual({ kind: 'public' })
  })

  it('returns gated password with payload_list id', () => {
    expect(
      resolveVideoAccessFromAssetMeta({ protected: true, payload_list: 'list-1' })
    ).toEqual({
      kind: 'gated',
      gate: 'password',
      payloadListId: 'list-1'
    })
  })

  it('returns gated email', () => {
    expect(
      resolveVideoAccessFromAssetMeta({ protected_email: true, payload_list: 'list-2' })
    ).toEqual({
      kind: 'gated',
      gate: 'email',
      payloadListId: 'list-2'
    })
  })

  it('fails closed when both flags are true', () => {
    expect(
      resolveVideoAccessFromAssetMeta({
        protected: true,
        protected_email: true,
        payload_list: 'list-3'
      })
    ).toEqual({ kind: 'misconfigured' })
  })

  it('fails closed when gated without payload_list', () => {
    expect(resolveVideoAccessFromAssetMeta({ protected: true })).toEqual({
      kind: 'misconfigured'
    })
  })
})
