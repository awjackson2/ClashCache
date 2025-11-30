import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import DeckOptPair from '../../components/DeckOptPair'
import { useDeckCache } from '../../state/DeckCacheContext.jsx'
import { usePlayerTag } from '../../state/PlayerTagContext.jsx'
import { createHungarianOptimizer, optimizeDeck } from '../../services/deckOptimizer'
import styles from './Explore.module.css'

function resolveOwner(deck) {
  return (
    deck?.ownerName ??
    deck?.player?.name ??
    deck?.playerName ??
    deck?.playerTag ??
    'Unknown battler'
  )
}

const STORAGE_STATE_KEY = 'explore/currentState'

function loadStoredState() {
  if (typeof window === 'undefined') {
    return { index: 0, deckId: null }
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_STATE_KEY)
    if (!raw) {
      return { index: 0, deckId: null }
    }

    const parsed = JSON.parse(raw)
    const index = Number(parsed?.index)
    const deckId =
      typeof parsed?.deckId === 'string' || typeof parsed?.deckId === 'number'
        ? String(parsed.deckId)
        : null

    return {
      index: Number.isFinite(index) && index >= 0 ? index : 0,
      deckId,
    }
  } catch (error) {
    return { index: 0, deckId: null }
  }
}

function persistState(ref, index, deckId) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const nextState = {
      index,
      deckId: deckId != null ? String(deckId) : null,
    }
    ref.current = nextState
    window.localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(nextState))
  } catch (error) {
    // ignore write failures
  }
}

