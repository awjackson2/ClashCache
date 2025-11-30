/**
 * Smart Deckbuilding Engine 2.0
 * 
 * Implements a deckbuilding engine that:
 * - Learns synergy, structure, and card relationships from high-quality decks
 * - Adapts suggestions to a specific player's card levels
 * - Uses a card→replacement mapping when the player is missing cards
 * - Builds entire decks or suggests the next card for an interactive builder UI
 * - Avoids manually coded constraints by learning them automatically
 */

import cardBackups from '../data/card_backups.json'
import cardRoles from '../data/card_roles.json'

// Type definitions (conceptual, JS doesn't enforce these)
// type CardId = string
// type Deck = CardId[]
// type Role = "spell" | "building" | "wincon" | "unit"

const EPS = 1e-9 // Small epsilon for numerical stability

// Default scoring weights (tunable)
const DEFAULT_WEIGHTS = {
  alpha: 1.0,   // synergy weight
  beta: 0.5,    // meta weight
  gamma: 0.3,   // level weight
  lambda: 0.2,  // role penalty weight
  mu: 2.0,      // hard constraint penalty weight (multiple wincons/buildings, >2 spells)
  nu: 1.5,      // frequency penalty weight (punish rare cards)
  w_meta: 0.6,  // backup selection: meta weight
  w_level: 0.4, // backup selection: level weight
}

// Default beam width for search
const DEFAULT_BEAM_WIDTH = 10

/**
 * Build role mapping from card name to role
 */
function buildRoleMap() {
  const roleMap = new Map()
  
  // Process each role category
  Object.entries(cardRoles).forEach(([role, cardNames]) => {
    if (Array.isArray(cardNames)) {
      cardNames.forEach((cardName) => {
        const name = String(cardName).trim()
        if (name) {
          // Cards can have multiple roles (e.g., a card can be both wincon and building)
          // We'll use the first role found, or prioritize wincon > building > spell
          // Note: "unit" is the default for cards not in any category
          if (!roleMap.has(name)) {
            roleMap.set(name, role)
          } else {
            // Prioritize more specific roles
            const currentRole = roleMap.get(name)
            const priority = { wincon: 4, building: 3, spell: 2 }
            if (priority[role] > (priority[currentRole] || 0)) {
              roleMap.set(name, role)
            }
          }
        }
      })
    }
  })
  
  return roleMap
}

/**
 * Build backup mapping from card name to array of backup card names
 */
function buildBackupMap() {
  const backupMap = new Map()
  
  if (Array.isArray(cardBackups)) {
    cardBackups.forEach((entry) => {
      if (!entry || !entry.name) return
      const cardName = String(entry.name).trim()
      if (!cardName) return
      
      const backups = []
      if (Array.isArray(entry.backups)) {
        entry.backups.forEach((backup) => {
          if (backup && backup.name) {
            const backupName = String(backup.name).trim()
            if (backupName) {
              backups.push(backupName)
            }
          }
        })
      }
      
      backupMap.set(cardName, backups)
    })
  }
  
  return backupMap
}

/**
 * Extract card names from a deck
 * @param {Array} deck - Deck object with cards array, or array of card objects/names
 * @returns {string[]} Array of card names
 */
function extractCardNames(deck) {
  if (!deck) return []
  
  // If it's an array of strings, return as-is
  if (Array.isArray(deck) && deck.length > 0 && typeof deck[0] === 'string') {
    return deck.map((name) => String(name).trim()).filter(Boolean)
  }
  
  // If it's an array of objects with name property
  if (Array.isArray(deck)) {
    return deck
      .map((card) => {
        if (typeof card === 'string') return card
        if (card && card.name) return String(card.name).trim()
        return null
      })
      .filter(Boolean)
  }
  
  // If it's an object with cards array
  if (deck.cards && Array.isArray(deck.cards)) {
    return extractCardNames(deck.cards)
  }
  
  return []
}

/**
 * Compute DeckStats from a collection of good decks
 * @param {Array} goodDecks - Array of deck objects or arrays of card names
 * @returns {Object} DeckStats object
 */
