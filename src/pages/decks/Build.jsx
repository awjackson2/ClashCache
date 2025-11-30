import { useState, useEffect, useMemo, useCallback } from 'react'
import { createDeckbuilder } from '../../services/smartDeckbuilder'
import { usePlayerTag } from '../../state/PlayerTagContext'
import { useDeckCache } from '../../state/DeckCacheContext'
import Deck from '../../components/Deck'
import Card from '../../components/Card'
import cardRoles from '../../data/card_roles.json'
import styles from './Build.module.css'

const TT_PARAM = '159000000'
const LABEL_PARAM = 'Royals'
const SLOTS_PARAM = '0;0;0;0;0;0;0;0'

/**
 * Reorder deck to place champions in the 3rd slot (index 2)
 * This is required for Clash Royale deck links
 */
function reorderDeckForLink(deckCards) {
  if (!Array.isArray(deckCards) || deckCards.length !== 8) {
    return deckCards
  }

  // Find champion card(s)
  const championIndex = deckCards.findIndex(
    (card) => card && String(card.rarity || '').toLowerCase() === 'champion'
  )

  // If no champion or champion is already in slot 2, return as-is
  if (championIndex === -1 || championIndex === 2) {
    return deckCards
  }

  // Create a new array with champion moved to index 2
  const reordered = [...deckCards]
  const champion = reordered[championIndex]
  
  // Remove champion from its current position
  reordered.splice(championIndex, 1)
  
  // Insert champion at index 2
  reordered.splice(2, 0, champion)

  return reordered
}

function buildDeckLink(deckCards) {
  if (!Array.isArray(deckCards) || deckCards.length !== 8) {
    return null
  }

  // Reorder deck to place champions in slot 2 (index 2)
  const reorderedCards = reorderDeckForLink(deckCards)

  const cardIds = reorderedCards
    .map((card) => {
      if (!card) return null

      const candidateIds = [
        card.cardID,
        card.cardId,
        card.id,
        card.clashId,
        card.meshId,
        card.key ? card.key.replace(/^\D+/, '') : null,
      ].map((value) => {
        if (value == null) return null
        const numericValue = Number(value)
        return Number.isFinite(numericValue) ? numericValue : null
      })

      const numericId = candidateIds.find((value) => Number.isInteger(value))
      return numericId != null ? String(numericId) : null
    })
    .filter(Boolean)

  if (cardIds.length !== 8) {
    return null
  }

  const deckParam = cardIds.join(';')
  const labelParam = LABEL_PARAM ? `&l=${encodeURIComponent(LABEL_PARAM)}` : ''

  return `https://link.clashroyale.com/en/?clashroyale://copyDeck?deck=${deckParam}${labelParam}&slots=${SLOTS_PARAM}&tt=${TT_PARAM}`
}

