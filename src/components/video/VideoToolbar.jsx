import { memo } from 'react'
import Tippy from '@tippyjs/react'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined'

const ICON_SIZE = 24

function ToolbarButton({ label, onClick, disabled, active, className = '', children }) {
  return (
    <Tippy content={label} placement="bottom" delay={[300, 0]} theme="light-border">
      <button
        type="button"
        className={`video-toolbar-btn${active ? ' video-toolbar-btn--active' : ''}${className ? ` ${className}` : ''}`}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
      >
        {children}
      </button>
    </Tippy>
  )
}

function VideoToolbar({
  title = '',
  controlTheme,
  showPresentationInfo,
  showAuthor,
  presenter,
  drawerOpen,
  drawerTab,
  showBackIcon = false,
  backIconLabel = 'Close preview',
  downloadEnabled = false,
  onTogglePresentation,
  onOpenAuthor,
  onDownload
}) {
  const presentationActive = drawerOpen && drawerTab === 'presentation'
  const authorLabel = presenter?.name ? `About ${presenter.name}` : 'About the author'
  const showLeftControls = showBackIcon || showPresentationInfo || showAuthor
  const showTitle = Boolean(title?.trim())

  if (!showLeftControls && !showTitle && !downloadEnabled) {
    return null
  }

  return (
    <header
      className="video-toolbar video-toolbar-themed"
      style={{ '--control-theme': controlTheme }}
      role="toolbar"
      aria-label="Video viewer toolbar"
    >
      <div className="video-toolbar-group video-toolbar-group--start">
        {showBackIcon && (
          <Tippy content={backIconLabel} placement="bottom" delay={[300, 0]} theme="light-border">
            <button
              type="button"
              className="back-toggle"
              onClick={() => window.close()}
              aria-label={backIconLabel}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 12c0 5.52 4.48 10 10 10s10-4.48 10-10S17.52 2 12 2 2 6.48 2 12m18 0c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8 8 3.58 8 8M8 12l4-4 1.41 1.41L11.83 11H16v2h-4.17l1.59 1.59L12 16z" />
              </svg>
            </button>
          </Tippy>
        )}

        {showPresentationInfo && (
          <ToolbarButton
            label="About this Presentation"
            onClick={onTogglePresentation}
            active={presentationActive}
            className="info-toggle"
          >
            <InfoOutlinedIcon sx={{ fontSize: ICON_SIZE }} />
          </ToolbarButton>
        )}

        {showAuthor && (
          <ToolbarButton
            label={authorLabel}
            onClick={onOpenAuthor}
            active={drawerOpen && drawerTab === 'about'}
            className="author-toggle"
          >
            <AccountCircleOutlinedIcon sx={{ fontSize: ICON_SIZE }} />
          </ToolbarButton>
        )}
      </div>

      {showTitle ? (
        <h1 className="video-toolbar-title" title={title}>
          {title}
        </h1>
      ) : null}

      <div className="video-toolbar-group video-toolbar-group--end">
        {downloadEnabled && (
          <Tippy content="Download" placement="bottom" delay={[300, 0]} theme="light-border">
            <button
              type="button"
              className="download-toggle"
              onClick={onDownload}
              aria-label="Download"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
              </svg>
            </button>
          </Tippy>
        )}
      </div>
    </header>
  )
}

export default memo(VideoToolbar)
