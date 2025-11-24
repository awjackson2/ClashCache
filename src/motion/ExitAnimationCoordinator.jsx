import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef } from 'react'
import PropTypes from 'prop-types'
import { useNavigate } from 'react-router-dom'

const ExitAnimationCoordinatorContext = createContext(null)
const DEFAULT_TIMEOUT_MS = 1200

function ExitAnimationCoordinatorProvider({ children, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const participantsRef = useRef(new Map())
  const activeControllerRef = useRef(null)

  const registerParticipant = useCallback((id, handler) => {
    if (!id || typeof handler !== 'function') {
      return () => {}
    }

    const registry = participantsRef.current
    registry.set(id, handler)

    return () => {
      const existing = registry.get(id)
      if (existing === handler) {
        registry.delete(id)
      }
    }
  }, [])

  const cancelPending = useCallback((reason) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort(reason)
      activeControllerRef.current = null
    }
  }, [])

  const awaitAll = useCallback(
    ({ timeout = timeoutMs } = {}) => {
      const handlers = Array.from(participantsRef.current.values())
      if (!handlers.length) {
        cancelPending()
        return Promise.resolve()
      }

      const controller = new AbortController()
      cancelPending('new-sequence')
      activeControllerRef.current = controller

      const safeInvoke = (handler) => {
        try {
          const result = handler({ signal: controller.signal })
          if (result && typeof result.then === 'function') {
            return result.catch(() => {})
          }
        } catch (error) {
          return Promise.resolve()
        }
        return Promise.resolve()
      }

      const handlerPromises = handlers.map(safeInvoke)
      const waitForHandlers = Promise.allSettled(handlerPromises).then(() => undefined)

      let timeoutId
      let waitPromise = waitForHandlers

      if (typeof timeout === 'number') {
        const timeoutPromise = new Promise((resolve) => {
          timeoutId = setTimeout(() => {
            controller.abort(new Error('exit-timeout'))
            resolve()
          }, Math.max(timeout, 0))
        })

        waitPromise = Promise.race([waitForHandlers, timeoutPromise])
      }

      return waitPromise.finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        if (activeControllerRef.current === controller) {
          activeControllerRef.current = null
        }
      })
    },
    [cancelPending, timeoutMs]
  )

  const value = useMemo(
    () => ({
      registerParticipant,
      awaitAll,
      cancelPending,
    }),
    [awaitAll, cancelPending, registerParticipant]
  )

  return (
    <ExitAnimationCoordinatorContext.Provider value={value}>
      {children}
    </ExitAnimationCoordinatorContext.Provider>
  )
}

ExitAnimationCoordinatorProvider.propTypes = {
  children: PropTypes.node.isRequired,
  timeoutMs: PropTypes.number,
}

function useExitCoordinator() {
  return useContext(ExitAnimationCoordinatorContext)
}

function useExitParticipant({ id, onExit, enabled = true }) {
  const coordinator = useExitCoordinator()
  const fallbackId = useId()
  const participantId = id ?? fallbackId
  const latestHandlerRef = useRef(onExit)

  useEffect(() => {
    latestHandlerRef.current = onExit
  }, [onExit])

  useEffect(() => {
    if (!coordinator || !enabled || typeof latestHandlerRef.current !== 'function') {
      return undefined
    }
    return coordinator.registerParticipant(participantId, (options) => latestHandlerRef.current(options))
  }, [coordinator, enabled, participantId])

  const triggerExit = useCallback(
    (options) => {
      if (typeof latestHandlerRef.current === 'function') {
        return latestHandlerRef.current(options)
      }
      return Promise.resolve()
    },
    []
  )

  return { triggerExit }
}

function useCoordinatedNavigate({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const coordinator = useExitCoordinator()
  const navigate = useNavigate()
  const navSequenceRef = useRef(0)

  return useCallback(
    (to, options) => {
      if (!coordinator?.awaitAll) {
        navigate(to, options)
        return
      }

      const sequenceId = navSequenceRef.current + 1
      navSequenceRef.current = sequenceId

      ;(async () => {
        try {
          coordinator.cancelPending?.('navigation-request')
          await coordinator.awaitAll({ timeout: timeoutMs })
        } catch (error) {
          // no-op; navigation should still proceed
        } finally {
          if (navSequenceRef.current === sequenceId) {
            navigate(to, options)
          }
        }
      })()
    },
    [coordinator, navigate, timeoutMs]
  )
}

export {
  ExitAnimationCoordinatorProvider,
  useCoordinatedNavigate,
  useExitCoordinator,
  useExitParticipant,
}