function Build() {
  const { currentPlayer, playerTag } = usePlayerTag()
  const { addPairToCache } = useDeckCache()
  const [goodDecks, setGoodDecks] = useState([])
  const [isLoadingDecks, setIsLoadingDecks] = useState(true)
  const [decksError, setDecksError] = useState(null)
  const [currentDeck, setCurrentDeck] = useState([]) // Array of card names
  const [deckbuilder, setDeckbuilder] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [deckScore, setDeckScore] = useState(null)

  // Memoize playerCards to prevent infinite loops in useEffect
  const playerCards = useMemo(() => {
    return Array.isArray(currentPlayer?.cards) ? currentPlayer.cards : []
  }, [currentPlayer?.cards])
  
  const hasPlayerTag = Boolean(playerTag)
  const isDeckComplete = currentDeck.length === 8

  // Fetch good decks for learning
  useEffect(() => {
    async function fetchDecks() {
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
          setGoodDecks(data.decks)
        } else {
          throw new Error('Invalid response format')
        }
      } catch (error) {
        setDecksError(
          error instanceof Error ? error.message : 'Failed to load decks',
        )
        setGoodDecks([])
      } finally {
        setIsLoadingDecks(false)
      }
    }

    fetchDecks()
  }, [])

  // Initialize deckbuilder when good decks are loaded
  useEffect(() => {
    if (goodDecks.length > 0) {
      try {
        const db = createDeckbuilder(goodDecks)
        setDeckbuilder(db)
      } catch (error) {
        console.error('Failed to create deckbuilder:', error)
        setDeckbuilder(null)
      }
    }
  }, [goodDecks])

  // Get suggestions when deck or player changes (only if deck has at least one card)
  useEffect(() => {
    if (!deckbuilder || !hasPlayerTag || !playerCards.length || currentDeck.length === 0) {
      setSuggestions([])
      return
    }

    try {
      const suggs = deckbuilder.suggestNextCard(currentDeck, playerCards, {
        topK: 8,
      })
      setSuggestions(suggs)
    } catch (error) {
      console.error('Failed to get suggestions:', error)
      setSuggestions([])
    }
  }, [deckbuilder, currentDeck, hasPlayerTag, playerCards])

  // Calculate deck score when deck changes
  useEffect(() => {
    if (!deckbuilder || !hasPlayerTag || !playerCards.length || currentDeck.length === 0) {
      setDeckScore(null)
      return
    }

    try {
      const score = deckbuilder.scoreDeck(currentDeck, playerCards)
      setDeckScore(score)
    } catch (error) {
      console.error('Failed to score deck:', error)
      setDeckScore(null)
    }
  }, [deckbuilder, currentDeck, hasPlayerTag, playerCards])

  // Convert card name to card object for display
  const getCardObject = useCallback(
    (cardName) => {
      if (!cardName) return null
      const normalizedName = String(cardName).trim()
      
      // Try exact match first
      let card = playerCards.find(
        (c) => String(c?.name || '').trim() === normalizedName,
      )
      
      // Try case-insensitive match if exact match fails
      if (!card) {
        card = playerCards.find(
          (c) => String(c?.name || '').trim().toLowerCase() === normalizedName.toLowerCase(),
        )
      }
      
      if (card) {
        return {
          id: card.id,
          name: card.name,
          image: card.iconUrls?.medium || '',
          evolutionImage: card.iconUrls?.evolutionMedium || null,
          level: card.level,
          rarity: card.rarity,
        }
      }
      
      // If card not found in player cards, return minimal object
      // This can happen if the deckbuilder suggests a backup card the player owns
      // but we don't have full card data for it
      return {
        id: normalizedName,
        name: normalizedName,
        image: '',
        evolutionImage: null,
        level: 1,
        rarity: undefined,
      }
    },
    [playerCards],
  )

  // Convert current deck (array of names) to card objects for display
  const currentDeckCards = useMemo(() => {
    return currentDeck.map((cardName) => getCardObject(cardName)).filter(Boolean)
  }, [currentDeck, getCardObject])

  // Handle adding a card to the deck
  const handleAddCard = useCallback(
    (cardName) => {
      setCurrentDeck((prev) => {
        if (prev.length >= 8) return prev
        if (prev.includes(cardName)) return prev // No duplicates
        return [...prev, cardName]
      })
    },
    [],
  )

  // Get available cards (not already in deck) for selection
  const availableCards = useMemo(() => {
    if (currentDeck.length > 0) return [] // Only show when deck is empty
    
    // Check winconditions
    const wincons = new Set(cardRoles.wincon || [])
    
    return playerCards
      .filter((card) => card && card.name)
      .map((card) => ({
        id: card.id,
        name: card.name,
        image: card.iconUrls?.medium || '',
        evolutionImage: card.iconUrls?.evolutionMedium || null,
        level: card.level,
        rarity: card.rarity,
        isWincon: wincons.has(card.name),
      }))
      .sort((a, b) => {
        // Sort winconditions first, then by name
        if (a.isWincon && !b.isWincon) return -1
        if (!a.isWincon && b.isWincon) return 1
        return (a.name || '').localeCompare(b.name || '')
      })
  }, [playerCards, currentDeck.length])

  // Handle removing a card from the deck
  const handleRemoveCard = useCallback((index) => {
    setCurrentDeck((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Handle card click in deck (remove it)
  const handleDeckCardClick = useCallback(
    (card) => {
      const index = currentDeck.findIndex(
        (name) => String(name).trim() === String(card?.name || '').trim(),
      )
      if (index >= 0) {
        handleRemoveCard(index)
      }
    },
    [currentDeck, handleRemoveCard],
  )


  // Clear the deck
  const handleClearDeck = useCallback(() => {
    setCurrentDeck([])
  }, [])

  // Get suggestion card objects
  const suggestionCards = useMemo(() => {
    return suggestions.map((sugg) => getCardObject(sugg.card)).filter(Boolean)
  }, [suggestions, getCardObject])

  // Build deck link for Clash Royale
  const deckLink = useMemo(() => {
    if (!isDeckComplete) return null
    return buildDeckLink(currentDeckCards)
  }, [isDeckComplete, currentDeckCards])

  // Handle saving deck to cache
  const handleSaveToCache = useCallback(() => {
    if (!isDeckComplete) return

    const deckObject = {
      id: `built-${Date.now()}`,
      name: 'Built Deck',
      cards: currentDeckCards,
    }

    const pair = {
      pairId: `built-${Date.now()}`,
      originalDeck: deckObject,
      optimizedDeck: null,
      optimizationScore: deckScore,
      savedAt: new Date().toISOString(),
    }

    addPairToCache(pair)
  }, [isDeckComplete, currentDeckCards, deckScore, addPairToCache])

  if (isLoadingDecks) {
    return (
      <article className={styles.buildRoot}>
        <div className={styles.loading}>Loading deckbuilder...</div>
      </article>
    )
  }

  if (decksError) {
    return (
      <article className={styles.buildRoot}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{decksError}</p>
        </div>
      </article>
    )
  }

  if (!deckbuilder) {
    return (
      <article className={styles.buildRoot}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>Failed to initialize deckbuilder. Please try refreshing the page.</p>
        </div>
      </article>
    )
  }

  return (
    <article className={styles.buildRoot}>
      <div className={styles.contentWrapper}>
        <header className={styles.header}>
          <h2 className={styles.title}>Build Deck</h2>
          <p className={styles.subtitle}>
            {hasPlayerTag
              ? 'Use AI-powered suggestions to build an optimal deck from your collection.'
              : 'Enter your player tag to get personalized deck suggestions.'}
          </p>
        </header>

        {!hasPlayerTag && (
          <div className={styles.warning}>
            <p>Please enter your player tag to use the deck builder.</p>
          </div>
        )}

        {hasPlayerTag && playerCards.length === 0 && (
          <div className={styles.warning}>
            <p>No player cards found. Please check your player tag.</p>
          </div>
        )}

        {hasPlayerTag && playerCards.length > 0 && (
          <>
            {currentDeck.length > 0 && (
              <div className={styles.controls}>
                <button
                  type="button"
                  onClick={handleClearDeck}
                  className={styles.clearButton}
                >
                  Clear Deck
                </button>
              </div>
            )}

            <div className={styles.deckSection}>
              <Deck
                title={isDeckComplete ? 'Your Complete Deck' : `Your Deck ${currentDeck.length}/8`}
                cards={currentDeckCards}
                onCardClick={handleDeckCardClick}
              />
              {deckScore !== null && (
                <div className={styles.scoreDisplay}>
                  <span className={styles.scoreLabel}>Deck Score:</span>
                  <span className={styles.scoreValue}>
                    {deckScore.toFixed(2)}
                  </span>
                </div>
              )}
            </div>

            {isDeckComplete && (
              <div className={styles.actionButtons}>
                <button
                  type="button"
                  onClick={handleSaveToCache}
                  className={styles.saveButton}
                >
                  Save to Cache
                </button>
                {deckLink && (
                  <a
                    href={deckLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={styles.openButton}
                  >
                    Open in Clash Royale
                  </a>
                )}
              </div>
            )}

            {!isDeckComplete && currentDeck.length === 0 && availableCards.length > 0 && (
              <div className={styles.cardPickerSection}>
                <h3 className={styles.cardPickerTitle}>
                  Select Your First Card
                </h3>
                <p className={styles.cardPickerSubtitle}>
                  Choose a card to start building your deck.
                </p>
                <div className={styles.cardPickerGrid}>
                  {availableCards.map((card) => (
                    <div
                      key={card.id || card.name}
                      className={styles.pickerCard}
                    >
                      <Card
                        id={card.id}
                        image={card.image}
                        level={card.level}
                        name={card.name}
                        rarity={card.rarity}
                        onClick={() => handleAddCard(card.name)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!isDeckComplete && currentDeck.length > 0 && suggestions.length > 0 && (
              <div className={styles.suggestionsSection}>
                <h3 className={styles.suggestionsTitle}>
                  Suggested Next Cards
                </h3>
                <div className={styles.suggestionsGrid}>
                  {suggestionCards.map((card, index) => {
                    const suggestion = suggestions[index]
                    return (
                      <div
                        key={card.id || card.name}
                        className={styles.suggestionCard}
                      >
                        <Card
                          id={card.id}
                          image={card.image}
                          level={card.level}
                          name={card.name}
                          rarity={card.rarity}
                          onClick={() => handleAddCard(card.name)}
                        />
                        {suggestion && (
                          <div className={styles.suggestionScore}>
                            Score: {suggestion.score.toFixed(2)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!isDeckComplete && currentDeck.length === 0 && availableCards.length === 0 && (
              <div className={styles.emptyState}>
                <p>No cards available. Please check your player tag.</p>
              </div>
            )}
          </>
        )}
      </div>
    </article>
  )
}

export default Build