function computeDeckStats(goodDecks) {
  if (!Array.isArray(goodDecks) || goodDecks.length === 0) {
    throw new Error('goodDecks must be a non-empty array')
  }
  
  const N = goodDecks.length
  const roleMap = buildRoleMap()
  const freq = new Map()
  const p2 = new Map() // p2[card1][card2] = joint probability
  const roleCounts = { spell: [], building: [], wincon: [], unit: [] }
  
  // First pass: count frequencies and co-occurrences
  goodDecks.forEach((deck) => {
    const cardNames = extractCardNames(deck)
    if (cardNames.length === 0) return
    
    const uniqueCards = [...new Set(cardNames)]
    
    // Count frequencies
    uniqueCards.forEach((card) => {
      freq.set(card, (freq.get(card) || 0) + 1)
    })
    
    // Count co-occurrences (unordered pairs)
    for (let i = 0; i < uniqueCards.length; i++) {
      const c1 = uniqueCards[i]
      if (!p2.has(c1)) {
        p2.set(c1, new Map())
      }
      
      for (let j = i + 1; j < uniqueCards.length; j++) {
        const c2 = uniqueCards[j]
        const current = p2.get(c1).get(c2) || 0
        p2.get(c1).set(c2, current + 1)
      }
    }
    
    // Count roles
    const roleCount = { spell: 0, building: 0, wincon: 0, unit: 0 }
    uniqueCards.forEach((card) => {
      const role = roleMap.get(card) || 'unit'
      roleCount[role] = (roleCount[role] || 0) + 1
    })
    
    Object.keys(roleCount).forEach((role) => {
      roleCounts[role].push(roleCount[role])
    })
  })
  
  // Compute probabilities
  const maxFreq = Math.max(...Array.from(freq.values()), 1)
  const freqNorm = new Map()
  const p = new Map()
  
  freq.forEach((count, card) => {
    p.set(card, count / N)
    freqNorm.set(card, count / maxFreq)
  })
  
  // Compute PMI
  const PMI = new Map()
  p2.forEach((cooccurMap, c1) => {
    const pmiMap = new Map()
    const p1 = p.get(c1) || EPS
    
    cooccurMap.forEach((jointCount, c2) => {
      const p2_val = p.get(c2) || EPS
      const jointProb = jointCount / N
      const pmi = Math.log((jointProb + EPS) / (p1 * p2_val + EPS))
      pmiMap.set(c2, pmi)
    })
    
    PMI.set(c1, pmiMap)
  })
  
  // Compute role statistics
  const roleStats = {
    mean: {},
    std: {},
  }
  
  Object.keys(roleCounts).forEach((role) => {
    const counts = roleCounts[role]
    if (counts.length === 0) {
      roleStats.mean[role] = 0
      roleStats.std[role] = 1
      return
    }
    
    const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length
    const variance =
      counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length
    const std = Math.sqrt(variance) || 1
    
    roleStats.mean[role] = mean
    roleStats.std[role] = std
  })
  
  // Convert Maps to objects for easier access
  const freqObj = {}
  const freqNormObj = {}
  const pObj = {}
  const p2Obj = {}
  const pmiObj = {}
  
  freq.forEach((value, key) => {
    freqObj[key] = value
    freqNormObj[key] = freqNorm.get(key)
    pObj[key] = p.get(key)
  })
  
  p2.forEach((cooccurMap, c1) => {
    p2Obj[c1] = {}
    pmiObj[c1] = {}
    cooccurMap.forEach((value, c2) => {
      p2Obj[c1][c2] = value / N
      pmiObj[c1][c2] = PMI.get(c1)?.get(c2) || 0
    })
  })
  
  return {
    freq: freqObj,
    freqNorm: freqNormObj,
    p: pObj,
    p2: p2Obj,
    PMI: pmiObj,
    roleStats,
  }
}

/**
 * Get backup replacement for a card
 * @param {string} cardName - Original card name
 * @param {Map|Object} playerLevels - Map or object of card name -> level
 * @param {Object} deckStats - DeckStats object
 * @param {Object} backupMap - Map of card name -> backup names array
 * @param {Object} weights - Weight configuration
 * @returns {string|null} Best replacement card name, or null if none found
 */
