import { createContext, useContext, useMemo, useState, useEffect } from 'react'

const DECK_PAIR_STORAGE_KEY = 'clash-cache-deck-pairs-v1'

const DeckCacheContext = createContext(null)

function DeckCacheProvider({ children }) {
  const [cachedPairs, setCachedPairs] = useState(() => {
    try {
      const stored = localStorage.getItem(DECK_PAIR_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          return parsed
            .filter(
              (pair) => pair && typeof pair === 'object' && typeof pair.pairId !== 'undefined',
            )
            .map((pair) => ({
              ...pair,
              savedAt: pair.savedAt ?? new Date().toISOString(),
            }))
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load deck pairs from localStorage:', error)
    }
    return []
  })

  useEffect(() => {
    try {
      localStorage.setItem(DECK_PAIR_STORAGE_KEY, JSON.stringify(cachedPairs))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save deck pairs to localStorage:', error)
    }
  }, [cachedPairs])

  const addPairToCache = (pair) => {
    if (!pair || typeof pair !== 'object' || !pair.pairId) {
      return
    }

    setCachedPairs((prev) => {
      const nextPair = {
        ...pair,
        savedAt: pair.savedAt ?? new Date().toISOString(),
      }
      const existingIndex = prev.findIndex((p) => p.pairId === nextPair.pairId)
      if (existingIndex >= 0) {
        const updated = [...prev]
        updated[existingIndex] = {
          ...updated[existingIndex],
          ...nextPair,
        }
        return updated
      }
      return [...prev, nextPair]
    })
  }

  const removePairFromCache = (pairId) => {
    setCachedPairs((prev) => prev.filter((pair) => pair.pairId !== pairId))
  }

  const clearCache = () => {
    setCachedPairs([])
  }

  const value = useMemo(
    () => ({
      cachedPairs,
      addPairToCache,
      removePairFromCache,
      clearCache,
    }),
    [cachedPairs],
  )

  return <DeckCacheContext.Provider value={value}>{children}</DeckCacheContext.Provider>
}

function useDeckCache() {
  const context = useContext(DeckCacheContext)
  if (!context) {
    throw new Error('useDeckCache must be used within a DeckCacheProvider')
  }
  return context
}

export { DeckCacheProvider, useDeckCache }


