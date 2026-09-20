import FindInPageOutlinedIcon from '@mui/icons-material/FindInPageOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import './ResourceAccessState.css'

const HERO_ICON_SIZE = 48
const PANEL_ICON_SIZE = 20

const COPY = {
  'not-found': {
    title: 'Resource not found',
    lines: [
      'The requested resource could not be found.',
      'The link may be incorrect or no longer valid.'
    ]
  },
  unavailable: {
    title: 'This resource is unavailable',
    lines: [
      'This resource has been unpublished',
      'and is not currently available for viewing.'
    ]
  },
  'access-configuration': {
    title: 'This resource cannot be opened',
    lines: [
      'Access settings for this resource are incomplete.',
      'Please contact the person who shared it with you.'
    ]
  }
}

export function ResourceAccessState({ state, appLabel = 'Video' }) {
  const content = COPY[state]

  return (
    <div className="resource-access-state-page" role="main">
      <article className="resource-access-state-card" aria-labelledby="resource-access-state-title">
        <header className="resource-access-state-header">
          <span className="resource-access-state-app-label">{appLabel}</span>
        </header>

        <div className="resource-access-state-body">
          <div className="resource-access-state-icon-wrap" aria-hidden="true">
            {state === 'not-found' ? (
              <FindInPageOutlinedIcon sx={{ fontSize: HERO_ICON_SIZE }} />
            ) : state === 'access-configuration' ? (
              <InfoOutlinedIcon sx={{ fontSize: HERO_ICON_SIZE }} />
            ) : (
              <VisibilityOffOutlinedIcon sx={{ fontSize: HERO_ICON_SIZE }} />
            )}
          </div>

          <h1 id="resource-access-state-title" className="resource-access-state-title">
            {content.title}
          </h1>

          <p className="resource-access-state-description">
            {content.lines.map((line) => (
              <span key={line} className="resource-access-state-description-line">
                {line}
              </span>
            ))}
          </p>

          <aside className="resource-access-state-panel" aria-label="Need access">
            <div className="resource-access-state-panel-icon">
              <InfoOutlinedIcon sx={{ fontSize: PANEL_ICON_SIZE }} />
            </div>
            <div className="resource-access-state-panel-content">
              <p className="resource-access-state-panel-title">Need access?</p>
              <p className="resource-access-state-panel-text">
                If you believe you should have access to this resource, please contact the person
                who shared it with you.
              </p>
            </div>
          </aside>
        </div>
      </article>
    </div>
  )
}
