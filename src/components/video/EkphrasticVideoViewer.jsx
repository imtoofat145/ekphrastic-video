import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { MediaPlayer, MediaProvider } from '@vidstack/react'
import '@vidstack/react/player/styles/default/theme.css'
import '@vidstack/react/player/styles/default/layouts/video.css'
import { ResourceAccessState } from '../access-state/ResourceAccessState'
import SideDrawer from '../SideDrawer'
import AboutPanel from '../AboutPanel'
import PresentationInfoPanel from '../PresentationInfoPanel'
import { buildTrackEventBody, trackEvent } from '../../utils/trackingAdapter'
import { getDownloadFilename } from '../../utils/api'
import { emitVideoEventRef, videoEventToTrackParts } from '../../utils/videoAnalytics'
import VideoPlayerControls from './VideoPlayerControls'
import VideoToolbar from './VideoToolbar'
import './video-player.css'

/** StrictMode-safe: one open analytics burst per videoUrl per tab session */
const videoOpenedKeys = new Set()
/** StrictMode-safe: one start analytics burst per videoUrl per tab session */
const videoStartedKeys = new Set()
/** StrictMode-safe: one complete analytics burst per videoUrl per tab session */
const videoCompletedKeys = new Set()

const PROGRESS_THRESHOLDS = [
  { percent: 25, type: 'VIDEO_PROGRESS_25' },
  { percent: 50, type: 'VIDEO_PROGRESS_50' },
  { percent: 75, type: 'VIDEO_PROGRESS_75' }
]

const DOWNLOAD_TIMEOUT_MS = 300000

function resolveVideoDownloadFilename(xhr, fileName) {
  const fallback = fileName?.trim() || document.title?.trim() || 'video'
  let name = getDownloadFilename(xhr, fallback)
  if (!/\.[a-z0-9]{2,5}$/i.test(name)) {
    name = `${name}.mp4`
  }
  return name
}

function presentationThemeStyle(functionColor, themeColor) {
  const style = {}
  if (functionColor) style['--control-theme'] = functionColor
  if (themeColor) style['--viewer-theme'] = themeColor
  return Object.keys(style).length > 0 ? style : undefined
}

function sessionKey(videoUrl, assetId) {
  return `${assetId}::${videoUrl}`
}

function readPlayerTimes(playerRef) {
  const player = playerRef.current
  if (!player) {
    return { currentTime: undefined, duration: undefined }
  }

  const duration = Number.isFinite(player.duration) ? player.duration : undefined
  const currentTime = Number.isFinite(player.currentTime) ? player.currentTime : undefined

  return { currentTime, duration }
}

function buildEventBase(assetId, playerRef) {
  const { currentTime, duration } = readPlayerTimes(playerRef)
  return {
    assetId,
    currentTime,
    duration,
    percent:
      duration && duration > 0 && currentTime != null
        ? Math.round((currentTime / duration) * 100)
        : undefined
  }
}

function exitDocumentFullscreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen()
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen()
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullScreen()
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen()
  }
}

