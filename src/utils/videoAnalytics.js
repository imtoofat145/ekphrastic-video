import { track } from './analytics'

/**
 * @typedef {(
 *   | { type: 'VIDEO_OPENED'; assetId: string; duration: number }
 *   | { type: 'VIDEO_STARTED'; assetId: string; currentTime?: number; duration?: number }
 *   | { type: 'VIDEO_PAUSED'; assetId: string; currentTime?: number; duration?: number }
 *   | { type: 'VIDEO_RESUMED'; assetId: string; currentTime?: number; duration?: number }
 *   | { type: 'VIDEO_SEEKED'; assetId: string; currentTime?: number; duration?: number }
 *   | { type: 'VIDEO_PROGRESS_25'; assetId: string; currentTime?: number; duration?: number; percent: number }
 *   | { type: 'VIDEO_PROGRESS_50'; assetId: string; currentTime?: number; duration?: number; percent: number }
 *   | { type: 'VIDEO_PROGRESS_75'; assetId: string; currentTime?: number; duration?: number; percent: number }
 *   | { type: 'VIDEO_COMPLETED'; assetId: string; currentTime?: number; duration?: number }
 *   | { type: 'VIDEO_LOAD_ERROR'; assetId: string; error: string }
 * )} VideoViewerEvent
 */

const GA4_MAP = {
  VIDEO_OPENED: 'video_opened',
  VIDEO_STARTED: 'video_started',
  VIDEO_PAUSED: 'video_paused',
  VIDEO_RESUMED: 'video_resumed',
  VIDEO_SEEKED: 'video_seeked',
  VIDEO_PROGRESS_25: 'video_progress_25',
  VIDEO_PROGRESS_50: 'video_progress_50',
  VIDEO_PROGRESS_75: 'video_progress_75',
  VIDEO_COMPLETED: 'video_completed',
  VIDEO_LOAD_ERROR: 'video_load_error'
}

function buildGa4Payload(event) {
  const base = { asset_id: event.assetId }

  switch (event.type) {
    case 'VIDEO_OPENED':
      return { ...base, duration: event.duration }
    case 'VIDEO_STARTED':
    case 'VIDEO_PAUSED':
    case 'VIDEO_RESUMED':
    case 'VIDEO_SEEKED':
    case 'VIDEO_COMPLETED':
      return {
        ...base,
        current_time: event.currentTime,
        duration: event.duration
      }
    case 'VIDEO_PROGRESS_25':
    case 'VIDEO_PROGRESS_50':
    case 'VIDEO_PROGRESS_75':
      return {
        ...base,
        current_time: event.currentTime,
        duration: event.duration,
        percent: event.percent
      }
    case 'VIDEO_LOAD_ERROR':
      return { ...base, error: event.error }
    default:
      return base
  }
}

/**
 * Map viewer event to Ekphrastic track_events parts.
 * @param {VideoViewerEvent} event
 * @returns {string[] | null}
 */
export function videoEventToTrackParts(event) {
  switch (event.type) {
    case 'VIDEO_STARTED':
    case 'VIDEO_RESUMED':
      return ['Play', '1']
    case 'VIDEO_PAUSED':
      return ['Pause', '1']
    case 'VIDEO_COMPLETED':
      return ['Finished', '1']
    default:
      return null
  }
}

/**
 * Emit a video viewer event to the onEvent callback and GA4.
 * Ekphrastic track_events are sent from EkphrasticVideoViewer.jsx.
 * @param {VideoViewerEvent} event
 * @param {{ onEvent?: (event: VideoViewerEvent) => void }} options
 */
export function emitVideoEvent(event, options = {}) {
  const { onEvent } = options

  onEvent?.(event)

  const ga4Name = GA4_MAP[event.type]
  if (ga4Name) {
    track(ga4Name, buildGa4Payload(event))
  }
}

/**
 * @param {import('react').MutableRefObject<((event: VideoViewerEvent) => void) | undefined>} onEventRef
 * @param {VideoViewerEvent} event
 */
export function emitVideoEventRef(onEventRef, event) {
  emitVideoEvent(event, { onEvent: onEventRef.current })
}
