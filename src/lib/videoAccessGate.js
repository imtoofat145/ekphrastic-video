import {
  gateRequiresPayloadList,
  readProtectionMetadata,
  resolveProtectedAccessGate
} from '../../shared/asset-access/index.js'

/**
 * Resolve access gate for a loaded video asset.
 * @param {Record<string, unknown> | null | undefined} assetMeta
 */
export function resolveVideoAccessFromAssetMeta(assetMeta) {
  const protection = readProtectionMetadata(assetMeta)
  const gate = resolveProtectedAccessGate(protection)

  if (gate === 'misconfigured') {
    return { kind: 'misconfigured' }
  }

  if (gateRequiresPayloadList(gate) && protection.payloadListId === null) {
    return { kind: 'misconfigured' }
  }

  if (gate === 'none') {
    return { kind: 'public' }
  }

  return {
    kind: 'gated',
    gate,
    payloadListId: protection.payloadListId
  }
}