function EkphrasticVideoViewer({
  videoUrl,
  posterUrl = null,
  assetId,
  fileName = null,
  presenter = null,
  displayAuthor = false,
  description = null,
  heroImage = null,
  downloadEnabled = false,
  downloadUrl = null,
  uid = null,
  analyticsId = null,
  analyticsSessionReady = false,
  onAnalyticsSessionInvalid,
  functionColor = null,
  themeColor = null,
  className = '',
  onEvent,
  onError,
  modeTest = false
}) {
  const [searchParams] = useSearchParams()
  const isDarkMode = searchParams.get('dark') === 'true'
  const isModalMode = searchParams.get('modal') === 'yes'
  const isCollectionMode = searchParams.get('collection') === 'yes'
  const showBackIcon =
    !isModalMode &&
    (searchParams.get('preview') === 'yes' || isCollectionMode)
  const backIconLabel = isCollectionMode ? 'Back to Collection' : 'Close preview'

  const playerRef = useRef(null)
  const onEventRef = useRef(onEvent)
  const onErrorRef = useRef(onError)
  const analyticsIdRef = useRef(analyticsId)

  const hasPausedRef = useRef(false)
  const milestonesRef = useRef({ 25: false, 50: false, 75: false })
  const sourceChangingRef = useRef(true)
  const userInteractingRef = useRef(false)
  const openedForUrlRef = useRef(null)
  const startedForUrlRef = useRef(null)
  const completedForUrlRef = useRef(null)
  const pendingTrackPartsRef = useRef([])
  const postTrackEventRef = useRef(null)

  const [mediaReady, setMediaReady] = useState(false)
  const [playerAccessState, setPlayerAccessState] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState('about')
  const [drawerEverOpened, setDrawerEverOpened] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(null)
  const [downloadError, setDownloadError] = useState(null)
  const downloadAbortRef = useRef(null)

  const title = fileName?.trim() || 'Video'
  const showAuthor = displayAuthor && presenter != null
  const showPresentationInfo = Boolean(description?.trim())
  const resolvedControlTheme = functionColor ?? (isDarkMode ? '#f5f5f5' : '#1a1a1a')
  const themeStyle = presentationThemeStyle(functionColor, themeColor)
  const trackingActive = Boolean(uid?.trim() && analyticsId && analyticsSessionReady)
  const shellClassName = [
    'video-viewer-shell',
    !mediaReady ? 'video-viewer-shell--loading' : '',
    themeColor ? 'viewer-container-bg-themed' : '',
    themeStyle ? 'video-viewer-shell--themed' : '',
    className
  ]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    analyticsIdRef.current = analyticsId
  }, [analyticsId])

  const resetSessionState = useCallback(() => {
    hasPausedRef.current = false
    milestonesRef.current = { 25: false, 50: false, 75: false }
    sourceChangingRef.current = true
    userInteractingRef.current = false
    openedForUrlRef.current = null
    startedForUrlRef.current = null
    completedForUrlRef.current = null
    pendingTrackPartsRef.current = []
    setMediaReady(false)
    setPlayerAccessState(null)
  }, [])

  useEffect(() => {
    const key = sessionKey(videoUrl, assetId)
    videoStartedKeys.delete(key)
    videoCompletedKeys.delete(key)
    videoOpenedKeys.delete(key)
    resetSessionState()
  }, [videoUrl, assetId, resetSessionState])

  const emit = useCallback((event) => {
    emitVideoEventRef(onEventRef, event)
  }, [])

  const postTrackEvent = useCallback(
    (parts) => {
      if (!uid?.trim() || !analyticsIdRef.current || !analyticsSessionReady) {
        pendingTrackPartsRef.current.push(parts)
        return
      }

      if (!analyticsId) return

      trackEvent(buildTrackEventBody(analyticsId, parts), modeTest, {
        onSessionInvalid: onAnalyticsSessionInvalid
      })
    },
    [analyticsId, analyticsSessionReady, modeTest, onAnalyticsSessionInvalid, uid]
  )

  postTrackEventRef.current = postTrackEvent

  useEffect(() => {
    if (!analyticsSessionReady || !analyticsId || !uid?.trim()) return

    const pending = pendingTrackPartsRef.current
    if (pending.length === 0) return

    pendingTrackPartsRef.current = []
    pending.forEach((parts) => {
      trackEvent(buildTrackEventBody(analyticsId, parts), modeTest, {
        onSessionInvalid: onAnalyticsSessionInvalid
      })
    })
  }, [analyticsSessionReady, analyticsId, uid, modeTest, onAnalyticsSessionInvalid])

  const emitAndTrack = useCallback(
    (event) => {
      emit(event)
      const parts = videoEventToTrackParts(event)
      if (parts) {
        postTrackEventRef.current?.(parts)
      }
    },
    [emit]
  )

  const maybeEmitOpened = useCallback(() => {
    const key = sessionKey(videoUrl, assetId)
    if (openedForUrlRef.current === key || videoOpenedKeys.has(key)) return

    const { duration } = readPlayerTimes(playerRef)
    if (!duration || duration <= 0) return

    openedForUrlRef.current = key
    videoOpenedKeys.add(key)

    emit({
      type: 'VIDEO_OPENED',
      assetId,
      duration
    })
  }, [assetId, emit, videoUrl])

  const checkProgressMilestones = useCallback(() => {
    const { currentTime, duration } = readPlayerTimes(playerRef)
    if (!duration || duration <= 0 || currentTime == null) return

    const percent = (currentTime / duration) * 100

    for (const threshold of PROGRESS_THRESHOLDS) {
      if (milestonesRef.current[threshold.percent]) continue
      if (percent < threshold.percent) continue

      milestonesRef.current[threshold.percent] = true
      emit({
        type: threshold.type,
        assetId,
        currentTime,
        duration,
        percent: threshold.percent
      })
    }
  }, [assetId, emit])

  const handleCanPlay = useCallback(() => {
    sourceChangingRef.current = false
    setMediaReady(true)
    maybeEmitOpened()
  }, [maybeEmitOpened])

  const handleLoadedMetadata = useCallback(() => {
    maybeEmitOpened()
  }, [maybeEmitOpened])

  const handlePlay = useCallback(() => {
    const key = sessionKey(videoUrl, assetId)
    const base = buildEventBase(assetId, playerRef)

    if (!startedForUrlRef.current && !videoStartedKeys.has(key)) {
      startedForUrlRef.current = key
      videoStartedKeys.add(key)
      emitAndTrack({ type: 'VIDEO_STARTED', ...base })
      return
    }

    if (hasPausedRef.current) {
      hasPausedRef.current = false
      emitAndTrack({ type: 'VIDEO_RESUMED', ...base })
    }
  }, [assetId, emitAndTrack, videoUrl])

  const handlePause = useCallback(() => {
    hasPausedRef.current = true
    emitAndTrack({
      type: 'VIDEO_PAUSED',
      ...buildEventBase(assetId, playerRef)
    })
  }, [assetId, emitAndTrack])

  const handleSeeked = useCallback(() => {
    if (sourceChangingRef.current || !userInteractingRef.current) return

    emit({
      type: 'VIDEO_SEEKED',
      ...buildEventBase(assetId, playerRef)
    })
    checkProgressMilestones()
  }, [assetId, checkProgressMilestones, emit])

  const handleTimeUpdate = useCallback(() => {
    checkProgressMilestones()
  }, [checkProgressMilestones])

  const handleEnded = useCallback(() => {
    const key = sessionKey(videoUrl, assetId)
    if (completedForUrlRef.current === key || videoCompletedKeys.has(key)) return

    completedForUrlRef.current = key
    videoCompletedKeys.add(key)

    emitAndTrack({
      type: 'VIDEO_COMPLETED',
      ...buildEventBase(assetId, playerRef)
    })
  }, [assetId, emitAndTrack, videoUrl])

  const handleError = useCallback(
    (detail) => {
      setPlayerAccessState('not-found')
      onErrorRef.current?.('not-found')

      emit({
        type: 'VIDEO_LOAD_ERROR',
        assetId,
        accessState: 'not-found'
      })
    },
    [assetId, emit]
  )

  const markUserInteracting = useCallback(() => {
    userInteractingRef.current = true
  }, [])

  const openDrawer = useCallback((tab = 'about') => {
    setDrawerEverOpened(true)
    setDrawerTab(tab)
    setDrawerOpen(true)
  }, [])

  const togglePresentationDrawer = useCallback(() => {
    if (drawerOpen && drawerTab === 'presentation') {
      setDrawerOpen(false)
      return
    }
    openDrawer('presentation')
  }, [drawerOpen, drawerTab, openDrawer])

  const handleOpenAuthor = useCallback(() => {
    openDrawer('about')
  }, [openDrawer])

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const drawerTitle = useMemo(() => {
    if (drawerTab === 'about') return 'About the Presenter'
    if (drawerTab === 'presentation') return 'About this Presentation'
    return ''
  }, [drawerTab])

  useEffect(() => {
    if (searchParams.get('panel') === 'about' && showAuthor) {
      setDrawerTab('about')
      setDrawerEverOpened(true)
      setDrawerOpen(true)
    } else if (searchParams.get('panel') === 'presentation' && showPresentationInfo) {
      setDrawerTab('presentation')
      setDrawerEverOpened(true)
      setDrawerOpen(true)
    }
  }, [showAuthor, showPresentationInfo, searchParams])

  // Exit fullscreen when opened in modal context (swiper / PDF embed pattern).
  useEffect(() => {
    if (!isModalMode) return

    const player = playerRef.current
    if (player?.state?.fullscreen) {
      player.exitFullscreen?.().catch(() => {})
    }

    if (!document.fullscreenElement) return

    exitDocumentFullscreen()
  }, [isModalMode])

  useEffect(() => {
    if (!showAuthor && drawerTab === 'about') {
      setDrawerOpen(false)
    }
  }, [showAuthor, drawerTab])

  useEffect(() => {
    if (!showPresentationInfo && drawerTab === 'presentation') {
      setDrawerOpen(false)
    }
  }, [showPresentationInfo, drawerTab])

  useEffect(() => {
    if (!trackingActive || !drawerOpen || drawerTab !== 'about') return
    postTrackEvent(['Author', '1'])
  }, [trackingActive, drawerOpen, drawerTab, postTrackEvent])

  useEffect(() => {
    if (!trackingActive || !drawerOpen || drawerTab !== 'presentation') return
    postTrackEvent(['Info', '1'])
  }, [trackingActive, drawerOpen, drawerTab, postTrackEvent])

  useEffect(() => {
    if (!trackingActive) return

    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return

      postTrackEvent(['Time', '15'])
    }, 15000)

    return () => clearInterval(interval)
  }, [trackingActive, postTrackEvent])

  const handleDownload = useCallback(() => {
    if (!downloadUrl || typeof downloadUrl !== 'string' || downloadProgress !== null) return

    if (trackingActive) {
      postTrackEvent(['Report', '1'])
    }

    setDownloadError(null)
    setDownloadProgress(0)
    const xhr = new XMLHttpRequest()
    downloadAbortRef.current = () => xhr.abort()

    const timeoutId = setTimeout(() => {
      xhr.abort()
    }, DOWNLOAD_TIMEOUT_MS)

    xhr.responseType = 'blob'
    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        setDownloadProgress(Math.round((e.loaded / e.total) * 100))
      } else {
        setDownloadProgress((p) => (p !== null && p < 95 ? p + 5 : p))
      }
    }
    xhr.onload = () => {
      clearTimeout(timeoutId)
      downloadAbortRef.current = null
      if (xhr.status < 200 || xhr.status >= 300) {
        setDownloadError(`Download failed (${xhr.status})`)
        setDownloadProgress(null)
        return
      }
      const blob = xhr.response
      if (!blob || !(blob instanceof Blob)) {
        setDownloadError('Invalid file response')
        setDownloadProgress(null)
        return
      }
      setDownloadProgress(100)
      try {
        const filename = resolveVideoDownloadFilename(xhr, fileName)
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(a.href)
      } catch {
        setDownloadError('Could not save file')
      }
      setTimeout(() => setDownloadProgress(null), 300)
    }
    xhr.onerror = () => {
      clearTimeout(timeoutId)
      downloadAbortRef.current = null
      setDownloadError('Network error. Please check your connection and try again.')
      setDownloadProgress(null)
    }
    xhr.onabort = () => {
      clearTimeout(timeoutId)
      downloadAbortRef.current = null
      setDownloadError(xhr.status === 0 ? 'Download timed out or was cancelled.' : null)
      setDownloadProgress(null)
    }
    try {
      xhr.open('GET', downloadUrl)
      xhr.send()
    } catch {
      clearTimeout(timeoutId)
      downloadAbortRef.current = null
      setDownloadError('Failed to start download')
      setDownloadProgress(null)
    }
  }, [
    downloadProgress,
    downloadUrl,
    fileName,
    postTrackEvent,
    trackingActive
  ])

  if (playerAccessState) {
    return <ResourceAccessState state={playerAccessState} appLabel="Video" />
  }

  return (
    <div className={`viewer-container ${shellClassName}`} style={themeStyle}>
      <VideoToolbar
        title={fileName?.trim() || ''}
        controlTheme={resolvedControlTheme}
        showPresentationInfo={showPresentationInfo}
        showAuthor={showAuthor}
        presenter={presenter}
        drawerOpen={drawerOpen}
        drawerTab={drawerTab}
        showBackIcon={showBackIcon}
        backIconLabel={backIconLabel}
        onTogglePresentation={togglePresentationDrawer}
        onOpenAuthor={handleOpenAuthor}
        downloadEnabled={downloadEnabled}
        onDownload={handleDownload}
      />

      <div className="video-viewer-stage">
        <div
          className="video-player-frame"
          onPointerDown={markUserInteracting}
          onKeyDown={markUserInteracting}
        >
          <div className="video-player-aspect">
            <MediaPlayer
              ref={playerRef}
              className="ekphrastic-media-player"
              title={title}
              src={videoUrl}
              poster={posterUrl || undefined}
              crossOrigin="anonymous"
              playsInline
              onCanPlay={handleCanPlay}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeeked={handleSeeked}
              onTimeUpdate={handleTimeUpdate}
              onEnded={handleEnded}
              onError={handleError}
            >
              <MediaProvider />
              <VideoPlayerControls />
            </MediaPlayer>
          </div>
        </div>
      </div>

      {drawerEverOpened ? (
        <SideDrawer
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          title={drawerTitle}
          controlTheme={resolvedControlTheme}
        >
          {drawerTab === 'about' && showAuthor ? (
            <AboutPanel presenter={presenter} />
          ) : drawerTab === 'presentation' && showPresentationInfo ? (
            <PresentationInfoPanel
              description={description}
              firstSlideImageUrl={heroImage}
            />
          ) : null}
        </SideDrawer>
      ) : null}

      {!mediaReady ? (
        <div className="video-loading-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="loading-state">
            <div className="spinner">
              <img
                src={`${import.meta.env.BASE_URL}ek_loader.svg`}
                alt=""
                aria-hidden="true"
              />
            </div>
            <p>Loading Video</p>
          </div>
        </div>
      ) : null}

      {downloadProgress !== null ? (
        <div className="download-progress-overlay">
          <div className="download-progress-content">
            <p>Downloading video...</p>
            <div className="download-progress-bar">
              <div
                className="download-progress-fill"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="download-progress-percent">{downloadProgress}%</p>
          </div>
        </div>
      ) : null}
      {downloadError ? (
        <div className="download-error-overlay" role="alert">
          <div className="download-error-content">
            <p className="download-error-message">{downloadError}</p>
            <div className="download-error-actions">
              <button
                type="button"
                onClick={handleDownload}
                className="download-error-retry"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setDownloadError(null)}
                className="download-error-dismiss"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default EkphrasticVideoViewer
