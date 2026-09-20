import { useState } from 'react'
import LocalPhoneIcon from '@mui/icons-material/LocalPhone'
import { EmailIcon, GlobeIcon, LinkedInIcon } from './icons'

function getInitials(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function getFirstName(name) {
  if (!name || typeof name !== 'string') return null
  const first = name.trim().split(/\s+/)[0]
  return first || null
}

function AboutPanel({ presenter }) {
  const [avatarFailed, setAvatarFailed] = useState(false)

  if (!presenter) return null

  const showAvatar = presenter.avatarUrl && !avatarFailed
  const initials = getInitials(presenter.name)
  const showInitials = !showAvatar && (presenter.name || presenter.avatarUrl)
  const firstName = getFirstName(presenter.name)
  const hasContact = presenter.website || presenter.email || presenter.linkedin || presenter.contact
  const hasProfile =
    showAvatar || showInitials || presenter.name || presenter.title || presenter.company
  const expertise = Array.isArray(presenter.expertise)
    ? presenter.expertise.filter((item) => typeof item === 'string' && item.trim())
    : []

  return (
    <div className="menu-content about-panel">
      {hasProfile && (
        <div className="about-profile">
          {(showAvatar || showInitials) && (
            <div className="about-avatar-wrap">
              {showAvatar ? (
                <img
                  src={presenter.avatarUrl}
                  alt={presenter.name ? `${presenter.name} profile` : 'Presenter'}
                  className="about-avatar"
                  onError={() => setAvatarFailed(true)}
                />
              ) : (
                <div className="about-avatar about-avatar-initials" aria-hidden="true">
                  {initials}
                </div>
              )}
            </div>
          )}

          {(presenter.name || presenter.title || presenter.company) && (
            <div className="about-identity">
              {presenter.name && <h3 className="about-name">{presenter.name}</h3>}
              {presenter.title && <p className="about-title">{presenter.title}</p>}
              {presenter.company && <p className="about-company">{presenter.company}</p>}
            </div>
          )}
        </div>
      )}

      {hasContact && (
        <ul className="about-contact-list">
          {presenter.website && (
            <li>
              <a
                className="about-contact-row"
                href={presenter.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                <GlobeIcon />
                <span>Visit Website</span>
              </a>
            </li>
          )}
          {presenter.email && (
            <li>
              <a className="about-contact-row" href={`mailto:${presenter.email}`}>
                <EmailIcon />
                <span>{firstName ? `Email ${firstName}` : 'Email'}</span>
              </a>
            </li>
          )}
          {presenter.linkedin && (
            <li>
              <a
                className="about-contact-row"
                href={presenter.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <LinkedInIcon />
                <span>View LinkedIn</span>
              </a>
            </li>
          )}
          {presenter.contact && (
            <li>
              <a
                className="about-contact-row"
                href={`tel:${presenter.contact.replace(/[^\d+]/g, '')}`}
                aria-label={`Call ${presenter.contact}`}
              >
                <LocalPhoneIcon sx={{ fontSize: 18 }} />
                <span>{presenter.contact}</span>
              </a>
            </li>
          )}
        </ul>
      )}

      {presenter.bio && (
        <section className="about-bio-card">
          <h4 className="about-bio-heading">
            {firstName ? `About ${firstName}` : 'About the Presenter'}
          </h4>
          <p className="about-bio-text">{presenter.bio}</p>
        </section>
      )}

      {expertise.length > 0 && (
        <div className="about-expertise">
          {expertise.map((item) => (
            <span key={item} className="about-expertise-chip">
              {item.trim()}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default AboutPanel
