const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {defineSecret} = require("firebase-functions/params");
const admin = require("firebase-admin");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");
const fetch = require("node-fetch");

// Secret configured via: firebase functions:secrets:set CLASH_API_KEY
const clashApiKey = defineSecret("CLASH_API_KEY");

admin.initializeApp();
const db = getFirestore();

/**
 * Fetches top players from Path of Legends leaderboard and stores basic info
 * @return {Promise<{success: boolean, totalPlayers: number, source: string}>}
 */
async function refreshTopPlayersLeaderboard() {
  const apiKey = clashApiKey.value();
  const leaderboardUrl = "https://api.clashroyale.com/v1/locations/57000249/pathoflegend/players?limit=1000";

  // Fetch leaderboard to get player tags and basic info
  const leaderboardResponse = await fetch(
      leaderboardUrl,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
  );

  if (!leaderboardResponse.ok) {
    const text = await leaderboardResponse.text();
    throw new Error(
        `Leaderboard API error: ${leaderboardResponse.status} - ${text}`,
    );
  }

  const leaderboardData = await leaderboardResponse.json();
  const items = Array.isArray(leaderboardData.items) ?
    leaderboardData.items :
    [];
  const players = items.slice(0, 1000);

  if (!players.length) {
    throw new Error("No players returned from leaderboard");
  }

  const collectionRef = db.collection("topPlayers");
  const chunkSize = 500;
  let processedCount = 0;
  let skippedCount = 0;

  // Store basic leaderboard info (without decks)
  for (let i = 0; i < players.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = players.slice(i, i + chunkSize);

    chunk.forEach((leaderboardPlayer) => {
      const rawTag = String(leaderboardPlayer.tag || "").trim().toUpperCase();
      if (!rawTag || rawTag === "#") {
        console.warn("Skipping player with invalid tag:", leaderboardPlayer);
        skippedCount++;
        return;
      }
      const tag = rawTag.startsWith("#") ? rawTag : `#${rawTag}`;
      const docId = tag.replace(/^#/, "").trim();
      if (!docId) {
        console.warn("Skipping player with empty docId:", leaderboardPlayer);
        skippedCount++;
        return;
      }
      const docRef = collectionRef.doc(docId);

      batch.set(
          docRef,
          {
            tag,
            name: leaderboardPlayer.name || null,
            rank: leaderboardPlayer.rank || null,
            trophies: leaderboardPlayer.trophies || null,
            clan: leaderboardPlayer.clan ?
              {
                tag: leaderboardPlayer.clan.tag || null,
                name: leaderboardPlayer.clan.name || null,
              } :
              null,
            leaderboardUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
      processedCount++;
    });

    await batch.commit();
    const stored = i + chunk.length;
    console.log(
        `Stored ${stored} / ${players.length} players from leaderboard`,
    );
  }

  const metaRef = db.collection("leaderboards").doc("metadata");
  await metaRef.set(
      {
        lastLeaderboardRefresh: FieldValue.serverTimestamp(),
        totalPlayers: players.length,
        processedPlayers: processedCount,
        skippedPlayers: skippedCount,
        source: leaderboardData.name || "pathoflegend",
      },
      {merge: true},
  );

  return {
    success: true,
    totalPlayers: players.length,
    processedPlayers: processedCount,
    skippedPlayers: skippedCount,
    source: leaderboardData.name || "pathoflegend",
  };
}

/**
 * Updates current decks for all players stored in Firestore
 * @return {Promise<{success: boolean, processedPlayers: number,
 *   skippedPlayers: number}>}
 */
async function refreshTopPlayersDecks() {
  const apiKey = clashApiKey.value();
  const collectionRef = db.collection("topPlayers");

  // Get all players from Firestore
  const snapshot = await collectionRef.get();
  if (snapshot.empty) {
    throw new Error(
        "No players found in Firestore. Run leaderboard refresh first.",
    );
  }

  const players = snapshot.docs.map((doc) => ({
    docId: doc.id,
    tag: doc.data().tag,
  }));

  const chunkSize = 50; // Smaller chunks for API calls
  let processedCount = 0;
  let skippedCount = 0;

  // Process players in chunks, fetching deck data for each
  for (let i = 0; i < players.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = players.slice(i, i + chunkSize);

    const deckPromises = chunk.map(async (player) => {
      if (!player.tag) {
        skippedCount++;
        return null;
      }

      try {
        const encodedTag = encodeURIComponent(player.tag);
        const playerResponse = await fetch(
            `https://api.clashroyale.com/v1/players/${encodedTag}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            },
        );

        if (!playerResponse.ok) {
          console.warn(
              `Failed to fetch player ${player.tag}: ${playerResponse.status}`,
          );
          skippedCount++;
          return null;
        }

        const playerData = await playerResponse.json();
        processedCount++;

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));

        return {
          docId: player.docId,
          tag: player.tag,
          playerData,
        };
      } catch (err) {
        console.warn(`Error fetching player ${player.tag}:`, err.message);
        skippedCount++;
        return null;
      }
    });

    const deckResults = await Promise.all(deckPromises);

    // Update Firestore with deck data
    deckResults.forEach((result) => {
      if (!result) return;

      const {docId, playerData} = result;
      const docRef = collectionRef.doc(docId);

      const deckCards = Array.isArray(playerData.currentDeck) ?
        playerData.currentDeck.map((card) => ({
          id: card.id,
          name: card.name,
          level: card.level,
          rarity: card.rarity,
          iconUrl: card.iconUrls && card.iconUrls.medium ?
            card.iconUrls.medium :
            null,
          evolutionIconUrl: card.iconUrls && card.iconUrls.evolutionMedium ?
            card.iconUrls.evolutionMedium :
            null,
        })) :
        [];

      batch.set(
          docRef,
          {
            currentDeck: deckCards,
            deckUpdatedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          {merge: true},
      );
    });

    await batch.commit();
    console.log(
        `Updated decks for ${i + chunk.length} / ${players.length} players`,
    );
  }

  const metaRef = db.collection("leaderboards").doc("metadata");
  await metaRef.set(
      {
        lastDeckRefresh: FieldValue.serverTimestamp(),
        processedPlayers: processedCount,
        skippedPlayers: skippedCount,
      },
      {merge: true},
  );

  return {
    success: true,
    processedPlayers: processedCount,
    skippedPlayers: skippedCount,
  };
}

exports.getPlayer = onRequest(
    {
      region: "us-central1",
      vpcConnector: "serverless-vpc-connector",
      vpcConnectorEgressSettings: "ALL_TRAFFIC",
      secrets: [clashApiKey],
    },
    async (req, res) => {
      if (req.method === "OPTIONS") {
        // Handle CORS preflight
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).send("");
      }

      if (req.method !== "GET") {
        return res.status(405).send("Method Not Allowed");
      }

      res.set("Access-Control-Allow-Origin", "*");

      const rawTag = req.query.tag;
      if (!rawTag) {
        return res.status(400).json({error: "Missing tag query parameter"});
      }

      const trimmed = String(rawTag).trim().toUpperCase();
      const normalized = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
      const encodedTag = encodeURIComponent(normalized);

      try {
        const apiKey = clashApiKey.value();

        const response = await fetch(
            `https://api.clashroyale.com/v1/players/${encodedTag}`,
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
              },
            },
        );

        if (!response.ok) {
          const text = await response.text();
          return res
              .status(response.status)
              .json({error: "Clash API error", details: text});
        }

        const data = await response.json();
        return res.status(200).json(data);
      } catch (err) {
        console.error(err);
        return res.status(500).json({error: "Internal error"});
      }
    },
);

// HTTP endpoint for fetching top players decks from Firestore
exports.getTopPlayersDecks = onRequest(
    {
      region: "us-central1",
    },
    async (req, res) => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).send("");
      }

      if (req.method !== "GET") {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(405).send("Method Not Allowed");
      }

      res.set("Access-Control-Allow-Origin", "*");

      try {
        const collectionRef = db.collection("topPlayers");
        const snapshot = await collectionRef.orderBy("rank").get();

        const decks = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const currentDeck = data.currentDeck;

          // Only include players with valid decks (8 cards)
          if (
            Array.isArray(currentDeck) &&
            currentDeck.length === 8 &&
            data.name &&
            data.rank !== null &&
            data.rank !== undefined
          ) {
            // Transform Firestore data to deck format
            const deck = {
              id: `player-${data.tag}`,
              name: `${data.name} (Rank #${data.rank})`,
              cards: currentDeck.map((card) => ({
                id: card.id,
                name: card.name,
                image: card.iconUrl || "",
                evolutionImage: card.evolutionIconUrl || null,
                level: card.level || 1,
                rarity: card.rarity,
              })),
            };
            decks.push(deck);
          }
        });

        return res.status(200).json({
          success: true,
          decks,
          total: decks.length,
        });
      } catch (err) {
        console.error("getTopPlayersDecks failed", err);
        return res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
);

