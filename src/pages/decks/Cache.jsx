import SwimLane from '../../components/SwimLane'
import { useDeckCache } from '../../state/DeckCacheContext.jsx'
import styles from './Cache.module.css'

function groupPairsByCard(pairs) {
  const lanesMap = new Map()

  pairs.forEach((pair) => {
    const { originalDeck, optimizedDeck } = pair
    const decksToIndex = [originalDeck, optimizedDeck].filter(
      (deck) => deck && Array.isArray(deck.cards),
    )

    const seenInPair = new Set()

    decksToIndex.forEach((deck) => {
      deck.cards.forEach((card) => {
        if (!card) return

        const cardName = card.name || 'Unknown Card'
        if (!cardName || seenInPair.has(cardName)) return
        seenInPair.add(cardName)

        if (!lanesMap.has(cardName)) {
          lanesMap.set(cardName, { cardName, pairs: [] })
        }

        lanesMap.get(cardName).pairs.push(pair)
      })
    })
  })

  return Array.from(lanesMap.values()).sort((a, b) => a.cardName.localeCompare(b.cardName))
}

function Cache() {
  const { cachedPairs, removePairFromCache } = useDeckCache()

  const swimLanes = groupPairsByCard(cachedPairs)

  return (
    <article className={styles.cacheRoot}>
      {swimLanes.length === 0 ? (
        <p className={styles.emptyState}>No cached decks available.</p>
      ) : (
        swimLanes.map((lane) => (
          <SwimLane
            key={lane.cardName}
            cardName={lane.cardName}
            pairs={lane.pairs}
            onRemovePair={removePairFromCache}
          />
        ))
      )}
    </article>
  )
}

export default Cache
