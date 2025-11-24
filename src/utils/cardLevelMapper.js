// Utility for mapping player card levels onto a deck's cards in a pure, testable way

/**
 * Build a lookup map of player cards by id.
 *
 * @param {Array} playerCards
 * @returns {Map<string, any>}
 */
function buildPlayerCardIndex(playerCards) {
  const index = new Map()

  if (!Array.isArray(playerCards)) {
    return index
  }

  playerCards.forEach((card) => {
    if (!card || card.id === undefined || card.id === null) return
    const key = String(card.id)
    if (!index.has(key)) {
      index.set(key, card)
    }
  })

  return index
}

/**
 * Given a list of deck cards and the player's owned cards, return a new array
 * of deck cards where the `level` is updated from the player's collection
 * when available. All objects are cloned so the original data remains untouched.
 *
 * @param {Array} deckCards
 * @param {Array} playerCards
 * @returns {Array}
 */
function mapCardLevels(deckCards, playerCards) {
  if (!Array.isArray(deckCards)) {
    return []
  }

  const playerIndex = buildPlayerCardIndex(playerCards)

  return deckCards.map((card) => {
    if (!card || card.id === undefined || card.id === null) {
      return card
    }

    const playerCard = playerIndex.get(String(card.id))
    if (!playerCard) {
      // No owned version – keep original data
      return { ...card }
    }

    const playerLevel =
      typeof playerCard.level === 'number' && Number.isFinite(playerCard.level)
        ? playerCard.level
        : card.level

    return {
      ...card,
      level: playerLevel,
    }
  })
}

export { mapCardLevels }


