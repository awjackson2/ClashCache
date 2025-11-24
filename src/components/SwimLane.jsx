import PropTypes from 'prop-types'
import Deck from './Deck'
import styles from './SwimLane.module.css'

function SwimLane({ cardName, decks, hideLevel }) {
  return (
    <section className={styles.swimLane} aria-label={`Decks containing ${cardName}`}>
      <h3 className={styles.laneTitle}>{cardName}</h3>
      <div className={styles.decksRow}>
        {decks.map((deck) => (
          <div key={deck.id} className={styles.deckWrapper}>
            <Deck
              title={deck.name || `Deck ${deck.id}`}
              cards={deck.cards}
              hideLevel={hideLevel}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

SwimLane.propTypes = {
  cardName: PropTypes.string.isRequired,
  decks: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      name: PropTypes.string,
      cards: PropTypes.array.isRequired,
    }),
  ).isRequired,
  hideLevel: PropTypes.bool,
}

SwimLane.defaultProps = {
  hideLevel: false,
}

export default SwimLane


