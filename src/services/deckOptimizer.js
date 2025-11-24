import cardBackups from '../data/card_backups.json'
import { mapCardLevels } from '../utils/cardLevelMapper'

// BIG and INF are sentinel values used by the Hungarian algorithm.
// Costs are built as: cost = 1 - score, where score is typically in [0, 1].
const BIG = 1e6
const INF = 1e100

// Match the display-level behavior in Card.jsx, where higher-rarity cards
// effectively count as higher levels when shown to the user. We use this
// adjusted level for scoring, while the raw level is still used for display
// and card data via mapCardLevels.
const RARITY_LEVEL_BONUS = {
  common: 0,
  rare: 2,
  epic: 5,
  legendary: 8,
  champion: 10,
}

/**
 * Build lookup of backup definitions by card name.
 */
function buildCardsByName() {
  const map = new Map()

  if (Array.isArray(cardBackups)) {
    cardBackups.forEach((entry) => {
      if (!entry || !entry.name) return
      const key = String(entry.name).trim()
      if (!key) return
      if (!map.has(key)) {
        map.set(key, entry)
      }
    })
  }

  return map
}

const cardsByName = buildCardsByName()

/**
 * Given an original card name and a candidate card name, determine whether the
 * candidate is valid for this slot and return its compatibility info.
 *
 * Returns { stars, orderIdx } or null if invalid.
 */
function slotCandidateInfo(originalName, candidateName) {
  const orig = String(originalName || '').trim()
  const cand = String(candidateName || '').trim()

  if (!orig || !cand) return null

  // Original card is always valid with highest compatibility
  if (orig === cand) {
    return { stars: 3, orderIdx: -1 }
  }

  const entry = cardsByName.get(orig)
  if (!entry || !Array.isArray(entry.backups)) return null

  const idx = entry.backups.findIndex((b) => b && String(b.name || '').trim() === cand)
  if (idx === -1) return null

  const backup = entry.backups[idx]
  const stars =
    typeof backup.stars === 'number' && Number.isFinite(backup.stars) ? backup.stars : 1

  return { stars, orderIdx: idx }
}

/**
 * Build a map of *effective* player card levels keyed by card name, where
 * effective level matches the display-level behavior (level + rarity bonus)
 * from Card.jsx. This is used for scoring and optimization decisions.
 */
function buildPlayerLevels(playerCards) {
  const levels = new Map()

  if (!Array.isArray(playerCards)) return levels

  playerCards.forEach((card) => {
    if (!card || !card.name) return
    const name = String(card.name).trim()
    if (!name) return

    const baseLevel = Number(card.level)
    if (!Number.isFinite(baseLevel) || baseLevel <= 0) return

    const rarityKey =
      card.rarity && typeof card.rarity === 'string'
        ? card.rarity.toLowerCase()
        : undefined
    const rarityBonus = RARITY_LEVEL_BONUS[rarityKey] ?? 0

    const effectiveLevel = Math.max(1, baseLevel + rarityBonus)

    const existing = levels.get(name)
    if (!existing || effectiveLevel > existing) {
      levels.set(name, effectiveLevel)
    }
  })

  return levels
}

/**
 * Hungarian algorithm implementation for minimizing total cost.
 *
 * @param {number[][]} cost - cost[row][col]
 * @returns {number[]} colForRow - index of chosen column for each row
 */
