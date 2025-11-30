import PropTypes from 'prop-types'
import Card from './Card'
import styles from './Deck.module.css'

function Deck({ title, cards, hideLevel, onCardClick, variant, replacedCardIndices }) {
  const safeCards = Array.isArray(cards) ? cards.slice(0, 8) : []

  const paddedCards =
    safeCards.length < 8
      ? [...safeCards, ...Array.from({ length: 8 - safeCards.length }, () => null)]
      : safeCards

  const rootClassName =
    variant === 'optimized'
      ? `${styles.deckRoot} ${styles.deckRootOptimized}`
      : styles.deckRoot

  const handleCardClick = (card) => {
    if (typeof onCardClick === 'function') {
      onCardClick(card)
    }
  }

  // Convert replacedCardIndices to Set if it's not already
  const replacedSet = replacedCardIndices instanceof Set 
    ? replacedCardIndices 
    : Array.isArray(replacedCardIndices) 
      ? new Set(replacedCardIndices) 
      : new Set()

  return (
    <section className={rootClassName} aria-label={title || 'Deck'}>
      {title ? <h3 className={styles.title}>{title}</h3> : null}
      <div className={styles.grid}>
        {paddedCards.map((card, index) => {
          if (!card) {
            return (
              <div key={`empty-${index}`} className={styles.cardCell}>
                <div className={styles.empty}>Empty</div>
              </div>
            )
          }

          const { id, image, evolutionImage, level, name, rarity } = card

          // Use evolution art for first two slots (index 0 and 1) if available
          const displayImage =
            (index === 0 || index === 1) && evolutionImage
              ? evolutionImage
              : image

          const isReplaced = replacedSet.has(index)

          return (
            <div key={id} className={styles.cardCell}>
              <Card
                id={id}
                image={displayImage}
                level={level}
                name={name}
                rarity={rarity}
                hideLevel={hideLevel}
                onClick={handleCardClick}
                variant={variant}
                isReplaced={isReplaced}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}

const cardShape = PropTypes.shape({
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  image: PropTypes.string,
  evolutionImage: PropTypes.string,
  level: PropTypes.number,
  name: PropTypes.string,
})

Deck.propTypes = {
  title: PropTypes.string,
  cards: PropTypes.arrayOf(cardShape).isRequired,
  hideLevel: PropTypes.bool,
  onCardClick: PropTypes.func,
  variant: PropTypes.oneOf(['default', 'optimized']),
  replacedCardIndices: PropTypes.oneOfType([
    PropTypes.instanceOf(Set),
    PropTypes.arrayOf(PropTypes.number),
  ]),
}

Deck.defaultProps = {
  title: undefined,
  hideLevel: false,
  onCardClick: undefined,
  variant: 'default',
  replacedCardIndices: undefined,
}

export default Deck


