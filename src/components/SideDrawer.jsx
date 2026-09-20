import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import Tippy from '@tippyjs/react'

function SideDrawer({ isOpen, onClose, title, controlTheme, children }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
    document.body.style.overflow = ''
  }, [isOpen])

  const drawerContent = (
    <>
      {isOpen && <div className="menu-overlay" onClick={onClose} />}
      <div
        className={`side-drawer side-drawer-themed ${isOpen ? 'open' : ''}`}
        style={{ '--control-theme': controlTheme }}
      >
        <div className="menu-header">
          <h2>{title}</h2>
          <Tippy content="Close" placement="bottom" delay={[300, 0]} theme="light-border">
            <button className="menu-close" onClick={onClose} aria-label="Close">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </Tippy>
        </div>
        {children}
      </div>
    </>
  )

  if (typeof document === 'undefined') return drawerContent
  return createPortal(drawerContent, document.body)
}

export default SideDrawer