function hungarianMinimize(cost) {
  const nRows = cost.length
  if (nRows === 0) return []

  const nCols = cost.reduce((max, row) => Math.max(max, row.length), 0)
  const n = Math.max(nRows, nCols)

  // Hungarian algorithm enforces a global one-to-one assignment between rows
  // (deck slots) and columns (candidate cards), which matches the \"no duplicates\"
  // constraint for Clash decks.

  // 1-indexed square matrix
  const a = Array.from({ length: n + 1 }, () => Array(n + 1).fill(BIG))

  for (let i = 1; i <= nRows; i += 1) {
    const row = cost[i - 1] || []
    for (let j = 1; j <= nCols; j += 1) {
      a[i][j] = Number.isFinite(row[j - 1]) ? row[j - 1] : BIG
    }
    for (let j = nCols + 1; j <= n; j += 1) {
      a[i][j] = BIG
    }
  }

  const u = Array(n + 1).fill(0)
  const v = Array(n + 1).fill(0)
  const p = Array(n + 1).fill(0)
  const way = Array(n + 1).fill(0)

  for (let i = 1; i <= n; i += 1) {
    p[0] = i
    let j0 = 0
    const minv = Array(n + 1).fill(INF)
    const used = Array(n + 1).fill(false)

    // Find augmenting path
    do {
      used[j0] = true
      const i0 = p[j0]
      let delta = INF
      let j1 = 0

      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue
        const cur = a[i0][j] - u[i0] - v[j]
        if (cur < minv[j]) {
          minv[j] = cur
          way[j] = j0
        }
        if (minv[j] < delta) {
          delta = minv[j]
          j1 = j
        }
      }

      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j]] += delta
          v[j] -= delta
        } else {
          minv[j] -= delta
        }
      }

      j0 = j1
    } while (p[j0] !== 0)

    // Augment along the path
    do {
      const j1 = way[j0]
      p[j0] = p[j1]
      j0 = j1
    } while (j0 !== 0)
  }

  const colForRow = Array(nRows).fill(-1)

  for (let j = 1; j <= n; j += 1) {
    const i = p[j]
    if (i >= 1 && i <= nRows && j >= 1 && j <= nCols) {
      colForRow[i - 1] = j - 1
    }
  }

  return colForRow
}

/**
 * Identity-style optimizer that keeps the same 8 cards as the original deck
 * but allows downstream logic (via mapCardLevels) to apply the player's
 * actual card levels.
 *
 * Returns a function so we can later swap different strategies without
 * touching call sites.
 */
function createIdentityOptimizer() {
  return (originalDeck, playerCards) => {
    if (!originalDeck || !Array.isArray(originalDeck.cards)) {
      return null
    }

    const clonedDeck = {
      ...originalDeck,
      cards: originalDeck.cards.map((card) => (card ? { ...card } : card)),
    }

    const optimizedCards = mapCardLevels(clonedDeck.cards, playerCards)

    return {
      ...clonedDeck,
      cards: optimizedCards,
    }
  }
}

/**
 * Hungarian-based optimizer that uses backup relationships and player levels
 * to build an \"effective\" deck for the given leaderboard deck.
 *
 * See .cursor/HUNGARIAN_ALGORITHM_README.md for detailed algorithm notes.
 */