function getBackupReplacement(cardName, playerLevels, deckStats, backupMap, weights = {}) {
  const w_meta = weights.w_meta ?? DEFAULT_WEIGHTS.w_meta
  const w_level = weights.w_level ?? DEFAULT_WEIGHTS.w_level
  
  // Check if player owns the original card
  const playerLevel = typeof playerLevels.get === 'function' 
    ? playerLevels.get(cardName) 
    : playerLevels[cardName]
  
  if (playerLevel && playerLevel > 0) {
    return cardName // Player owns it, no replacement needed
  }
  
  // Get backups
  const backups = backupMap.get(cardName) || []
  if (backups.length === 0) {
    return null // No backups available
  }
  
  // Filter to owned backups
  const ownedBackups = backups.filter((backup) => {
    const level = typeof playerLevels.get === 'function' 
      ? playerLevels.get(backup) 
      : playerLevels[backup]
    return level && level > 0
  })
  
  if (ownedBackups.length === 0) {
    return null // Player doesn't own any backups
  }
  
  // Find max level for normalization
  const allLevels = Array.from(
    typeof playerLevels.get === 'function' 
      ? playerLevels.values() 
      : Object.values(playerLevels)
  ).filter(Number.isFinite)
  const maxLevel = Math.max(...allLevels, 1)
  
  // Score each backup
  let bestBackup = null
  let bestScore = -Infinity
  
  ownedBackups.forEach((backup) => {
    const level = typeof playerLevels.get === 'function' 
      ? playerLevels.get(backup) 
      : playerLevels[backup]
    const freqNorm = deckStats.freqNorm[backup] || 0
    const levelNorm = level / maxLevel
    
    const score = freqNorm * w_meta + levelNorm * w_level
    
    if (score > bestScore) {
      bestScore = score
      bestBackup = backup
    }
  })
  
  return bestBackup
}

/**
 * Count roles in a deck
 * @param {string[]} deck - Array of card names
 * @param {Map} roleMap - Map of card name -> role
 * @returns {Object} Role counts
 */
function countRoles(deck, roleMap) {
  const counts = { spell: 0, building: 0, wincon: 0, unit: 0 }
  
  deck.forEach((card) => {
    const role = roleMap.get(card) || 'unit'
    counts[role] = (counts[role] || 0) + 1
  })
  
  return counts
}

/**
 * Compute synergy score for a deck
 * @param {string[]} deck - Array of card names
 * @param {Object} deckStats - DeckStats object
 * @returns {number} Synergy score
 */
function computeSynergy(deck, deckStats) {
  if (deck.length < 2) return 0
  
  const uniqueCards = [...new Set(deck)]
  if (uniqueCards.length < 2) return 0
  
  let totalPMI = 0
  let pairCount = 0
  
  for (let i = 0; i < uniqueCards.length; i++) {
    const c1 = uniqueCards[i]
    for (let j = i + 1; j < uniqueCards.length; j++) {
      const c2 = uniqueCards[j]
      
      // Get PMI (symmetric, so check both directions)
      const pmi = deckStats.PMI[c1]?.[c2] || deckStats.PMI[c2]?.[c1] || 0
      totalPMI += pmi
      pairCount += 1
    }
  }
  
  return pairCount > 0 ? totalPMI / pairCount : 0
}

/**
 * Compute meta strength score
 * @param {string[]} deck - Array of card names
 * @param {Object} deckStats - DeckStats object
 * @returns {number} Meta score
 */
function computeMeta(deck, deckStats) {
  if (deck.length === 0) return 0
  
  const uniqueCards = [...new Set(deck)]
  const totalFreqNorm = uniqueCards.reduce((sum, card) => {
    return sum + (deckStats.freqNorm[card] || 0)
  }, 0)
  
  return totalFreqNorm / uniqueCards.length
}

/**
 * Compute frequency penalty for rare cards
 * Heavily punishes cards that don't appear often in top decks
 * @param {string[]} deck - Array of card names
 * @param {Object} deckStats - DeckStats object
 * @returns {number} Frequency penalty (positive value to subtract)
 */
function computeFrequencyPenalty(deck, deckStats) {
  if (deck.length === 0) return 0
  
  const uniqueCards = [...new Set(deck)]
  let totalPenalty = 0
  
  uniqueCards.forEach((card) => {
    const freqNorm = deckStats.freqNorm[card] || 0
    // Quadratic penalty: (1 - freqNorm)^2
    // Cards with freqNorm = 0 (never seen) get penalty of 1
    // Cards with freqNorm = 1 (most common) get penalty of 0
    // Cards with freqNorm = 0.5 get penalty of 0.25
    const penalty = Math.pow(1 - freqNorm, 2)
    totalPenalty += penalty
  })
  
  // Return average penalty per card
  return totalPenalty / uniqueCards.length
}

