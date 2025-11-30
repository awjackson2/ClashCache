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
    deck?.owner ??
    'Unknown battler'
  )
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
  const resolvedOwner = ownerName || resolveOwnerName(originalDeck)
  const showOptimized = Boolean(optimizedDeck && Array.isArray(optimizedDeck.cards))
  const handleAction = () => {
    if (isSaved && onRemove) {
      onRemove()
    } else if (!isSaved && onSave) {
      onSave()
    }
  }

  const originalDeckLink = buildDeckLink(originalDeck)
  const optimizedDeckLink = showOptimized ? buildDeckLink(optimizedDeck) : null

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
            <Deck title={null} cards={optimizedDeck.cards} variant="optimized" />
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
          <span className={styles.ownerLabel} aria-label="Deck owner">
            {resolvedOwner}
          </span>
          {typeof optimizationScore === 'number' ? (
            <span className={styles.score} aria-label="Optimization score">
              Rating: {optimizationScore.toFixed(3)}
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


