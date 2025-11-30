import PropTypes from 'prop-types'
import { FaBoxOpen } from 'react-icons/fa6'
import Deck from './Deck'
import styles from './DeckOptPair.module.css'

const deckShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name: PropTypes.string,
  ownerName: PropTypes.string,
  player: PropTypes.shape({
    name: PropTypes.string,
  }),
  cards: PropTypes.arrayOf(PropTypes.object),
})

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

function buildDeckLink(deck) {
  if (!deck || !Array.isArray(deck.cards)) {
    return null
  }

  // Reorder deck to place champions in slot 2 (index 2)
  const reorderedCards = reorderDeckForLink(deck.cards)

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

function resolveOwnerName(deck) {
  return (
    deck?.ownerName ??
    deck?.player?.name ??
    deck?.playerName ??
    deck?.playerTag ??
    deck?.owner ??
    null
  )
}

/**
 * Convert optimization score (out of 8) to a 5-star rating with half stars
 * @param {number} score - Score out of 8
 * @returns {number} - Number of stars (0-5, with 0.5 increments)
 */
function scoreToStars(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 0
  }
  
  // Convert score (0-8) to stars (0-5)
  const stars = (score / 8) * 5
  
  // Round to nearest 0.5
  return Math.round(stars * 2) / 2
}

/**
 * Render star rating component
 */
function StarRating({ stars }) {
  const fullStars = Math.floor(stars)
  const hasHalfStar = stars % 1 >= 0.5
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0)
  
  return (
    <span className={styles.starRating} aria-label={`${stars} out of 5 stars`}>
      {Array.from({ length: fullStars }, (_, i) => (
        <span key={`full-${i}`} className={styles.star} aria-hidden="true">★</span>
      ))}
      {hasHalfStar && (
        <span className={styles.starHalf} aria-hidden="true">
          <span className={styles.starHalfFilled}>★</span>
          <span className={styles.starHalfEmpty}>★</span>
        </span>
      )}
      {Array.from({ length: emptyStars }, (_, i) => (
        <span key={`empty-${i}`} className={styles.starEmpty} aria-hidden="true">★</span>
      ))}
    </span>
  )
}

StarRating.propTypes = {
  stars: PropTypes.number.isRequired,
}

/**
 * Identify which cards in the optimized deck were replaced
 * by comparing with the original deck at each position
 */
function identifyReplacedCards(originalCards, optimizedCards) {
  if (!Array.isArray(originalCards) || !Array.isArray(optimizedCards)) {
    return new Set()
  }

  const replacedIndices = new Set()
  
  // Compare cards at each position
  for (let i = 0; i < Math.min(originalCards.length, optimizedCards.length); i++) {
    const originalCard = originalCards[i]
    const optimizedCard = optimizedCards[i]
    
    if (!originalCard || !optimizedCard) {
      if (originalCard !== optimizedCard) {
        replacedIndices.add(i)
      }
      continue
    }
    
    // Compare by card ID (try multiple possible ID fields)
    const originalId = originalCard.id || originalCard.cardID || originalCard.cardId || originalCard.clashId || originalCard.meshId
    const optimizedId = optimizedCard.id || optimizedCard.cardID || optimizedCard.cardId || optimizedCard.clashId || optimizedCard.meshId
    
    if (originalId !== optimizedId) {
      replacedIndices.add(i)
    }
  }
  
  return replacedIndices
}

function DeckOptPair({
  originalDeck,
  optimizedDeck,
  optimizationScore,
  ownerName,
  isSaved,
  onSave,
  onRemove,
  className,
}) {
  // Always use the original deck's owner from the leaderboard deck
  // Ignore ownerName prop if it's "Unknown battler" - prefer original deck's owner
  const originalOwner = resolveOwnerName(originalDeck)
  const resolvedOwner = 
    (ownerName && ownerName !== 'Unknown battler') 
      ? ownerName 
      : originalOwner
  const showOptimized = Boolean(optimizedDeck && Array.isArray(optimizedDeck.cards))
  
  // Calculate star rating from optimization score
  const starRating = typeof optimizationScore === 'number' 
    ? scoreToStars(optimizationScore) 
    : null
  const handleAction = () => {
    if (isSaved && onRemove) {
      onRemove()
    } else if (!isSaved && onSave) {
      onSave()
    }
  }

  const originalDeckLink = buildDeckLink(originalDeck)
  const optimizedDeckLink = showOptimized ? buildDeckLink(optimizedDeck) : null

  // Identify which cards were replaced in the optimized deck
  const replacedCardIndices = showOptimized
    ? identifyReplacedCards(originalDeck?.cards ?? [], optimizedDeck.cards)
    : new Set()

  const actionLabel = isSaved ? 'Remove from cache' : 'Save to cache'
  const actionDisabled = (!isSaved && !onSave) || (isSaved && !onRemove)

  return (
    <article className={[styles.pairCard, className].filter(Boolean).join(' ')}>
      <div className={styles.deckArea}>
        <section className={styles.deckColumn} aria-label="Leaderboard deck">
          <span className={styles.deckLabel}>Leaderboard deck</span>
          <Deck title={null} cards={originalDeck?.cards ?? []} hideLevel />
          {originalDeckLink ? (
            <a
              className={styles.deckLink}
              href={originalDeckLink}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open in Clash Royale
            </a>
          ) : null}
        </section>
        {showOptimized ? (
          <section className={styles.deckColumn} aria-label="Optimized deck">
            <span className={styles.deckLabel}>Optimized for you</span>
            <Deck 
              title={null} 
              cards={optimizedDeck.cards} 
              variant="optimized"
              replacedCardIndices={replacedCardIndices}
            />
            {optimizedDeckLink ? (
              <a
                className={styles.deckLink}
                href={optimizedDeckLink}
                target="_blank"
                rel="noreferrer noopener"
              >
                Open in Clash Royale
              </a>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer className={styles.footer}>
        <div className={styles.meta}>
          {resolvedOwner && (
            <span className={styles.ownerLabel} aria-label="Deck owner">
              {resolvedOwner}
            </span>
          )}
          {starRating !== null ? (
            <span className={styles.score} aria-label="Optimization rating">
              <span className={styles.scoreLabel}>Optimization Rating:</span>
              <StarRating stars={starRating} />
            </span>
          ) : null}
        </div>
        <div className={styles.footerActions}>
          {(onSave || onRemove) && (
            <button
              type="button"
              className={[
                styles.actionButton,
                isSaved ? styles.actionButtonSaved : styles.actionButtonSave,
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={handleAction}
              disabled={actionDisabled}
            >
              <FaBoxOpen aria-hidden="true" />
              <span>{actionLabel}</span>
            </button>
          )}
          {isSaved && !onRemove ? (
            <span className={styles.savedBadge}>Saved</span>
          ) : null}
        </div>
      </footer>
    </article>
  )
}

DeckOptPair.propTypes = {
  originalDeck: deckShape.isRequired,
  optimizedDeck: deckShape,
  optimizationScore: PropTypes.number,
  ownerName: PropTypes.string,
  isSaved: PropTypes.bool,
  onSave: PropTypes.func,
  onRemove: PropTypes.func,
  className: PropTypes.string,
}

DeckOptPair.defaultProps = {
  optimizedDeck: null,
  optimizationScore: null,
  ownerName: undefined,
  isSaved: false,
  onSave: undefined,
  onRemove: undefined,
  className: undefined,
}

export default DeckOptPair


