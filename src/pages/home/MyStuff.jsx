import Card from '../../components/Card'
import { usePlayerTag } from '../../state/PlayerTagContext.jsx'

function MyStuff() {
  const { currentPlayer } = usePlayerTag()

  const cards = Array.isArray(currentPlayer?.cards) ? currentPlayer.cards : []

  if (!currentPlayer) {
    return (
      <section aria-label="My stuff">
        <h1>My stuff</h1>
        <p className="lead">Load a player tag on the left to see your card collection.</p>
      </section>
    )
  }

  return (
    <section aria-label="My stuff">
      <h1>My stuff</h1>
      <p className="lead" style={{ marginBottom: '1rem' }}>
        All cards in your collection, with their current levels.
      </p>
      {cards.length === 0 ? (
        <p style={{ color: '#9ca3af' }}>No cards found for this player.</p>
      ) : (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {cards.map((card) => (
            <div key={card.id} style={{ width: '150px' }}>
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