// HTTP endpoint for manually triggering leaderboard refresh
exports.refreshTopPlayersLeaderboard = onRequest(
    {
      region: "us-central1",
      vpcConnector: "serverless-vpc-connector",
      vpcConnectorEgressSettings: "ALL_TRAFFIC",
      secrets: [clashApiKey],
    },
    async (req, res) => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(405).send("Method Not Allowed");
      }

      res.set("Access-Control-Allow-Origin", "*");

      try {
        const result = await refreshTopPlayersLeaderboard();
        return res.status(200).json({
          success: true,
          message: "Leaderboard refreshed successfully",
          ...result,
        });
      } catch (err) {
        console.error("refreshTopPlayersLeaderboard failed", err);
        return res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
);

// HTTP endpoint for manually triggering deck refresh
exports.refreshTopPlayersDecks = onRequest(
    {
      region: "us-central1",
      vpcConnector: "serverless-vpc-connector",
      vpcConnectorEgressSettings: "ALL_TRAFFIC",
      secrets: [clashApiKey],
    },
    async (req, res) => {
      if (req.method === "OPTIONS") {
        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.set("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        res.set("Access-Control-Allow-Origin", "*");
        return res.status(405).send("Method Not Allowed");
      }

      res.set("Access-Control-Allow-Origin", "*");

      try {
        const result = await refreshTopPlayersDecks();
        return res.status(200).json({
          success: true,
          message: "Decks refreshed successfully",
          ...result,
        });
      } catch (err) {
        console.error("refreshTopPlayersDecks failed", err);
        return res.status(500).json({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
);

// Scheduled leaderboard refresh - runs at 00:00 UTC on the 1st of each month
exports.refreshTopPlayersLeaderboardScheduled = onSchedule(
    {
      region: "us-central1",
      schedule: "0 0 1 * *",
      timeZone: "Etc/UTC",
      vpcConnector: "serverless-vpc-connector",
      vpcConnectorEgressSettings: "ALL_TRAFFIC",
      secrets: [clashApiKey],
    },
    async () => {
      try {
        await refreshTopPlayersLeaderboard();
        console.log("Scheduled leaderboard refresh completed");
      } catch (err) {
        console.error("refreshTopPlayersLeaderboardScheduled failed", err);
      }
    },
);

// Scheduled deck refresh - runs every 3 days at 00:00 UTC
exports.refreshTopPlayersDecksScheduled = onSchedule(
    {
      region: "us-central1",
      schedule: "0 0 */3 * *",
      timeZone: "Etc/UTC",
      vpcConnector: "serverless-vpc-connector",
      vpcConnectorEgressSettings: "ALL_TRAFFIC",
      secrets: [clashApiKey],
    },
    async () => {
      try {
        await refreshTopPlayersDecks();
        console.log("Scheduled deck refresh completed");
      } catch (err) {
        console.error("refreshTopPlayersDecksScheduled failed", err);
      }
    },
);


