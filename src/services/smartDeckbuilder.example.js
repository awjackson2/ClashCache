/**
 * Example usage of the Smart Deckbuilder
 * 
 * This file demonstrates how to use the smart deckbuilding engine.
 */

import { createDeckbuilder } from './smartDeckbuilder'

// Example: Initialize with good decks from your data source
// In a real app, you'd fetch these from your API or state
async function exampleUsage() {
  // Fetch good decks (e.g., from the Explore page's deck source)
  const response = await fetch(
    'https://us-central1-clash-cache.cloudfunctions.net/getTopPlayersDecks',
  )
  const data = await response.json()
  const goodDecks = data.decks || []
  
  // Create deckbuilder instance (precomputes all stats)
  const deckbuilder = createDeckbuilder(goodDecks)
  
  // Example player cards (from currentPlayer.cards)
  const playerCards = [
    { name: 'Knight', level: 12, rarity: 'common' },
    { name: 'Archers', level: 11, rarity: 'common' },
    { name: 'Fireball', level: 10, rarity: 'rare' },
    { name: 'Goblin Barrel', level: 9, rarity: 'epic' },
    // ... more cards
  ]
  
  // Build a complete deck
  const builtDeck = deckbuilder.buildDeck(playerCards, {
    beamWidth: 10, // Number of candidates to keep at each step
    deckSize: 8,   // Target deck size
    weights: {
      alpha: 1.0,   // Synergy weight
      beta: 0.5,    // Meta weight
      gamma: 0.3,   // Level weight
      lambda: 0.2,  // Role penalty weight
    },
  })
  
  console.log('Built deck:', builtDeck)
  // Output: ['Knight', 'Archers', 'Fireball', 'Goblin Barrel', ...]
  
  // Get suggestions for next card in interactive builder
  const currentDeck = ['Knight', 'Archers', 'Fireball']
  const suggestions = deckbuilder.suggestNextCard(currentDeck, playerCards, {
    topK: 5, // Return top 5 suggestions
  })
  
  console.log('Suggestions:', suggestions)
  // Output: [
  //   { card: 'Goblin Barrel', score: 0.85 },
  //   { card: 'Princess', score: 0.82 },
  //   ...
  // ]
  
  // Score an existing deck
  const deckToScore = ['Knight', 'Archers', 'Fireball', 'Goblin Barrel', 'Princess', 'The Log', 'Inferno Tower', 'Goblin Gang']
  const score = deckbuilder.scoreDeck(deckToScore, playerCards)
  
  console.log('Deck score:', score)
  
  // Access precomputed stats (for debugging)
  const stats = deckbuilder.getStats()
  console.log('Most frequent cards:', Object.entries(stats.freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10))
}

// React component example
export function useSmartDeckbuilder(goodDecks) {
  const [deckbuilder, setDeckbuilder] = React.useState(null)
  
  React.useEffect(() => {
    if (Array.isArray(goodDecks) && goodDecks.length > 0) {
      try {
        const db = createDeckbuilder(goodDecks)
        setDeckbuilder(db)
      } catch (error) {
        console.error('Failed to create deckbuilder:', error)
      }
    }
  }, [goodDecks])
  
  return deckbuilder
}

