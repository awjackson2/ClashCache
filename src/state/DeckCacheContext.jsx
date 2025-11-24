import { createContext, useContext, useMemo, useState, useEffect } from 'react'

const DECK_CACHE_STORAGE_KEY = 'clash-cache-deck-ids'

const DeckCacheContext = createContext(null)

function DeckCacheProvider({ children }) {
  // Load from localStorage on mount
  const [cachedDeckIds, setCachedDeckIds] = useState(() => {
    try {
      const stored = localStorage.getItem(DECK_CACHE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load deck cache from localStorage:', error)
    }
    return []
  })

  // Store deck data separately (loaded from Explore page)
  const [cachedDecksData, setCachedDecksData] = useState(() => {
    try {
      const stored = localStorage.getItem(`${DECK_CACHE_STORAGE_KEY}-data`)
      if (stored) {
        const parsed = JSON.parse(stored)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load deck cache data from localStorage:', error)
    }
    return []
  })

  // Save to localStorage whenever cachedDeckIds changes
  useEffect(() => {
    try {
      localStorage.setItem(DECK_CACHE_STORAGE_KEY, JSON.stringify(cachedDeckIds))
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save deck cache to localStorage:', error)
    }
  }, [cachedDeckIds])

  // Save deck data to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(
        `${DECK_CACHE_STORAGE_KEY}-data`,
        JSON.stringify(cachedDecksData),
      )
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to save deck cache data to localStorage:', error)
    }
  }, [cachedDecksData])

  const cachedDecks = useMemo(
    () => cachedDecksData.filter((deck) => cachedDeckIds.includes(deck.id)),
    [cachedDeckIds, cachedDecksData],
  )

  const addDeckToCache = (deckId, deckData) => {
    setCachedDeckIds((prev) => {
      if (prev.includes(deckId)) return prev
      return [...prev, deckId]
    })

    // Store deck data if provided
    if (deckData) {
      setCachedDecksData((prev) => {
        // Check if deck already exists
        const existingIndex = prev.findIndex((d) => d.id === deckId)
        if (existingIndex >= 0) {
          // Update existing deck
          const updated = [...prev]
          updated[existingIndex] = deckData
          return updated
        }
        // Add new deck
        return [...prev, deckData]
      })
    }
  }

  const removeDeckFromCache = (deckId) => {
    setCachedDeckIds((prev) => prev.filter((id) => id !== deckId))
    // Optionally remove deck data too (or keep it for potential re-add)
    setCachedDecksData((prev) => prev.filter((deck) => deck.id !== deckId))
  }

  const clearCache = () => {
    setCachedDeckIds([])
    setCachedDecksData([])
  }

  const value = useMemo(
    () => ({
      cachedDeckIds,
      cachedDecks,
      addDeckToCache,
      removeDeckFromCache,
      clearCache,
    }),
    [cachedDeckIds, cachedDecks],
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