function Explore() {
  const storedStateRef = useRef(loadStoredState())
  const appliedStoredStateRef = useRef(false)
  const [currentIndex, setCurrentIndex] = useState(() => storedStateRef.current.index ?? 0)
  const [filterInput, setFilterInput] = useState('')
  const swipeStateRef = useRef({
    startX: 0,
    startY: 0,
    isSwiping: false,
  })
  const [decks, setDecks] = useState([])
  const [isLoadingDecks, setIsLoadingDecks] = useState(true)
  const [decksError, setDecksError] = useState(null)
  const { cachedPairs, addPairToCache, removePairFromCache } = useDeckCache()
  const { playerTag, currentPlayer } = usePlayerTag()

  // Fetch decks from Firestore
  const fetchDecks = async () => {
    setIsLoadingDecks(true)
    setDecksError(null)

    try {
      const response = await fetch(
        'https://us-central1-clash-cache.cloudfunctions.net/getTopPlayersDecks',
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Request failed with status ${response.status}`,
        )
      }

      const data = await response.json()
      if (data.success && Array.isArray(data.decks)) {
        setDecks(data.decks)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (error) {
      setDecksError(
        error instanceof Error ? error.message : 'Failed to load decks',
      )
      setDecks([])
    } finally {
      setIsLoadingDecks(false)
    }
  }

  useEffect(() => {
    fetchDecks()
  }, [])

  useEffect(() => {
    appliedStoredStateRef.current = false
  }, [decks])

  const hasPlayerTag = Boolean(playerTag)
  const playerCards = Array.isArray(currentPlayer?.cards) ? currentPlayer.cards : []

  const hungarianOptimizer = useMemo(() => createHungarianOptimizer(), [])

  const scoredDecks = useMemo(() => {
    if (!decks.length) return []

    if (!hasPlayerTag || !currentPlayer || !playerCards.length) {
      return decks.map((deck) => ({
        deck,
        optimizedDeck: null,
        score: null,
      }))
    }

    const withScores = []

    decks.forEach((deck) => {
      const optimized = optimizeDeck(deck, playerCards, hungarianOptimizer)
      if (!optimized) {
        // Player cannot build this deck with owned cards.
        return
      }

      const score =
        typeof optimized.optimizationScore === 'number'
          ? optimized.optimizationScore
          : null

      withScores.push({
        deck,
        optimizedDeck: optimized,
        score,
      })
    })

    withScores.sort((a, b) => {
      if (a.score == null && b.score == null) return 0
      if (a.score == null) return 1
      if (b.score == null) return -1
      return b.score - a.score
    })

    return withScores
  }, [decks, hasPlayerTag, currentPlayer, playerCards, hungarianOptimizer])

  const filterTokens = useMemo(
    () =>
      filterInput
        .split(',')
        .map((token) => token.trim().toLowerCase())
        .filter(Boolean),
    [filterInput],
  )

  const filteredScoredDecks = useMemo(() => {
    if (!filterTokens.length) return scoredDecks

    return scoredDecks.filter(({ deck, optimizedDeck }) => {
      const decksToCheck =
        hasPlayerTag && optimizedDeck ? [optimizedDeck] : [deck]

      return filterTokens.every((token) =>
        decksToCheck.some((checkDeck) =>
          Array.isArray(checkDeck?.cards)
            ? checkDeck.cards.some((card) =>
                (card?.name || '').toLowerCase().includes(token),
              )
            : false,
        ),
      )
    })
  }, [filterTokens, hasPlayerTag, scoredDecks])

  const totalDecks = filteredScoredDecks.length

  useEffect(() => {
    if (!totalDecks) {
      return
    }

    if (!appliedStoredStateRef.current) {
      const { index: storedIndex, deckId: storedDeckId } = storedStateRef.current
      let targetIndex = -1

      if (storedDeckId != null) {
        targetIndex = filteredScoredDecks.findIndex(({ deck }) => String(deck?.id ?? '') === storedDeckId)
      }

      if (targetIndex < 0) {
        targetIndex = Number.isFinite(storedIndex)
          ? ((storedIndex % totalDecks) + totalDecks) % totalDecks
          : 0
      }

      appliedStoredStateRef.current = true
      const nextDeckId = filteredScoredDecks[targetIndex]?.deck?.id ?? null
      persistState(storedStateRef, targetIndex, nextDeckId)
      setCurrentIndex(targetIndex)
      return
    }

    setCurrentIndex((prev) => {
      const next = ((prev % totalDecks) + totalDecks) % totalDecks
      if (next !== prev) {
        const nextDeckId = filteredScoredDecks[next]?.deck?.id ?? null
        persistState(storedStateRef, next, nextDeckId)
        return next
      }
      return prev
    })
  }, [filteredScoredDecks, totalDecks])

  useEffect(() => {
    if (!totalDecks) {
      return
    }

    const safeIndex = ((currentIndex % totalDecks) + totalDecks) % totalDecks
    const deckId = filteredScoredDecks[safeIndex]?.deck?.id ?? null
    const normalizedDeckId = deckId != null ? String(deckId) : null
    const stored = storedStateRef.current

    if (stored.index === safeIndex && stored.deckId === normalizedDeckId) {
      return
    }

    persistState(storedStateRef, safeIndex, normalizedDeckId)
  }, [currentIndex, filteredScoredDecks, totalDecks])

  const currentEntry = useMemo(() => {
    if (!totalDecks) return null

    const safeIndex = ((currentIndex % totalDecks) + totalDecks) % totalDecks
    return filteredScoredDecks[safeIndex]
  }, [currentIndex, totalDecks, filteredScoredDecks])

  const currentDeck = currentEntry ? currentEntry.deck : null
  const optimizedDeck = currentEntry ? currentEntry.optimizedDeck : null
  const optimizationScore =
    currentEntry && typeof currentEntry.score === 'number'
      ? currentEntry.score
      : null

  const isCurrentSaved = currentDeck
    ? cachedPairs.some((pair) => pair.pairId === currentDeck.id)
    : false

  const goToPreviousDeck = useCallback(() => {
    if (!totalDecks) return
    setCurrentIndex((prev) => {
      const next = (prev - 1 + totalDecks) % totalDecks
      const nextDeckId = filteredScoredDecks[next]?.deck?.id ?? null
      persistState(storedStateRef, next, nextDeckId)
      return next
    })
  }, [filteredScoredDecks, totalDecks])

  const goToNextDeck = useCallback(() => {
    if (!totalDecks) return
    setCurrentIndex((prev) => {
      const next = (prev + 1) % totalDecks
      const nextDeckId = filteredScoredDecks[next]?.deck?.id ?? null
      persistState(storedStateRef, next, nextDeckId)
      return next
    })
  }, [filteredScoredDecks, totalDecks])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goToPreviousDeck()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        goToNextDeck()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [goToNextDeck, goToPreviousDeck])

  const resetSwipeState = useCallback(() => {
    swipeStateRef.current = {
      startX: 0,
      startY: 0,
      isSwiping: false,
    }
  }, [])

  const handleTouchStart = useCallback((event) => {
    if (event.touches.length !== 1) {
      return
    }
    const touch = event.touches[0]
    swipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      isSwiping: false,
    }
  }, [])

  const handleTouchMove = useCallback((event) => {
    if (event.touches.length !== 1) {
      return
    }

    const touch = event.touches[0]
    const diffX = touch.clientX - swipeStateRef.current.startX
    const diffY = touch.clientY - swipeStateRef.current.startY

    if (!swipeStateRef.current.isSwiping) {
      if (Math.abs(diffX) > 10 && Math.abs(diffX) > Math.abs(diffY)) {
        swipeStateRef.current.isSwiping = true
      } else {
        return
      }
    }

    if (event.cancelable) {
      event.preventDefault()
    }
  }, [])

  const handleTouchEnd = useCallback(
    (event) => {
      if (!event.changedTouches.length) {
        resetSwipeState()
        return
      }

      const touch = event.changedTouches[0]
      const diffX = touch.clientX - swipeStateRef.current.startX
      const diffY = touch.clientY - swipeStateRef.current.startY

      if (
        swipeStateRef.current.isSwiping &&
        Math.abs(diffX) > 40 &&
        Math.abs(diffX) > Math.abs(diffY)
      ) {
        if (diffX > 0) {
          goToPreviousDeck()
        } else {
          goToNextDeck()
        }
      }

      resetSwipeState()
    },
    [goToNextDeck, goToPreviousDeck, resetSwipeState],
  )

  const handleTouchCancel = useCallback(() => {
    resetSwipeState()
  }, [resetSwipeState])

  const handleRemoveFromCache = useCallback(() => {
    if (!currentDeck || !isCurrentSaved) return
    removePairFromCache(currentDeck.id)
  }, [currentDeck, isCurrentSaved, removePairFromCache])

  const handleSavePair = useCallback(() => {
    if (!currentDeck || isCurrentSaved) return

    addPairToCache({
      pairId: currentDeck.id,
      originalDeck: currentDeck,
      optimizedDeck: optimizedDeck ?? null,
      optimizationScore,
      ownerName: resolveOwner(currentDeck),
    })
  }, [addPairToCache, currentDeck, isCurrentSaved, optimizationScore, optimizedDeck])

  return (
    <article className={styles.exploreRoot}>
      <header className={styles.filterHeader}>
        <label className={styles.filterLabel} htmlFor="deck-card-filter">
          Filter by cards
        </label>
        <input
          id="deck-card-filter"
          type="search"
          className={styles.filterInput}
          placeholder="royal hogs, furnace, fireball"
          value={filterInput}
          onChange={(event) => {
            appliedStoredStateRef.current = false
            storedStateRef.current = { index: 0, deckId: null }
            setFilterInput(event.target.value)
            setCurrentIndex(0)
          }}
        />
      </header>

      {isLoadingDecks ? (
        <p className={styles.emptyState}>Loading decks...</p>
      ) : decksError ? (
        <p className={styles.emptyState}>
          Error loading decks: {decksError}
        </p>
      ) : totalDecks === 0 ? (
        <p className={styles.emptyState}>No decks available to explore.</p>
      ) : (
        <div
          className={styles.browserArea}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <button
            type="button"
            className={`${styles.navButton} ${styles.navButtonLeft}`}
            onClick={goToPreviousDeck}
            aria-label="Previous deck"
          >
            ‹
          </button>

          <div className={styles.deckWrapper}>
            {currentDeck ? (
              <>
                <DeckOptPair
                  originalDeck={currentDeck}
                  optimizedDeck={optimizedDeck}
                  optimizationScore={optimizationScore ?? undefined}
                  ownerName={resolveOwner(currentDeck)}
                  isSaved={isCurrentSaved}
                  onSave={handleSavePair}
                  onRemove={handleRemoveFromCache}
                />

                <span className={styles.deckIndex}>
                  Deck {((currentIndex % totalDecks) + totalDecks) % totalDecks + 1} of {totalDecks}
                </span>
              </>
            ) : null}
          </div>

          <button
            type="button"
            className={`${styles.navButton} ${styles.navButtonRight}`}
            onClick={goToNextDeck}
            aria-label="Next deck"
          >
            ›
          </button>
        </div>
      )}
    </article>
  )
}

export default Explore


