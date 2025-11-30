import PropTypes from 'prop-types'
import DeckOptPair from './DeckOptPair'
import styles from './SwimLane.module.css'

function SwimLane({ cardName, pairs, onRemovePair }) {
  return (
    <section className={styles.swimLane} aria-label={`Decks containing ${cardName}`}>
      <h3 className={styles.laneTitle}>{cardName}</h3>
      <div className={styles.decksRow}>
        {pairs.map((pair) => (
          <div key={pair.pairId} className={styles.deckWrapper}>
            <DeckOptPair
              originalDeck={pair.originalDeck}
              optimizedDeck={pair.optimizedDeck}
              optimizationScore={pair.optimizationScore ?? undefined}
              ownerName={pair.ownerName}
              isSaved
              onRemove={onRemovePair ? () => onRemovePair(pair.pairId) : undefined}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

const deckShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  name: PropTypes.string,
  cards: PropTypes.arrayOf(PropTypes.object),
})

SwimLane.propTypes = {
  cardName: PropTypes.string.isRequired,
  pairs: PropTypes.arrayOf(
    PropTypes.shape({
      pairId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      originalDeck: deckShape.isRequired,
      optimizedDeck: deckShape,
      optimizationScore: PropTypes.number,
      ownerName: PropTypes.string,
    }),
  ).isRequired,
  onRemovePair: PropTypes.func,
}

SwimLane.defaultProps = {
  onRemovePair: undefined,
}

export default SwimLane