/**
 * Compute level score
 * @param {string[]} deck - Array of card names
 * @param {Map|Object} playerLevels - Map or object of card name -> level
 * @returns {number} Level score
 */
function computeLevelScore(deck, playerLevels) {
  if (deck.length === 0) return 0
  
  const allLevels = Array.from(
    typeof playerLevels.get === 'function' 
      ? playerLevels.values() 
      : Object.values(playerLevels)
  ).filter(Number.isFinite)
  const maxLevel = Math.max(...allLevels, 1)
  
  const uniqueCards = [...new Set(deck)]
  const totalLevelNorm = uniqueCards.reduce((sum, card) => {
    const level = typeof playerLevels.get === 'function' 
      ? playerLevels.get(card) 
      : playerLevels[card]
    const levelNorm = (level || 0) / maxLevel
    return sum + levelNorm
  }, 0)
  
  return totalLevelNorm / uniqueCards.length
}

/**
 * Compute role deviation penalty
 * @param {string[]} deck - Array of card names
 * @param {Object} deckStats - DeckStats object
 * @param {Map} roleMap - Map of card name -> role
 * @returns {number} Role penalty (positive value to subtract)
 */
function computeRolePenalty(deck, deckStats, roleMap) {
  const roleCounts = countRoles(deck, roleMap)
  let penalty = 0
  
  Object.keys(roleCounts).forEach((role) => {
    const count = roleCounts[role]
    const mean = deckStats.roleStats.mean[role] || 0
    const std = deckStats.roleStats.std[role] || 1
    
    if (std > 0) {
      const z = (count - mean) / std
      penalty += z * z // squared z-score
    }
  })
  
  return penalty
}

/**
 * Compute hard constraint penalties
 * Punishes: multiple win conditions, multiple buildings, more than 2 spells
 * @param {string[]} deck - Array of card names
 * @param {Map} roleMap - Map of card name -> role
 * @returns {number} Hard constraint penalty (positive value to subtract)
 */
function computeHardConstraintPenalty(deck, roleMap) {
  const roleCounts = countRoles(deck, roleMap)
  let penalty = 0
  
  // Penalize multiple win conditions (>1)
  if (roleCounts.wincon > 1) {
    // Quadratic penalty: more wincons = exponentially worse
    penalty += (roleCounts.wincon - 1) * (roleCounts.wincon - 1) * 10
  }
  
  // Penalize multiple buildings (>1)
  if (roleCounts.building > 1) {
    // Quadratic penalty: more buildings = exponentially worse
    penalty += (roleCounts.building - 1) * (roleCounts.building - 1) * 10
  }
  
  // Penalize more than 2 spells (>2)
  if (roleCounts.spell > 2) {
    // Linear penalty for each spell over 2
    penalty += (roleCounts.spell - 2) * 5
  }
  
  return penalty
}

/**
 * Score a deck
 * @param {string[]} deck - Array of card names
 * @param {Object} deckStats - DeckStats object
 * @param {Map|Object} playerLevels - Map or object of card name -> level
 * @param {Map} roleMap - Map of card name -> role
 * @param {Object} weights - Weight configuration
 * @returns {number} Deck score
 */
function scoreDeck(deck, deckStats, playerLevels, roleMap, weights = {}) {
  const alpha = weights.alpha ?? DEFAULT_WEIGHTS.alpha
  const beta = weights.beta ?? DEFAULT_WEIGHTS.beta
  const gamma = weights.gamma ?? DEFAULT_WEIGHTS.gamma
  const lambda = weights.lambda ?? DEFAULT_WEIGHTS.lambda
  const mu = weights.mu ?? DEFAULT_WEIGHTS.mu
  const nu = weights.nu ?? DEFAULT_WEIGHTS.nu
  
  const synergy = computeSynergy(deck, deckStats)
  const meta = computeMeta(deck, deckStats)
  const levelScore = computeLevelScore(deck, playerLevels)
  const rolePenalty = computeRolePenalty(deck, deckStats, roleMap)
  const hardConstraintPenalty = computeHardConstraintPenalty(deck, roleMap)
  const frequencyPenalty = computeFrequencyPenalty(deck, deckStats)
  
  return alpha * synergy + beta * meta + gamma * levelScore - lambda * rolePenalty - mu * hardConstraintPenalty - nu * frequencyPenalty
}

