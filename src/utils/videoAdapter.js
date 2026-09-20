import { resolveViewerAccessState } from '../lib/getResourceAccessState.js'
import { ResourceAccessError, isResourceAccessError } from '../lib/resourceAccessError.js'
import { fetchWithTimeout, isAbortError, parseJsonSafe } from './api'

const VIDEO_API_BASE =
  import.meta.env.VITE_VIDEO_API_URL || 'https://cdn.ekphrastic.io/api/wf/video'

const FETCH_TIMEOUT_MS = 30000

/** @type {Map<string, Promise<ReturnType<typeof parseVideoResponse>>>} */
const videoAssetInflight = new Map()

function buildVideoApiUrl(modeTest = false) {
  if (!modeTest) return VIDEO_API_BASE
  const separator = VIDEO_API_BASE.includes('?') ? '&' : '?'
  return `${VIDEO_API_BASE}${separator}mode=test`
}

function pickString(obj, keys) {
  for (const key of keys) {
    const val = obj[key]
    if (val != null && typeof val === 'string' && val.trim()) {
      return val.trim()
    }
  }
  return null
}

function pickMediaUrl(obj, keys) {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'string') {
      const normalized = normalizeMediaUrl(val)
      if (normalized) return normalized
    }
    if (val && typeof val === 'object' && typeof val.url === 'string') {
      const normalized = normalizeMediaUrl(val.url)
      if (normalized) return normalized
    }
  }
  return null
}

function normalizeExternalUrl(url) {
  if (!url || typeof url !== 'string') return null
  let trimmed = url.trim()
  if (!trimmed || /^javascript:/i.test(trimmed)) return null

  if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`
  } else if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`
  }

  if (!/^https?:\/\//i.test(trimmed)) return null
  return trimmed
}

/**
 * Normalize presenter/author from API response.
 */
export function normalizePresenter(presenter) {
  if (!presenter || typeof presenter !== 'object') return null

  const firstName = pickString(presenter, ['first_name', 'firstname'])
  const lastName = pickString(presenter, ['last_name', 'lastname'])
  const name =
    pickString(presenter, ['name', 'full_name']) ||
    [firstName, lastName].filter(Boolean).join(' ') ||
    null
  const title = pickString(presenter, ['title', 'job_title', 'role'])
  const company = pickString(presenter, ['company', 'Company', 'organization', 'org'])
  const avatarUrl = pickMediaUrl(presenter, [
    'profile_picture',
    'photo',
    'avatar',
    'profile_image',
    'picture'
  ])
  const website = normalizeExternalUrl(
    pickString(presenter, ['website', 'website_url', 'url'])
  )
  const email = pickString(presenter, ['email'])
  const linkedin = normalizeExternalUrl(
    pickString(presenter, ['linkedin', 'linkedin_url'])
  )
  const contact = pickString(presenter, ['contact', 'phone', 'phone_number'])
  const bio = pickString(presenter, ['bio', 'biography', 'description'])

  const hasContent = [name, title, company, avatarUrl, website, email, linkedin, contact, bio].some(
    Boolean
  )
  if (!hasContent) return null

  return { name, title, company, avatarUrl, website, email, linkedin, contact, bio }
}

function normalizeMediaUrl(url) {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed || /^javascript:/i.test(trimmed)) return null
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('/')) return `https:${trimmed}`
  return trimmed
}

function extractPresenterGa4(presenter) {
  if (!presenter || typeof presenter !== 'object') return null
  const id =
    presenter.G4A ??
    presenter.g4a ??
    presenter.ga_measurement_id ??
    presenter.measurement_id
  if (id && typeof id === 'string' && id.trim()) {
    return id.trim()
  }
  return null
}

function stripTitleSuffix(name) {
  if (!name || typeof name !== 'string') return ''
  return name.split('||')[0].trim()
}

function parseHexColor(value) {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^#[0-9A-Fa-f]{3,8}$/.test(trimmed)) return null
  return trimmed
}

function extractVideoUrl(asset) {
  const firstLink = Array.isArray(asset.links) ? asset.links[0] : null
  if (!firstLink || typeof firstLink !== 'string' || !firstLink.trim()) {
    return null
  }

  let url = firstLink.trim()
  if (url.startsWith('//')) {
    url = `https:${url}`
  }

  return normalizeMediaUrl(url)
}

function extractPosterUrl(asset) {
  return pickMediaUrl(asset, ['poster', 'poster_url', 'thumbnail', 'hero_image'])
}

function extractDownloadInfo(asset) {
  if (!asset?.report_on) {
    return { downloadEnabled: false, downloadUrl: null }
  }

  const videoUrl = extractVideoUrl(asset)
  if (!videoUrl) {
    return { downloadEnabled: false, downloadUrl: null }
  }

  return { downloadEnabled: true, downloadUrl: videoUrl }
}

