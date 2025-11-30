import { useCallback, useEffect, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useLocation, useNavigate } from 'react-router-dom'
import styles from './SubNavBar.module.css'

function SubNavBar({ links, ariaLabel = 'Sub navigation' }) {
  const navigate = useNavigate()
  const location = useLocation()
  const wrapperRef = useRef(null)

  const normalizedLinks = useMemo(() => {
    if (!Array.isArray(links)) {
      return []
    }
    return links.filter(
      (link) => link && typeof link.label === 'string' && typeof link.path === 'string'
    )
  }, [links])

  const activePath = useMemo(() => {
    if (!normalizedLinks.length) {
      return ''
    }
    const exactMatch = normalizedLinks.find((link) => link.path === location.pathname)
    if (exactMatch) {
      return exactMatch.path
    }
    const partialMatch = normalizedLinks
      .filter((link) => link.path && link.path !== '/')
      .find((link) => location.pathname.startsWith(link.path))
    return partialMatch?.path ?? normalizedLinks[0].path
  }, [location.pathname, normalizedLinks])

  const handleNavigate = useCallback(
    (path) => {
      if (!path || path === location.pathname) {
        return
      }

      navigate(path)
    },
    [location.pathname, navigate]
  )

  if (!normalizedLinks.length) {
    return null
  }

  useEffect(() => {
    const updateHeight = () => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (rect && typeof document !== 'undefined') {
        const offset = Math.max(0, window.innerHeight - rect.top)
        document.documentElement.style.setProperty('--active-subnav-height', `${Math.round(offset)}px`)
      }
    }

    updateHeight()
    window.addEventListener('resize', updateHeight)

    return () => {
      window.removeEventListener('resize', updateHeight)
      if (typeof document !== 'undefined') {
        document.documentElement.style.removeProperty('--active-subnav-height')
      }
    }
  }, [])

  return (
    <nav ref={wrapperRef} className={styles.wrapper} aria-label={ariaLabel}>
      <div className={styles.items}>
        {normalizedLinks.map(({ label, path }) => {
          const isActive = activePath === path
          return (
            <button
              key={path || label}
              type="button"
              className={styles.itemButton}
              data-active={isActive ? 'true' : 'false'}
              onClick={() => handleNavigate(path)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.label}>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

SubNavBar.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
    })
  ),
  ariaLabel: PropTypes.string,
}

SubNavBar.defaultProps = {
  links: [],
  ariaLabel: 'Sub navigation',
}

export default SubNavBar
