/**
 * Whether track_visit_start should wait (Viewer email-gate parity).
 * @param {{ assetTrackingReady: boolean, awaitingEmailGate: boolean, approvedAccessEmail?: string | null }} input
 */
export function shouldDeferTrackVisitorStart(input) {
  if (input.assetTrackingReady !== true) {
    return true
  }
  if (input.awaitingEmailGate === true) {
    const trimmed = input.approvedAccessEmail?.trim()
    if (!trimmed) {
      return true
    }
  }
  return false
}
