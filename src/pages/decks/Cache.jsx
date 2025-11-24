import SwimLane from '../../components/SwimLane'
import { useDeckCache } from '../../state/DeckCacheContext.jsx'
import { usePlayerTag } from '../../state/PlayerTagContext.jsx'
import styles from './Cache.module.css'

function groupDecksByCard(decks) {
  const lanesMap = new Map()

  decks.forEach((deck) => {
    const { cards = [] } = deck
    const seenInDeck = new Set()

    cards.forEach((card) => {
      if (!card) return

      const cardName = card.name || 'Unknown Card'

      // Avoid adding the same deck multiple times to one lane
      if (seenInDeck.has(cardName)) return
      seenInDeck.add(cardName)

      if (!lanesMap.has(cardName)) {
        lanesMap.set(cardName, { cardName, decks: [] })
      }

      lanesMap.get(cardName).decks.push(deck)
    })
  })

  return Array.from(lanesMap.values()).sort((a, b) => a.cardName.localeCompare(b.cardName))
}

function Cache() {
  const { cachedDecks } = useDeckCache()
  const { playerTag, currentPlayer } = usePlayerTag()

  const hasPlayerLevels =
    Boolean(playerTag) &&
    currentPlayer &&
    Array.isArray(currentPlayer.cards) &&
    currentPlayer.cards.length > 0

  const swimLanes = groupDecksByCard(cachedDecks)

  return (
    <article className={styles.cacheRoot}>
      {swimLanes.length === 0 ? (
        <p className={styles.emptyState}>No cached decks available.</p>
      ) : (
        swimLanes.map((lane) => (
          <SwimLane
            key={lane.cardName}
            cardName={lane.cardName}
            decks={lane.decks}
            // Show levels when we have a player with cards; otherwise hide to
            // avoid misleading defaults.
            hideLevel={!hasPlayerLevels}
          />
        ))
      )}
    </article>
  )
}

export default Cache

