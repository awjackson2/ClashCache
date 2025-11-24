import { createContext, useContext, useMemo, useState, useEffect } from 'react'

const PlayerTagContext = createContext(null)

function normalizeTag(rawTag) {
  const trimmed = String(rawTag || '').trim().toUpperCase()
  if (!trimmed) return ''
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`
}

async function fetchPlayerByTag(tag) {
  const normalized = normalizeTag(tag)
  if (!normalized) return null

  const encodedTag = encodeURIComponent(normalized)

  const response = await fetch(
    `https://us-central1-clash-cache.cloudfunctions.net/getPlayer?tag=${encodedTag}`,
  )

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const errorBody = await response.json()
      if (errorBody?.error) {
        message = errorBody.error
      } else if (errorBody?.message) {
        message = errorBody.message
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message)
  }

  return response.json()
}

function PlayerTagProvider({ children }) {
  const [playerTag, setPlayerTag] = useState('')
  const [currentPlayer, setCurrentPlayer] = useState(null)
  const [isLoadingPlayer, setIsLoadingPlayer] = useState(false)
  const [playerError, setPlayerError] = useState(null)

  const loadPlayerForTag = async (rawTag) => {
    const normalized = normalizeTag(rawTag)
    setPlayerTag(normalized)

    if (!normalized) {
      setCurrentPlayer(null)
      setPlayerError(null)
      return
    }

    setIsLoadingPlayer(true)
    setPlayerError(null)

    try {
      const player = await fetchPlayerByTag(normalized)
      setCurrentPlayer(player)
    } catch (error) {
      setCurrentPlayer(null)
      setPlayerError(error instanceof Error ? error.message : 'Failed to load player')
    } finally {
      setIsLoadingPlayer(false)
    }
  }

  // On first load in the browser, restore the last used player tag from
  // localStorage and fetch that player so refreshes keep context.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const storedTag = window.localStorage.getItem('playerTag')
    if (!storedTag) return

    const normalized = normalizeTag(storedTag)
    if (!normalized) return

    // Avoid refetching if state already matches.
    if (normalized === playerTag) return

    loadPlayerForTag(normalized)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the current normalized player tag to localStorage so it survives
  // page refreshes. Clearing the tag removes it from storage.
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (!playerTag) {
      window.localStorage.removeItem('playerTag')
    } else {
      window.localStorage.setItem('playerTag', playerTag)
    }
  }, [playerTag])

  const value = useMemo(
    () => ({
      playerTag,
      setPlayerTag,
      currentPlayer,
      isLoadingPlayer,
      playerError,
      loadPlayerForTag,
    }),
    [playerTag, currentPlayer, isLoadingPlayer, playerError],
  )

  return <PlayerTagContext.Provider value={value}>{children}</PlayerTagContext.Provider>
}

function usePlayerTag() {
  const context = useContext(PlayerTagContext)
  if (!context) {
    throw new Error('usePlayerTag must be used within a PlayerTagProvider')
  }
  return context
}

export { PlayerTagProvider, usePlayerTag }