function createHungarianOptimizer() {
  return (originalDeck, playerCards) => {
    if (!originalDeck || !Array.isArray(originalDeck.cards) || !originalDeck.cards.length) {
      return null
    }

    const deckCards = originalDeck.cards
    const numSlots = deckCards.length

    const originalNames = deckCards.map((card) => String(card?.name || '').trim())
    if (originalNames.some((name) => !name)) {
      // If any card is missing a name, fall back to identity behavior
      return createIdentityOptimizer()(originalDeck, playerCards)
    }

    const playerLevels = buildPlayerLevels(playerCards)

    // Step 3: Build candidate set (original + backups, deduplicated)
    const candidateNames = []
    const seen = new Set()

    originalNames.forEach((name) => {
      if (!seen.has(name)) {
        seen.add(name)
        candidateNames.push(name)
      }

      const entry = cardsByName.get(name)
      if (entry && Array.isArray(entry.backups)) {
        entry.backups.forEach((backup) => {
          const bName = String(backup?.name || '').trim()
          if (bName && !seen.has(bName)) {
            seen.add(bName)
            candidateNames.push(bName)
          }
        })
      }
    })

    if (!candidateNames.length) {
      return createIdentityOptimizer()(originalDeck, playerCards)
    }

    // Step 4: Build cost matrix
    // Initialize cost matrix with BIG as the default \"invalid\" cost.
    const cost = Array.from({ length: numSlots }, () =>
      Array(candidateNames.length).fill(BIG),
    )

    let anyValid = false

    for (let slot = 0; slot < numSlots; slot += 1) {
      const origName = originalNames[slot]

      // Pre-compute the original card's score for this slot (if the player owns it),
      // so we can break ties in favor of keeping the original card.
      const origLevel = playerLevels.get(origName) || 0
      let origScore = null
      if (origLevel > 0) {
        const baseOrig = (3 + origLevel) / 18.0
        let bonusOrig = origLevel * 1e-6
        // Original card bonus (see README).
        bonusOrig += 1e-4
        origScore = baseOrig + bonusOrig
      }

      for (let cIdx = 0; cIdx < candidateNames.length; cIdx += 1) {
        const candName = candidateNames[cIdx]
        const info = slotCandidateInfo(origName, candName)

        if (!info) {
          // Not a valid assignment for this slot (not original or backup).
          // Use BIG so the Hungarian algorithm effectively forbids this edge.
          cost[slot][cIdx] = BIG
          continue
        }

        const level = playerLevels.get(candName) || 0
        if (level <= 0) {
          // Player does not own this candidate card at a usable level.
          // Treat as invalid by assigning BIG cost.
          cost[slot][cIdx] = BIG
          continue
        }

        anyValid = true

        const { stars, orderIdx } = info

        const baseScore = (stars + level) / 18.0
        let bonus = level * 1e-6

        if (orderIdx >= 0) {
          bonus += (100 - orderIdx) * 1e-9
        }

        if (origName === candName) {
          bonus += 1e-4
        }

        let totalScore = baseScore + bonus

        // If this candidate has a score tied with the original card's score
        // for this slot, and it's *not* the original card itself, nudge it
        // slightly below so the Hungarian algorithm will prefer the original.
        if (
          candName !== origName &&
          typeof origScore === 'number' &&
          Math.abs(totalScore - origScore) < 1e-9
        ) {
          totalScore = origScore - 1e-6
        }

        cost[slot][cIdx] = 1.0 - totalScore
      }
    }

    // If there are no valid assignments at all, fall back to identity optimizer
    if (!anyValid) {
      return createIdentityOptimizer()(originalDeck, playerCards)
    }

    // Step 5: Run Hungarian algorithm
    const colForRow = hungarianMinimize(cost)

    // Step 6: Build result deck and detailed replacement info
    const resultCards = []
    const replacements = []
    let totalScore = 0

    for (let slot = 0; slot < numSlots; slot += 1) {
      const colIdx = colForRow[slot]

      if (colIdx == null || colIdx < 0 || colIdx >= candidateNames.length) {
        // The assignment for this slot is invalid (out-of-bounds column).
        // Fallback behavior: keep the original leaderboard card.
        const originalName = originalNames[slot]
        const originalLevel = playerLevels.get(originalName) || 0

        replacements.push({
          slot,
          originalCard: originalName,
          replacementCard: originalName,
          wasReplaced: false,
          originalLevel,
          replacementLevel: originalLevel,
          reason: 'Kept original card – no valid replacement available for this slot.',
        })

        resultCards.push({ ...deckCards[slot] })
        continue
      }

      const candName = candidateNames[colIdx]
      const level = playerLevels.get(candName) || 0

      // Find player card for metadata (id, rarity, iconUrls)
      const playerCard =
        Array.isArray(playerCards) && candName
          ? playerCards.find(
              (card) => String(card?.name || '').trim() === candName,
            )
          : null

      if (!playerCard) {
        // If we don't have metadata for the chosen candidate, keep the
        // original leaderboard card to avoid rendering broken data.
        const originalName = originalNames[slot]
        const originalLevel = playerLevels.get(originalName) || 0

        replacements.push({
          slot,
          originalCard: originalName,
          replacementCard: originalName,
          wasReplaced: false,
          originalLevel,
          replacementLevel: originalLevel,
          reason: 'Kept original card – missing metadata for suggested replacement.',
        })

        resultCards.push({ ...deckCards[slot] })
        continue
      }

      const originalCard = deckCards[slot] || {}
      const originalName = originalNames[slot]
      const originalLevel = playerLevels.get(originalName) || 0

      // Accumulate optimization score for this slot, if we have valid info
      if (level > 0) {
        const info = slotCandidateInfo(originalName, candName)
        if (info) {
          const { stars } = info
          totalScore += (stars + level) / 18.0
        }
      }

      const wasReplaced = candName !== originalName
      let reason

      if (!wasReplaced) {
        reason = 'Kept original card – you own this card for this slot.'
      } else if (originalLevel <= 0) {
        reason = 'You do not own the original card; using a compatible backup you own.'
      } else if (level > originalLevel) {
        reason = `Using higher-level backup (original Lv ${originalLevel}, replacement Lv ${level}).`
      } else {
        reason = 'Using a compatible backup chosen by the optimization algorithm.'
      }

      replacements.push({
        slot,
        originalCard: originalName,
        replacementCard: candName,
        wasReplaced,
        originalLevel,
        replacementLevel: level,
        reason,
      })

      resultCards.push({
        id: playerCard.id ?? originalCard.id,
        name: candName,
        level,
        rarity: playerCard.rarity ?? originalCard.rarity,
        image: playerCard.iconUrls?.medium ?? originalCard.image ?? '',
        evolutionImage:
          playerCard.iconUrls?.evolutionMedium ?? originalCard.evolutionImage ?? null,
      })
    }

    // Ensure card levels used for display go through the same normalization
    // path as the identity optimizer (mapCardLevels), while keeping the
    // scoring logic above based on raw playerLevels.
    const normalizedCards = mapCardLevels(resultCards, playerCards)

    return {
      ...originalDeck,
      cards: normalizedCards,
      optimizationScore: totalScore,
      replacements,
    }
  }
}