/**
 * Score a partial deck (for beam search)
 * @param {string[]} partialDeck - Array of card names (may be incomplete)
 * @param {Object} deckStats - DeckStats object
 * @param {Map|Object} playerLevels - Map or object of card name -> level
 * @param {Map} roleMap - Map of card name -> role
 * @param {Object} weights - Weight configuration
 * @returns {number} Partial deck score
 */
function scorePartialDeck(partialDeck, deckStats, playerLevels, roleMap, weights = {}) {
  // Use same scoring function, but it will naturally handle partial decks
  return scoreDeck(partialDeck, deckStats, playerLevels, roleMap, weights)
}

/**
 * Build player levels map from player cards array
 * @param {Array} playerCards - Array of card objects with name and level
 * @returns {Map} Map of card name -> level
 */
function buildPlayerLevelsMap(playerCards) {
  const levels = new Map()
  
  if (!Array.isArray(playerCards)) return levels
  
  playerCards.forEach((card) => {
    if (!card || !card.name) return
    const name = String(card.name).trim()
    if (!name) return
    
    const level = Number(card.level)
    if (!Number.isFinite(level) || level <= 0) return
    
    // Keep highest level if duplicate names
    const existing = levels.get(name)
    if (!existing || level > existing) {
      levels.set(name, level)
    }
  })
  
  return levels
}

/**
 * Get all playable cards (owned cards, with replacements applied)
 * @param {Map} playerLevels - Map of card name -> level
 * @param {Object} backupMap - Map of card name -> backup names array
 * @param {Object} deckStats - DeckStats object
 * @param {Object} weights - Weight configuration
 * @returns {Set} Set of playable card names
 */
function getPlayableCards(playerLevels, backupMap, deckStats, weights = {}) {
  const playable = new Set()
  
  // Add all owned cards
  playerLevels.forEach((level, cardName) => {
    if (level > 0) {
      playable.add(cardName)
    }
  })
  
  // Add all backups that are owned (they can replace their originals)
  backupMap.forEach((backups, originalCard) => {
    backups.forEach((backup) => {
      const level = typeof playerLevels.get === 'function' 
        ? playerLevels.get(backup) 
        : playerLevels[backup]
      if (level && level > 0) {
        playable.add(backup)
      }
    })
  })
  
  return playable
}

/**
 * Build a deck using beam search
 * @param {Object} deckStats - DeckStats object
 * @param {Map|Object} playerLevels - Map or object of card name -> level
 * @param {Object} backupMap - Map of card name -> backup names array
 * @param {Map} roleMap - Map of card name -> role
 * @param {Object} options - Configuration options
 * @returns {string[]|null} Best deck (array of card names) or null if no valid deck found
 */
function buildDeckBeamSearch(deckStats, playerLevels, backupMap, roleMap, options = {}) {
  const beamWidth = options.beamWidth ?? DEFAULT_BEAM_WIDTH
  const weights = options.weights || {}
  const targetDeckSize = options.deckSize ?? 8
  
  // Convert playerLevels to Map if needed
  const playerLevelsMap = playerLevels instanceof Map 
    ? playerLevels 
    : new Map(Object.entries(playerLevels))
  
  // Get playable cards
  const playableCards = getPlayableCards(playerLevelsMap, backupMap, deckStats, weights)
  const playableArray = Array.from(playableCards)
  
  if (playableArray.length === 0) {
    return null
  }
  
  // Initialize beam with empty deck
  let beams = [{ deck: [], score: 0 }]
  
  // Build deck slot by slot
  for (let step = 0; step < targetDeckSize; step++) {
    const candidates = []
    
    // Expand each beam
    beams.forEach(({ deck, score: _ }) => {
      playableArray.forEach((card) => {
        // Skip if card already in deck
        if (deck.includes(card)) return
        
        const newDeck = [...deck, card]
        const newScore = scorePartialDeck(newDeck, deckStats, playerLevelsMap, roleMap, weights)
        
        candidates.push({
          deck: newDeck,
          score: newScore,
        })
      })
    })
    
    // Keep top B candidates
    candidates.sort((a, b) => b.score - a.score)
    beams = candidates.slice(0, beamWidth)
    
    if (beams.length === 0) {
      return null // No valid candidates
    }
  }
  
  // Return best complete deck
  if (beams.length > 0) {
    // Re-score with full deck scoring
    beams.forEach((beam) => {
      beam.score = scoreDeck(beam.deck, deckStats, playerLevelsMap, roleMap, weights)
    })
    
    beams.sort((a, b) => b.score - a.score)
    return beams[0].deck
  }
  
  return null
}

