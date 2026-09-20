import { useCallback, useEffect, useRef, useState } from 'react'
import { Routes, Route, useSearchParams, useNavigate, useParams } from 'react-router-dom'
import { ProtectedResourceAccess } from './components/access-state/ProtectedResourceAccess'
import { ResourceAccessState } from './components/access-state/ResourceAccessState'
import EkphrasticVideoViewer from './components/video/EkphrasticVideoViewer'
import { isResourceAccessError } from './lib/resourceAccessError'
import { resolveVideoAccessFromAssetMeta } from './lib/videoAccessGate'
import { initGA4, track } from './utils/analytics'
import { fetchVideoAsset } from './utils/videoAdapter'
import {
  buildVisitorSessionKey,
  invalidateVisitorSession,
  trackVisitorStart
} from './utils/trackingAdapter'
import { isAbortError } from './utils/api'
import { shouldDeferTrackVisitorStart } from './lib/videoVisitorAnalytics'

function VideoViewerRoute({
  attachmentId,
  directVideoUrl,
  uid,
  analyticsId,
  analyticsSessionReady,
  onAnalyticsSessionInvalid,
  onAnalyticsLoadState,
  modeTest,
  onEvent
}) {
  const [loading, setLoading] = useState(Boolean(attachmentId && !directVideoUrl))
  const [accessState, setAccessState] = useState(null)
  const [videoUrl, setVideoUrl] = useState(directVideoUrl || null)
  const [posterUrl, setPosterUrl] = useState(null)
  const [assetId, setAssetId] = useState(attachmentId || 'direct')
  const [fileName, setFileName] = useState(null)
  const [functionColor, setFunctionColor] = useState(null)
  const [themeColor, setThemeColor] = useState(null)
  const [presenter, setPresenter] = useState(null)
  const [displayAuthor, setDisplayAuthor] = useState(false)
  const [description, setDescription] = useState(null)
  const [heroImage, setHeroImage] = useState(null)
  const [downloadEnabled, setDownloadEnabled] = useState(false)
  const [downloadUrl, setDownloadUrl] = useState(null)
  const [accessGate, setAccessGate] = useState(null)
  const [accessApproved, setAccessApproved] = useState(false)
  const [gatePayloadListId, setGatePayloadListId] = useState(null)
  const [pendingAsset, setPendingAsset] = useState(null)

  const applyLoadedAsset = useCallback((data) => {
    if (data.fileName) {
      document.title = data.fileName
    }

    if (data.presenterGa4) {
      initGA4(data.presenterGa4)
    }

    setPosterUrl(data.posterUrl || null)
    setAssetId(data.assetId)
    setFileName(data.fileName || null)
    setFunctionColor(data.functionColor || null)
    setThemeColor(data.themeColor || null)
    setPresenter(data.presenter || null)
    setDisplayAuthor(data.displayAuthor === true)
    setDescription(data.description || null)
    setHeroImage(data.heroImage || null)
    setDownloadEnabled(!!data.downloadEnabled)
    setDownloadUrl(data.downloadUrl || null)
    setVideoUrl(data.videoUrl)
  }, [])

  const handleAccessApproved = useCallback(
    (approval) => {
      if (approval?.email?.trim()) {
        onAnalyticsLoadState?.({
          assetTrackingReady: true,
          awaitingEmailGate: false,
          approvedAccessEmail: approval.email.trim()
        })
      }
      if (pendingAsset) {
        applyLoadedAsset(pendingAsset)
      }
      setAccessApproved(true)
      setAccessGate(null)
      setGatePayloadListId(null)
      setPendingAsset(null)
    },
    [applyLoadedAsset, onAnalyticsLoadState, pendingAsset]
  )

  useEffect(() => {
    if (directVideoUrl) {
      onAnalyticsLoadState?.({
        assetTrackingReady: true,
        awaitingEmailGate: false,
        approvedAccessEmail: null
      })
      setVideoUrl(directVideoUrl)
      setPosterUrl(null)
      setAssetId('direct')
      setFileName(null)
      setFunctionColor(null)
      setThemeColor(null)
      setPresenter(null)
      setDisplayAuthor(false)
      setDescription(null)
      setHeroImage(null)
      setDownloadEnabled(true)
      setDownloadUrl(directVideoUrl)
      setLoading(false)
      setAccessState(null)
      setAccessGate(null)
      setAccessApproved(false)
      setGatePayloadListId(null)
      setPendingAsset(null)
      return undefined
    }

    if (!attachmentId?.trim()) {
      setVideoUrl(null)
      setLoading(false)
      setAccessState('not-found')
      setAccessGate(null)
      setAccessApproved(false)
      return undefined
    }

    const controller = new AbortController()
    let cancelled = false

    const loadAsset = async () => {
      onAnalyticsLoadState?.({
        assetTrackingReady: false,
        awaitingEmailGate: false,
        approvedAccessEmail: null
      })
      try {
        setLoading(true)
        setAccessState(null)
        setVideoUrl(null)
        setAccessGate(null)
        setAccessApproved(false)
        setGatePayloadListId(null)
        setPendingAsset(null)

        const data = await fetchVideoAsset(attachmentId.trim(), {
          modeTest,
          signal: controller.signal
        })

        if (cancelled) return

        const access = resolveVideoAccessFromAssetMeta(data.assetMeta)
        if (access.kind === 'misconfigured') {
          onAnalyticsLoadState?.({
            assetTrackingReady: true,
            awaitingEmailGate: false,
            approvedAccessEmail: null
          })
          setAccessState('access-configuration')
          setVideoUrl(null)
          return
        }

        if (access.kind === 'gated') {
          if (data.fileName) {
            document.title = data.fileName
          }
          if (data.presenterGa4) {
            initGA4(data.presenterGa4)
          }
          setPendingAsset(data)
          setAccessGate(access.gate)
          setGatePayloadListId(access.payloadListId)
          setVideoUrl(null)
          onAnalyticsLoadState?.({
            assetTrackingReady: true,
            awaitingEmailGate: access.gate === 'email',
            approvedAccessEmail: null
          })
          return
        }

        onAnalyticsLoadState?.({
          assetTrackingReady: true,
          awaitingEmailGate: false,
          approvedAccessEmail: null
        })
        applyLoadedAsset(data)
      } catch (err) {
        if (isAbortError(err) || cancelled) return
        const state = isResourceAccessError(err) ? err.accessState : 'not-found'
        onAnalyticsLoadState?.({
          assetTrackingReady: true,
          awaitingEmailGate: false,
          approvedAccessEmail: null
        })
        setAccessState(state)
        setAccessGate(null)
        setAccessApproved(false)
        setGatePayloadListId(null)
        setPendingAsset(null)
        setVideoUrl(null)
        setPresenter(null)
        setDisplayAuthor(false)
        setDescription(null)
        setHeroImage(null)
        setDownloadEnabled(false)
        setDownloadUrl(null)
        track('video_load_error', { accessState: state })
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadAsset()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [applyLoadedAsset, attachmentId, directVideoUrl, modeTest, onAnalyticsLoadState])

  if (loading) {
    return (
      <div className="viewer-container loading-container">
        <div className="loading-state">
          <div className="spinner">
            <img src={`${import.meta.env.BASE_URL}ek_loader.svg`} alt="" aria-hidden="true" />
          </div>
          <p>Loading Video</p>
        </div>
      </div>
    )
  }

  if (!loading && accessState) {
    return <ResourceAccessState state={accessState} appLabel="Video" />
  }

  if (!loading && accessGate && !accessApproved && gatePayloadListId) {
    return (
      <ProtectedResourceAccess
        mode={accessGate}
        payloadListId={gatePayloadListId}
        modeTest={modeTest}
        onApproved={handleAccessApproved}
        resourceTitle={pendingAsset?.fileName || null}
        resourceDescription={pendingAsset?.description || null}
        contactEmail={pendingAsset?.presenter?.email || null}
        resourceLogoUrl={pendingAsset?.logoUrl || null}
      />
    )
  }

  if (!videoUrl) {
    return null
  }

  return (
    <EkphrasticVideoViewer
      videoUrl={videoUrl}
      posterUrl={posterUrl}
      assetId={assetId}
      fileName={fileName}
      uid={uid}
      analyticsId={analyticsId}
      analyticsSessionReady={analyticsSessionReady}
      onAnalyticsSessionInvalid={onAnalyticsSessionInvalid}
      functionColor={functionColor}
      themeColor={themeColor}
      presenter={presenter}
      displayAuthor={displayAuthor}
      description={description}
      heroImage={heroImage}
      downloadEnabled={downloadEnabled}
      downloadUrl={downloadUrl}
      modeTest={modeTest}
      onEvent={onEvent}
    />
  )
}

function App() {
  const [searchParams] = useSearchParams()
  const isDarkMode = searchParams.get('dark') === 'true'
  const [analyticsId, setAnalyticsId] = useState(null)
  const [analyticsSessionReady, setAnalyticsSessionReady] = useState(false)
  const [sessionEpoch, setSessionEpoch] = useState(0)
  const [analyticsLoadState, setAnalyticsLoadState] = useState({
    assetTrackingReady: false,
    awaitingEmailGate: false,
    approvedAccessEmail: null
  })
  const visitStartAttemptedRef = useRef(false)

  const explicitAttachmentId = searchParams.get('id') || searchParams.get('myid')
  const directVideoUrl = searchParams.get('video')?.trim() || null
  const uid = searchParams.get('uid')
  const uaid = searchParams.get('uaid')
  const modeTest = searchParams.get('mode') === 'test'

  const visitorSessionKey =
    uid?.trim() && explicitAttachmentId
      ? buildVisitorSessionKey({
          uid: uid.trim(),
          payloadListId: explicitAttachmentId,
          uaid: uaid?.trim() || undefined,
          modeTest
        })
      : null

  const handleAnalyticsSessionInvalid = useCallback(() => {
    if (visitorSessionKey) {
      invalidateVisitorSession(visitorSessionKey)
    }
    setAnalyticsId(null)
    setAnalyticsSessionReady(false)
    visitStartAttemptedRef.current = false
    setSessionEpoch((epoch) => epoch + 1)
  }, [visitorSessionKey])

  const handleAnalyticsLoadState = useCallback((nextState) => {
    setAnalyticsLoadState({
      assetTrackingReady: nextState.assetTrackingReady === true,
      awaitingEmailGate: nextState.awaitingEmailGate === true,
      approvedAccessEmail: nextState.approvedAccessEmail?.trim() || null
    })
  }, [])

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark-mode')
    } else {
      document.body.classList.remove('dark-mode')
    }
    return () => document.body.classList.remove('dark-mode')
  }, [isDarkMode])

  useEffect(() => {
    visitStartAttemptedRef.current = false
    setAnalyticsLoadState({
      assetTrackingReady: false,
      awaitingEmailGate: false,
      approvedAccessEmail: null
    })
  }, [uid, explicitAttachmentId, sessionEpoch])

  useEffect(() => {
    if (!uid?.trim() || !explicitAttachmentId) {
      setAnalyticsId(null)
      setAnalyticsSessionReady(false)
      return undefined
    }

    if (
      shouldDeferTrackVisitorStart({
        assetTrackingReady: analyticsLoadState.assetTrackingReady,
        awaitingEmailGate: analyticsLoadState.awaitingEmailGate,
        approvedAccessEmail: analyticsLoadState.approvedAccessEmail
      })
    ) {
      setAnalyticsSessionReady(false)
      return undefined
    }

    if (visitStartAttemptedRef.current) {
      return undefined
    }

    const controller = new AbortController()
    let cancelled = false

    setAnalyticsSessionReady(false)
    visitStartAttemptedRef.current = true

    const registerVisitor = async () => {
      try {
        const emailForAnalytics = analyticsLoadState.approvedAccessEmail?.trim() || undefined
        const resolvedId = await trackVisitorStart({
          uid: uid.trim(),
          payloadListId: explicitAttachmentId,
          uaid: uaid?.trim() || undefined,
          email: emailForAnalytics,
          modeTest,
          signal: controller.signal
        })
        if (!cancelled && resolvedId) {
          setAnalyticsId(resolvedId)
          setAnalyticsSessionReady(true)
        }
      } catch (err) {
        if (isAbortError(err) || cancelled) return
        console.warn('track_visitor_start error:', err)
        visitStartAttemptedRef.current = false
        if (uaid?.trim()) {
          setAnalyticsId(uaid.trim())
          setAnalyticsSessionReady(true)
        }
      }
    }

    registerVisitor()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    uid,
    explicitAttachmentId,
    uaid,
    modeTest,
    sessionEpoch,
    analyticsLoadState.assetTrackingReady,
    analyticsLoadState.awaitingEmailGate,
    analyticsLoadState.approvedAccessEmail
  ])

  const handleViewerEvent = (event) => {
    if (import.meta.env.DEV) {
      console.log('[Video event]', event)
    }
  }

  const hasViewerSource = Boolean(directVideoUrl || explicitAttachmentId?.trim())

  return (
    <Routes>
      <Route path="/attachment/:id" element={<AttachmentRedirect />} />
      <Route
        path="/"
        element={
          hasViewerSource ? (
            <VideoViewerRoute
              attachmentId={explicitAttachmentId}
              directVideoUrl={directVideoUrl}
              uid={uid?.trim() || null}
              analyticsId={analyticsId}
              analyticsSessionReady={analyticsSessionReady}
              onAnalyticsSessionInvalid={handleAnalyticsSessionInvalid}
              onAnalyticsLoadState={handleAnalyticsLoadState}
              modeTest={modeTest}
              onEvent={handleViewerEvent}
            />
          ) : (
            <div className="app-container">
              <h1>ekphrastic.io Video Viewer</h1>
              <p>Open a video using a shared Ekphrastic link or add a URL parameter.</p>
              <p className="app-hint">
                Example direct URL:{' '}
                <code>/?video=https://files.vidstack.io/sprite-fight/720p.mp4</code>
              </p>
            </div>
          )
        }
      />
    </Routes>
  )
}

function AttachmentRedirect() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    params.set('id', id)
    navigate(`/?${params.toString()}`, { replace: true })
  }, [id, searchParams, navigate])

  return (
    <div className="viewer-container loading-container">
      <div className="loading-state">
        <div className="spinner">
          <img src={`${import.meta.env.BASE_URL}ek_loader.svg`} alt="" aria-hidden="true" />
        </div>
        <p>Redirecting...</p>
      </div>
    </div>
  )
}

export default App