/**
 * Main entry point for deck optimization.
 *
 * @param {Object} originalDeck - Leaderboard deck object
 * @param {Array} playerCards - Player's owned cards (from currentPlayer.cards)
 * @param {Function} optimizationStrategy - Strategy function, defaults to Hungarian optimizer
 * @returns {Object|null} Optimized deck object or null if input is invalid
 */
function optimizeDeck(originalDeck, playerCards, optimizationStrategy) {
  if (!originalDeck || !Array.isArray(originalDeck.cards)) {
    return null
  }

  // optimizationStrategy can be:
  // - a factory with zero args (e.g. createHungarianOptimizer),
  // - a ready-to-use strategy function (originalDeck, playerCards),
  // - or undefined, in which case we use defaultOptimizer.
  let strategyFn

  if (typeof optimizationStrategy === 'function') {
    if (optimizationStrategy.length === 0) {
      // Treat zero-arg functions as factories and call once to get a strategy.
      strategyFn = optimizationStrategy()
    } else {
      // Functions with at least one parameter are assumed to be strategy
      // functions that take (originalDeck, playerCards).
      strategyFn = optimizationStrategy
    }
  } else {
    strategyFn = defaultOptimizer
  }

  if (typeof strategyFn !== 'function') {
    // Extremely defensive: if something still went wrong, fall back to the
    // default ready-to-use optimizer.
    strategyFn = defaultOptimizer
  }

  const safePlayerCards = Array.isArray(playerCards) ? playerCards : []

  return strategyFn(originalDeck, safePlayerCards)
}

// Default optimizer instance, convenient for most call sites
const defaultOptimizer = createHungarianOptimizer()

export {
  createIdentityOptimizer,
  createHungarianOptimizer,
  optimizeDeck,
  defaultOptimizer,
}
