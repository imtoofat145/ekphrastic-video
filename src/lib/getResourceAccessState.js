const VIEWER_ASSET_KEY = 'assetpayload'
const MISSING_ID_MESSAGE = 'object with this id does not exist'

function isRecord(value) {
  return value != null && typeof value === 'object'
}

function readMessage(record) {
  const message = record.message
  return typeof message === 'string' ? message : ''
}

function readStatus(record) {
  const status = record.status
  return typeof status === 'string' ? status : null
}

function getEnvelope(json) {
  if (!isRecord(json)) return null
  if (isRecord(json.body) && 'status' in json.body) return json.body
  return json
}

function getEnvelopeResponse(json) {
  const envelope = getEnvelope(json)
  if (!envelope || !isRecord(envelope.response)) return null
  return envelope.response
}

function getEnvelopeAsset(json) {
  const response = getEnvelopeResponse(json)
  if (!response || !isRecord(response[VIEWER_ASSET_KEY])) return null
  return response[VIEWER_ASSET_KEY]
}

function isMissingDataResponse(json, httpStatus) {
  if (!isRecord(json)) return false

  const body = isRecord(json.body) ? json.body : json
  const status = readStatus(body) ?? readStatus(json)
  const message = `${readMessage(body)} ${readMessage(json)}`.trim()

  if (status === 'MISSING_DATA') return true
  if (message.toLowerCase().includes(MISSING_ID_MESSAGE)) return true
  if (httpStatus === 400 && status === 'MISSING_DATA') return true

  return false
}

export function isSuccessfulViewerEnvelope(json) {
  const envelope = getEnvelope(json)
  if (!envelope || envelope.status !== 'success') return false

  const asset = getEnvelopeAsset(json)
  if (!asset) return false

  const id = asset._id
  return typeof id === 'string' && id.trim() !== ''
}

export function getResourceAccessState(input) {
  if (isMissingDataResponse(input.json, input.httpStatus)) {
    return 'not-found'
  }

  if (input.resource?.published === false) {
    return 'unavailable'
  }

  return null
}

export function resolveViewerAccessState(input) {
  const envelopeAsset = getEnvelopeAsset(input.json)
  const resource =
    input.resource ??
    (envelopeAsset?.published === false ? { published: false } : null)

  if (resource?.published === false) {
    return 'unavailable'
  }

  const explicit = getResourceAccessState({
    httpStatus: input.httpStatus,
    json: input.json,
    resource
  })
  if (explicit === 'not-found' || explicit === 'unavailable') {
    return explicit
  }

  if (input.parseSucceeded === false) {
    return 'not-found'
  }

  if (input.json == null) {
    return 'not-found'
  }

  if (!isSuccessfulViewerEnvelope(input.json)) {
    return 'not-found'
  }

  return null
}
