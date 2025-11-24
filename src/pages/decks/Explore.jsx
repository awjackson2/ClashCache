import { useMemo, useState, useEffect } from 'react'
import Deck from '../../components/Deck'
import { useDeckCache } from '../../state/DeckCacheContext.jsx'
import { usePlayerTag } from '../../state/PlayerTagContext.jsx'
import { createHungarianOptimizer, optimizeDeck } from '../../services/deckOptimizer'
import styles from './Explore.module.css'

function Explore() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isRefreshingLeaderboard, setIsRefreshingLeaderboard] = useState(false)
  const [isRefreshingDecks, setIsRefreshingDecks] = useState(false)
  const [refreshError, setRefreshError] = useState(null)
  const [refreshSuccess, setRefreshSuccess] = useState(null)
  const [decks, setDecks] = useState([])
  const [isLoadingDecks, setIsLoadingDecks] = useState(true)
  const [decksError, setDecksError] = useState(null)
  const { cachedDeckIds, addDeckToCache, removeDeckFromCache } = useDeckCache()
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

    const withScores = decks.map((deck) => {
      const optimized = optimizeDeck(deck, playerCards, hungarianOptimizer)
      const score =
        optimized && typeof optimized.optimizationScore === 'number'
          ? optimized.optimizationScore
          : null

      return {
        deck,
        optimizedDeck: optimized,
        score,
      }
    })

    withScores.sort((a, b) => {
      if (a.score == null && b.score == null) return 0
      if (a.score == null) return 1
      if (b.score == null) return -1
      return b.score - a.score
    })

    return withScores
  }, [decks, hasPlayerTag, currentPlayer, playerCards, hungarianOptimizer])

  const totalDecks = scoredDecks.length

  const currentEntry = useMemo(() => {
    if (!totalDecks) return null

    const safeIndex = ((currentIndex % totalDecks) + totalDecks) % totalDecks
    return scoredDecks[safeIndex]
  }, [currentIndex, totalDecks, scoredDecks])

  const currentDeck = currentEntry ? currentEntry.deck : null
  const optimizedDeck = currentEntry ? currentEntry.optimizedDeck : null
  const optimizationScore =
    currentEntry && typeof currentEntry.score === 'number'
      ? currentEntry.score
      : null

  const isCurrentSaved = currentDeck ? cachedDeckIds.includes(currentDeck.id) : false

  const goToPreviousDeck = () => {
    if (!totalDecks) return
    setCurrentIndex((prev) => (prev - 1 + totalDecks) % totalDecks)
  }

  const goToNextDeck = () => {
    if (!totalDecks) return
    setCurrentIndex((prev) => (prev + 1) % totalDecks)
  }

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
  }, [totalDecks])

  const handleRemoveFromCache = () => {
    if (!currentDeck) return

    // eslint-disable-next-line no-console
    console.log('Removing deck from cache:', {
      id: currentDeck.id,
      name: currentDeck.name,
      action: 'remove',
    })

    if (isCurrentSaved) {
      removeDeckFromCache(currentDeck.id)
    }
  }

  const handleSaveOriginalToCache = () => {
    if (!currentDeck || isCurrentSaved) return

    // eslint-disable-next-line no-console
    console.log('Saving ORIGINAL deck to cache:', {
      id: currentDeck.id,
      name: currentDeck.name,
    })

    addDeckToCache(currentDeck.id, currentDeck)
  }

  const handleSaveOptimizedToCache = () => {
    if (!currentDeck || isCurrentSaved) return
    if (!optimizedDeck || !Array.isArray(optimizedDeck.cards)) return

    // eslint-disable-next-line no-console
    console.log('Saving OPTIMIZED deck to cache:', {
      id: optimizedDeck.id,
      name: optimizedDeck.name,
    })

    addDeckToCache(optimizedDeck.id, optimizedDeck)
  }

  const handleRefreshLeaderboard = async () => {
    setIsRefreshingLeaderboard(true)
    setRefreshError(null)
    setRefreshSuccess(null)

    try {
      const response = await fetch(
        'https://us-central1-clash-cache.cloudfunctions.net/refreshTopPlayersLeaderboard',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Request failed with status ${response.status}`,
        )
      }

      const data = await response.json()
      setRefreshSuccess(
        `Successfully refreshed ${data.totalPlayers || 0} players from leaderboard!`,
      )
      setTimeout(() => setRefreshSuccess(null), 5000)
      // Reload decks after leaderboard refresh
      await fetchDecks()
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : 'Failed to refresh leaderboard',
      )
    } finally {
      setIsRefreshingLeaderboard(false)
    }
  }

  const handleRefreshDecks = async () => {
    setIsRefreshingDecks(true)
    setRefreshError(null)
    setRefreshSuccess(null)

    try {
      const response = await fetch(
        'https://us-central1-clash-cache.cloudfunctions.net/refreshTopPlayersDecks',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(
          errorData.error || `Request failed with status ${response.status}`,
        )
      }

      const data = await response.json()
      setRefreshSuccess(
        `Successfully refreshed decks for ${data.processedPlayers || 0} players!`,
      )
      setTimeout(() => setRefreshSuccess(null), 5000)
      // Reload decks after deck refresh
      await fetchDecks()
    } catch (error) {
      setRefreshError(
        error instanceof Error ? error.message : 'Failed to refresh decks',
      )
    } finally {
      setIsRefreshingDecks(false)
    }
  }

  return (
    <article className={styles.exploreRoot}>
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          alignItems: 'flex-end',
        }}
      >
        <button
          type="button"
          onClick={handleRefreshLeaderboard}
          disabled={isRefreshingLeaderboard}
          className="btn btn-sm btn-outline-light"
          style={{ minWidth: '140px' }}
        >
          {isRefreshingLeaderboard ? 'Refreshing...' : 'Refresh Leaderboard'}
        </button>
        <button
          type="button"
          onClick={handleRefreshDecks}
          disabled={isRefreshingDecks}
          className="btn btn-sm btn-outline-light"
          style={{ minWidth: '140px' }}
        >
          {isRefreshingDecks ? 'Refreshing...' : 'Refresh Decks'}
        </button>
        {refreshError && (
          <div
            className="alert alert-danger"
            style={{
              fontSize: '0.85rem',
              padding: '0.5rem 0.75rem',
              margin: 0,
              maxWidth: '300px',
            }}
          >
            {refreshError}
          </div>
        )}
        {refreshSuccess && (
          <div
            className="alert alert-success"
            style={{
              fontSize: '0.85rem',
              padding: '0.5rem 0.75rem',
              margin: 0,
              maxWidth: '300px',
            }}
          >
            {refreshSuccess}
          </div>
        )}
      </div>

      {isLoadingDecks ? (
        <p className={styles.emptyState}>Loading decks...</p>
      ) : decksError ? (
        <p className={styles.emptyState}>
          Error loading decks: {decksError}
        </p>
      ) : totalDecks === 0 ? (
        <p className={styles.emptyState}>No decks available to explore.</p>
      ) : (
        <div className={styles.browserArea}>
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
                <div className={styles.deckMeta}>
                  <h3 className={styles.deckName}>{currentDeck.name}</h3>
                </div>

                <div className={styles.decksContainer}>
                  <section className={styles.deckPanel} aria-label="Leaderboard deck">
                    <span className={styles.deckLabel}>Leaderboard deck</span>
                    <div className={styles.deckContainer}>
                      <Deck title={null} cards={currentDeck.cards} hideLevel />
                    </div>
                  </section>

                  {optimizedDeck ? (
                    <section
                      className={`${styles.deckPanel} ${styles.optimizedDeckPanel}`}
                      aria-label="Optimized deck"
                    >
                      <span className={styles.deckLabel}>Optimized for you</span>
                      <div className={styles.deckContainer}>
                        <Deck
                          title={null}
                          cards={optimizedDeck.cards}
                          hideLevel={false}
                          variant="optimized"
                        />
                      </div>
                      {typeof optimizationScore === 'number' && (
                        <span className={styles.deckScore}>
                          Score: {optimizationScore.toFixed(3)}
                        </span>
                      )}
                    </section>
                  ) : null}
                </div>

                <span className={styles.deckIndex}>
                  Deck {((currentIndex % totalDecks) + totalDecks) % totalDecks + 1} of {totalDecks}
                </span>
                <div className={styles.controlsRow}>
                  {isCurrentSaved ? (
                    <button
                      type="button"
                      className={styles.saveButton}
                      onClick={handleRemoveFromCache}
                    >
                      Remove from Cache
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.saveButton}
                        onClick={handleSaveOriginalToCache}
                      >
                        Save Original Deck
                      </button>
                      <button
                        type="button"
                        className={`${styles.saveButton} ${styles.saveButtonOptimized}`}
                        onClick={handleSaveOptimizedToCache}
                        disabled={!optimizedDeck}
                      >
                        Save Optimized Deck
                      </button>
                    </>
                  )}
                </div>
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


