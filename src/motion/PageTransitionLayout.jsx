import { motion, useAnimationControls } from 'framer-motion'
import { Outlet, useLocation } from 'react-router-dom'
import { useCallback, useEffect, useRef } from 'react'
import { useExitParticipant } from './ExitAnimationCoordinator'
import { pageVariants } from './variants'

function PageTransitionLayout() {
  const location = useLocation()
  const controls = useAnimationControls()
  const variant = pageVariants.slideFade
  const previousBasePathRef = useRef('')
  const previousPathnameRef = useRef('')

  // Extract base path (e.g., '/test' from '/test/page1')
  const getBasePath = (pathname) => {
    const match = pathname.match(/^(\/[^/]+)/)
    return match ? match[1] : pathname
  }

  const currentBasePath = getBasePath(location.pathname)
  const previousBasePath = previousBasePathRef.current
  const isSubpageChange = previousBasePath === currentBasePath && previousBasePath !== '' && previousPathnameRef.current !== location.pathname

  useEffect(() => {
    previousBasePathRef.current = currentBasePath
    previousPathnameRef.current = location.pathname
  }, [currentBasePath, location.pathname])

  useEffect(() => {
    // Skip animation for subpage changes
    if (isSubpageChange) {
      controls.set('animate')
      return
    }

    controls.set('initial')
    let frame
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      frame = window.requestAnimationFrame(() => {
        controls.start('animate')
      })
    } else {
      controls.start('animate')
    }

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [controls, location.key, isSubpageChange])

  const handleExit = useCallback(
    ({ signal } = {}) => {
      // Don't exit animate if we're just changing subpages
      if (isSubpageChange) {
        return Promise.resolve()
      }

      if (!signal) {
        return controls.start('exit')
      }

      if (signal.aborted) {
        controls.stop()
        return Promise.resolve()
      }

      const handleAbort = () => {
        controls.stop()
      }
      signal.addEventListener('abort', handleAbort, { once: true })

      return controls.start('exit').finally(() => {
        signal.removeEventListener('abort', handleAbort)
      })
    },
    [controls, isSubpageChange]
  )

  useExitParticipant({ id: 'page-transition', onExit: handleExit })

  return (
    <motion.div
      initial="initial"
      animate={controls}
      variants={variant}
      transition={variant.transition}
      style={{ width: '100%', height: '100%' }}
    >
      <Outlet />
    </motion.div>
  )
}

export default PageTransitionLayout