/**
 * Get suggestions for next card in an interactive builder
 * @param {string[]} currentDeck - Current partial deck (array of card names)
 * @param {Object} deckStats - DeckStats object
 * @param {Map|Object} playerLevels - Map or object of card name -> level
 * @param {Object} backupMap - Map of card name -> backup names array
 * @param {Map} roleMap - Map of card name -> role
 * @param {Object} options - Configuration options
 * @returns {Array} Array of {card: string, score: number} sorted by score descending
 */
function getNextCardSuggestions(currentDeck, deckStats, playerLevels, backupMap, roleMap, options = {}) {
  const k = options.topK ?? 10
  const weights = options.weights || {}
  
  // Convert playerLevels to Map if needed
  const playerLevelsMap = playerLevels instanceof Map 
    ? playerLevels 
    : new Map(Object.entries(playerLevels))
  
  // Get playable cards (not already in deck)
  const playableCards = getPlayableCards(playerLevelsMap, backupMap, deckStats, weights)
  const currentDeckSet = new Set(currentDeck)
  const candidates = Array.from(playableCards).filter((card) => !currentDeckSet.has(card))
  
  // Score each candidate
  const suggestions = candidates.map((card) => {
    const testDeck = [...currentDeck, card]
    const score = scorePartialDeck(testDeck, deckStats, playerLevelsMap, roleMap, weights)
    return { card, score }
  })
  
  // Sort by score descending and return top K
  suggestions.sort((a, b) => b.score - a.score)
  return suggestions.slice(0, k)
}

/**
 * Main entry point: Initialize deckbuilder with good decks
 * @param {Array} goodDecks - Array of deck objects or arrays of card names
 * @returns {Object} Deckbuilder instance with methods
 */
function createDeckbuilder(goodDecks) {
  if (!Array.isArray(goodDecks) || goodDecks.length === 0) {
    throw new Error('goodDecks must be a non-empty array')
  }
  
  // Precompute stats
  const deckStats = computeDeckStats(goodDecks)
  const backupMap = buildBackupMap()
  const roleMap = buildRoleMap()
  
  return {
    /**
     * Build a complete deck for a player
     * @param {Array} playerCards - Array of card objects with name and level
     * @param {Object} options - Configuration options
     * @returns {string[]|null} Best deck or null
     */
    buildDeck(playerCards, options = {}) {
      const playerLevels = buildPlayerLevelsMap(playerCards)
      return buildDeckBeamSearch(deckStats, playerLevels, backupMap, roleMap, options)
    },
    
    /**
     * Get suggestions for next card in interactive builder
     * @param {string[]} currentDeck - Current partial deck
     * @param {Array} playerCards - Array of card objects with name and level
     * @param {Object} options - Configuration options
     * @returns {Array} Array of suggestions
     */
    suggestNextCard(currentDeck, playerCards, options = {}) {
      const playerLevels = buildPlayerLevelsMap(playerCards)
      return getNextCardSuggestions(currentDeck, deckStats, playerLevels, backupMap, roleMap, options)
    },
    
    /**
     * Score a deck
     * @param {string[]} deck - Array of card names
     * @param {Array} playerCards - Array of card objects with name and level
     * @param {Object} options - Configuration options
     * @returns {number} Deck score
     */
    scoreDeck(deck, playerCards, options = {}) {
      const playerLevels = buildPlayerLevelsMap(playerCards)
      const weights = options.weights || {}
      return scoreDeck(deck, deckStats, playerLevels, roleMap, weights)
    },
    
    /**
     * Get deck stats (for debugging/inspection)
     */
    getStats() {
      return deckStats
    },
  }
}

export {
  createDeckbuilder,
  computeDeckStats,
  scoreDeck,
  buildDeckBeamSearch,
  getNextCardSuggestions,
  getBackupReplacement,
  buildPlayerLevelsMap,
}