function extractAssetId(response, asset, payloadListId) {
  const fromAsset =
    asset?._id ??
    asset?.id ??
    asset?.asset_id ??
    asset?.assetId ??
    response?.asset_id ??
    response?.assetId ??
    null

  if (fromAsset != null && String(fromAsset).trim()) {
    return String(fromAsset).trim()
  }

  return String(payloadListId).trim()
}

/**
 * Parse Bubble video workflow response.
 * Handles { body: { status, response } } envelope shape.
 */
export function parseVideoResponse(json, payloadListId = '') {
  const envelope =
    json?.body && typeof json.body === 'object' && 'status' in json.body ? json.body : json

  if (envelope?.status !== 'success') {
    throw new ResourceAccessError('not-found')
  }

  const response = envelope.response
  if (!response) {
    throw new ResourceAccessError('not-found')
  }

  const asset = response.assetpayload ?? {}

  if (!asset._id?.trim?.()) {
    throw new ResourceAccessError('not-found')
  }

  if (asset.published === false) {
    throw new ResourceAccessError('unavailable')
  }

  const videoUrl = extractVideoUrl(asset)
  const { downloadEnabled, downloadUrl } = extractDownloadInfo(asset)

  if (!videoUrl) {
    throw new ResourceAccessError('not-found')
  }

  return {
    videoUrl,
    downloadEnabled,
    downloadUrl,
    posterUrl: extractPosterUrl(asset),
    assetId: extractAssetId(response, asset, payloadListId),
    fileName: stripTitleSuffix(asset.name),
    heroImage: normalizeMediaUrl(asset.hero_image),
    logoUrl: pickMediaUrl(asset, ['logo_image']),
    displayAuthor: asset.display_author === true,
    presenter: normalizePresenter(response.presenter),
    description: pickString(asset, ['description', 'presentation_description', 'summary']),
    presenterGa4: extractPresenterGa4(response.presenter),
    functionColor: parseHexColor(asset.function_color),
    themeColor: parseHexColor(asset.theme_color),
    assetMeta: asset
  }
}

async function postVideoAsset(apiUrl, contentType, body, signal) {
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

async function tryParseResponseJson(response) {
  try {
    const json = await response.json()
    return { json: json ?? {}, parseSucceeded: true }
  } catch {
    return { json: null, parseSucceeded: false }
  }
}

async function fetchVideoAssetRequest(payloadListId, options = {}) {
  const id = String(payloadListId).trim()
  if (!id) {
    throw new ResourceAccessError('not-found')
  }

  const { modeTest = false, signal } = options
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  const apiUrl = buildVideoApiUrl(modeTest === true)

  let response = await postVideoAsset(
    apiUrl,
    'application/json',
    JSON.stringify({ Payloadlist: id }),
    signal
  )

  if (!response.ok && response.status >= 400 && response.status < 500) {
    response = await postVideoAsset(
      apiUrl,
      'application/x-www-form-urlencoded',
      new URLSearchParams({ Payloadlist: id }).toString(),
      signal
    )
  }

  if (!response.ok) {
    const { json: errorJson, parseSucceeded } = await tryParseResponseJson(response)
    const accessState =
      resolveViewerAccessState({
        httpStatus: response.status,
        json: errorJson,
        parseSucceeded
      }) ?? 'not-found'
    throw new ResourceAccessError(accessState)
  }

  let json
  try {
    json = await parseJsonSafe(response, 'video')
  } catch {
    throw new ResourceAccessError('not-found')
  }

  try {
    return parseVideoResponse(json, id)
  } catch (err) {
    if (isResourceAccessError(err)) throw err
    throw new ResourceAccessError('not-found')
  }
}

/**
 * Fetch video asset by Payloadlist id (POST to video workflow).
 * Dedupes in-flight requests per attachment id (StrictMode-safe).
 * @param {string} payloadListId — value from ?id= URL parameter
 * @param {{ modeTest?: boolean, signal?: AbortSignal }} [options]
 */
export async function fetchVideoAsset(payloadListId, options = {}) {
  const id = String(payloadListId).trim()
  if (!id) {
    throw new ResourceAccessError('not-found')
  }

  const cacheKey = `${id}:${options.modeTest === true ? 'test' : 'live'}`
  const inflight = videoAssetInflight.get(cacheKey)
  if (inflight) return inflight

  if (options.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }

  // Shared in-flight request is not tied to effect abort (StrictMode-safe).
  const request = fetchVideoAssetRequest(id, { modeTest: options.modeTest })
    .finally(() => {
      videoAssetInflight.delete(cacheKey)
    })

  videoAssetInflight.set(cacheKey, request)
  return request
}
