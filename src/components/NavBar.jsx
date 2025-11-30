import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import { FaHome, FaTrophy, FaLayerGroup, FaCode } from 'react-icons/fa'
import styles from './NavBar.module.css'

const DEFAULT_LINKS = [
  { label: 'Home', path: '/', icon: FaHome },
  { label: 'Decks', path: '/decks', icon: FaLayerGroup },
  { label: 'Ranks', path: '/leaderboards', icon: FaTrophy },
]

const INITIAL_RECT = {
  width: 0,
  height: 0,
  x: 0,
  y: 0,
  opacity: 0,
}

const rectsAreEqual = (a, b) =>
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5 &&
  Math.abs(a.x - b.x) < 0.5 &&
  Math.abs(a.y - b.y) < 0.5 &&
  Math.abs(a.opacity - b.opacity) < 0.01

function NavBar({ links = DEFAULT_LINKS }) {
  const navigate = useNavigate()
  const location = useLocation()
  const navContainerRef = useRef(null)
  const pillRefs = useRef({})
  const [highlightRect, setHighlightRect] = useState(INITIAL_RECT)
  const [isHighlightReady, setHighlightReady] = useState(false)

  const normalizedLinks = useMemo(() => links.filter(Boolean), [links])

  const activePath = useMemo(() => {
    if (!normalizedLinks.length) {
      return ''
    }

    const exact = normalizedLinks.find((link) => link.path === location.pathname)
    if (exact) {
      return exact.path
    }

    const partial = normalizedLinks
      .filter((link) => link.path && link.path !== '/')
      .find((link) => location.pathname.startsWith(link.path))

    return partial?.path ?? normalizedLinks[0].path
  }, [location.pathname, normalizedLinks])

  const commitHighlightRect = useCallback(
    (nextRect) => {
      setHighlightRect((prev) => (rectsAreEqual(prev, nextRect) ? prev : nextRect))
      if (nextRect.opacity > 0 && !isHighlightReady) {
        setHighlightReady(true)
      }
    },
    [isHighlightReady]
  )

  const calculateRectForPath = useCallback(
    (path) => {
      const containerEl = navContainerRef.current
      const targetEl = pillRefs.current[path]
      if (!containerEl || !targetEl) {
        return INITIAL_RECT
      }

      const containerRect = containerEl.getBoundingClientRect()
      const targetRect = targetEl.getBoundingClientRect()

      return {
        width: targetRect.width,
        height: targetRect.height,
        x: targetRect.left - containerRect.left,
        y: targetRect.top - containerRect.top,
        opacity: 1,
      }
    },
    []
  )

  const moveHighlightToPath = useCallback(
    (path) => {
      commitHighlightRect(calculateRectForPath(path))
    },
    [calculateRectForPath, commitHighlightRect]
  )

  const handleNavClick = useCallback(
    (path) => {
      moveHighlightToPath(path)
      if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => navigate(path))
      } else {
        navigate(path)
      }
    },
    [moveHighlightToPath, navigate]
  )

  const handleNavPointerDown = useCallback(
    (path) => {
      moveHighlightToPath(path)
    },
    [moveHighlightToPath]
  )

  const updateHighlight = useCallback(() => {
    if (!activePath) return
    moveHighlightToPath(activePath)
  }, [activePath, moveHighlightToPath])

  const setActiveNavHeight = useCallback(() => {
    if (typeof document === 'undefined') {
      return
    }
    const rect = navContainerRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }
    document.documentElement.style.setProperty('--active-nav-height', `${Math.round(rect.bottom)}px`)
  }, [])

  useLayoutEffect(() => {
    setActiveNavHeight()
    updateHighlight()
  }, [setActiveNavHeight, updateHighlight])

  useEffect(() => {
    window.addEventListener('resize', updateHighlight)
    window.addEventListener('resize', setActiveNavHeight)
    return () => {
      window.removeEventListener('resize', updateHighlight)
      window.removeEventListener('resize', setActiveNavHeight)
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty('--active-nav-height')
      }
    }
  }, [setActiveNavHeight, updateHighlight])

  return (
    <div className={styles.wrapper}>
      <nav ref={navContainerRef} className={styles.nav} aria-label="Primary navigation">
        <div
          className={`${styles.highlight} ${isHighlightReady ? styles.highlightReady : ''}`}
          style={{
            transform: `translate3d(${highlightRect.x}px, ${highlightRect.y}px, 0)`,
            width: `${highlightRect.width}px`,
            height: `${highlightRect.height}px`,
            opacity: highlightRect.opacity,
          }}
        />
        {normalizedLinks.map(({ label, path, icon: Icon }) => {
          const isActive = activePath === path
          return (
            <button
              key={path || label}
              type="button"
              className={`${styles.itemButton} ${isActive ? styles.itemActive : ''}`}
              onPointerDown={() => handleNavPointerDown(path)}
              onClick={() => handleNavClick(path)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                ref={(el) => {
                  if (el) {
                    pillRefs.current[path] = el
                  } else {
                    delete pillRefs.current[path]
                  }
                }}
                className={styles.pill}
              >
                {Icon ? <Icon className={styles.icon} aria-hidden="true" /> : null}
                <span className={styles.label}>{label}</span>
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

NavBar.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
    })
  ),
}

export default NavBar

