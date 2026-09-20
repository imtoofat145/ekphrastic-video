import { fetchWithTimeout, isAbortError, parseJsonSafe } from './api'

const TRACK_VISITOR_START_BASE =
  import.meta.env.VITE_TRACK_VISITOR_START_URL ||
  'https://cdn.ekphrastic.io/api/wf/track_visit_start'

const TRACK_EVENTS_BASE =
  import.meta.env.VITE_TRACK_EVENTS_URL ||
  'https://cdn.ekphrastic.io/api/wf/track_events'

const FETCH_TIMEOUT_MS = 30000

/** @type {Map<string, Promise<string|null>>} */
const visitorStartInflight = new Map()

/** One handshake per asset/user (Viewer parity — email is not part of this key). */
let visitStartBootstrapKey = null
let visitStartBootstrapSessionId = null

/** @internal test reset */
export function resetTrackVisitorStartBootstrapForTests() {
  visitStartBootstrapKey = null
  visitStartBootstrapSessionId = null
  visitorStartInflight.clear()
}

function buildVisitStartBootstrapKey(uid, payloadListId) {
  return `${String(payloadListId).trim()}:${String(uid).trim()}`
}

function buildApiUrl(base, modeTest = false) {
  if (!modeTest) return base
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}mode=test`
}

function extractAnalyticsId(json) {
  const envelope =
    json?.body && typeof json.body === 'object' && 'status' in json.body ? json.body : json

  const response = envelope?.response ?? envelope?.body?.response ?? envelope
  const analytics = response?.analytics

  if (typeof analytics === 'string' && analytics.trim()) {
    return analytics.trim()
  }
  if (analytics && typeof analytics === 'object' && analytics._id != null) {
    return String(analytics._id).trim()
  }

  const id =
    response?.analytics_id ??
    response?.analyticsId ??
    response?.id ??
    envelope?.id ??
    null
  return id != null ? String(id).trim() : null
}

export function buildVisitorSessionKey({ uid, payloadListId, uaid, modeTest }) {
  const visitorUid = String(uid).trim()
  const payloadId = String(payloadListId).trim()
  const sessionUaid = uaid && String(uaid).trim() ? String(uaid).trim() : ''
  return `${visitorUid}:${payloadId}:${modeTest ? 'test' : 'live'}:${sessionUaid}`
}

/** Allow a fresh track_visit_start after a rejected analytics session. */
export function invalidateVisitorSession(sessionKey) {
  if (sessionKey) {
    visitorStartInflight.delete(sessionKey)
  }
  visitStartBootstrapKey = null
  visitStartBootstrapSessionId = null
}

async function postWorkflow(apiUrl, contentType, body, signal) {
  return fetchWithTimeout(
    apiUrl,
    {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
      signal
    },
    FETCH_TIMEOUT_MS
  )
}

async function trackVisitorStartRequest({ uid, payloadListId, uaid, email, modeTest, signal }) {
  const visitorUid = String(uid).trim()
  const payloadId = String(payloadListId).trim()
  if (!visitorUid || !payloadId) return null

  if (signal?.aborted) return null

  const apiUrl = buildApiUrl(TRACK_VISITOR_START_BASE, modeTest)
  const jsonBody = { uid: visitorUid, id: payloadId }
  if (uaid && String(uaid).trim()) {
    jsonBody.uaid = String(uaid).trim()
  }
  const trimmedEmail = email?.trim()
  if (trimmedEmail) {
    jsonBody.email = trimmedEmail
  }

  let response = await postWorkflow(
    apiUrl,
    'application/json',
    JSON.stringify(jsonBody),
    signal
  )

  if (!response.ok && response.status >= 400 && response.status < 500) {
    const params = new URLSearchParams({ uid: visitorUid, id: payloadId })
    if (uaid?.trim()) params.set('uaid', String(uaid).trim())
    response = await postWorkflow(
      apiUrl,
      'application/x-www-form-urlencoded',
      params.toString(),
      signal
    )
  }

  if (!response.ok) {
    console.warn('track_visitor_start failed:', response.status, response.statusText)
    return uaid?.trim() ? String(uaid).trim() : null
  }

  try {
    const json = await parseJsonSafe(response, 'track_visitor_start')
    const id = extractAnalyticsId(json)
    if (id != null) return String(id)
  } catch (e) {
    console.warn('track_visitor_start parse error:', e)
  }

  return uaid?.trim() ? String(uaid).trim() : null
}

/**
 * Register visitor session when uid is present in the viewer URL.
 * @returns {Promise<string|null>} analytics session id
 */
export async function trackVisitorStart({
  uid,
  payloadListId,
  uaid,
  email,
  modeTest = false,
  signal
}) {
  const bootstrapKey = buildVisitStartBootstrapKey(uid, payloadListId)
  if (visitStartBootstrapKey === bootstrapKey && visitStartBootstrapSessionId != null) {
    return visitStartBootstrapSessionId
  }

  const cacheKey = buildVisitorSessionKey({ uid, payloadListId, uaid, modeTest })

  const inflight = visitorStartInflight.get(cacheKey)
  if (inflight) return inflight

  if (signal?.aborted) return null

  const request = trackVisitorStartRequest({
    uid,
    payloadListId,
    uaid,
    email,
    modeTest,
    signal: undefined
  })
    .then((sessionId) => {
      if (sessionId != null) {
        visitStartBootstrapKey = bootstrapKey
        visitStartBootstrapSessionId = sessionId
      }
      return sessionId
    })
    .catch((err) => {
      if (isAbortError(err)) return null
      throw err
    })
    .finally(() => {
      visitorStartInflight.delete(cacheKey)
    })

  visitorStartInflight.set(cacheKey, request)
  return request
}

/**
 * Build track_events body: analytics session id + evt as colon-delimited string.
 *
 * evt formats (video viewer — mirrors PDF/swiper shared vocabulary):
 * - Play:<n> — playback started or resumed
 * - Pause:<n> — playback paused
 * - Finished:<n> — video completed
 * - Time:15 — heartbeat (15s)
 * - Author:<n> — presenter About panel opened
 * - Info:<n> — presentation info panel opened
 * - Report:<n> — download button clicked
 */
export function buildTrackEventBody(analyticsId, parts) {
  return {
    analytics: String(analyticsId).trim(),
    evt: parts.map(String).join(':')
  }
}

/**
 * POST tracking event to track_events workflow.
 * @param {{ onSessionInvalid?: () => void }} [options]
 */
export function trackEvent(fields, modeTest = false, options = {}) {
  const apiUrl = buildApiUrl(TRACK_EVENTS_BASE, modeTest)

  return fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields)
  })
    .then((res) => {
      if (!res.ok) {
        console.warn('track_events error:', res.status, res.statusText, fields.evt)
        if (res.status === 400 && options.onSessionInvalid) {
          options.onSessionInvalid()
        }
      }
      return res
    })
    .catch((err) => {
      console.warn('track_events error:', err)
      return null
    })
}
