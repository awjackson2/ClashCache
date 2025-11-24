import PropTypes from 'prop-types'
import styles from './Card.module.css'
import placeholderImage from '../assets/download.jpg'

const PLACEHOLDER_IMAGE = placeholderImage


const RARITY_LEVEL_BONUS = {
  common: 0,
  rare: 2,
  epic: 5,
  legendary: 8,
  champion: 10,
}

function Card({ id, image, level, name, rarity, hideLevel, onClick, variant }) {
  const handleClick = () => {
    if (typeof onClick === 'function') {
      onClick({ id, image, level, name, rarity })
    }
  }

  const displayName = name || 'Unknown Card'
  const baseLevel = Number.isFinite(level) ? level : 1
  const rarityKey = typeof rarity === 'string' ? rarity.toLowerCase() : undefined
  const rarityBonus = RARITY_LEVEL_BONUS[rarityKey] ?? 0
  const displayLevel = Math.max(1, baseLevel + rarityBonus)
  const rootClassName =
    variant === 'optimized'
      ? `${styles.cardRoot} ${styles.cardRootOptimized}`
      : styles.cardRoot

  return (
    <button
      type="button"
      className={rootClassName}
      onClick={handleClick}
      aria-label={hideLevel ? displayName : `${displayName}, level ${displayLevel}`}
    >
      <span className={styles.srOnly}>{displayName}</span>
      <div className={styles.imageWrapper}>
        <img
          src={image || PLACEHOLDER_IMAGE}
          alt={displayName}
          className={styles.image}
          loading="lazy"
        />
        <div className={styles.overlay} />
      </div>
      <div className={styles.content}>
        <span className={styles.name}>{displayName}</span>
        {!hideLevel && <span className={styles.levelBadge}>Lv. {displayLevel}</span>}
      </div>
    </button>
  )
}

Card.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  image: PropTypes.string,
  level: PropTypes.number,
  name: PropTypes.string,
  rarity: PropTypes.string,
  hideLevel: PropTypes.bool,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(['default', 'optimized']),
}

Card.defaultProps = {
  image: undefined,
  level: 1,
  name: 'Unknown Card',
  rarity: undefined,
  hideLevel: false,
  onClick: undefined,
  variant: 'default',
}

export default Card


