import { usePlayerTag } from '../../state/PlayerTagContext.jsx'
import Card from '../../components/Card'
import styles from './MyStuff.module.css'

function MyStuff() {
  const { currentPlayer } = usePlayerTag()

  const cards = Array.isArray(currentPlayer?.cards) ? currentPlayer.cards : []

  if (!currentPlayer) {
    return (
      <section aria-label="My stuff" className={styles.section}>
        <h1>My stuff</h1>
        <p className="lead">Load a player tag on the left to see your card collection.</p>
      </section>
    )
  }

  return (
    <section aria-label="My stuff" className={styles.section}>
      <h1>My stuff</h1>
      <p className="lead">All cards in your collection, with their current levels.</p>
      {cards.length === 0 ? (
        <p className={styles.emptyState}>No cards found for this player.</p>
      ) : (
        <div className={styles.grid}>
          {cards.map((card) => (
            <div key={card.id} className={styles.cardSlot}>
              <Card
                id={card.id}
                name={card.name}
                level={card.level}
                rarity={card.rarity}
                image={card.iconUrls?.medium}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default MyStuff


