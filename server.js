const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const client = new MongoClient(process.env.MONGO_URI, { tlsInsecure: true });
let votesCol; // MongoDB collection handle

// In-memory cache (kept in sync with DB for fast leaderboard reads)
const votes = {};
let totalVotes = 0;

// Valid Pokemon names fetched from PokeAPI on startup
let validPokemon = new Set();

async function loadValidPokemon() {
  try {
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
    if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);
    const data = await res.json();
    validPokemon = new Set(data.results.map((p) => p.name));
    console.log(`Loaded ${validPokemon.size} valid Pokemon names from PokeAPI`);
  } catch (err) {
    console.error('Failed to load Pokemon list from PokeAPI:', err.message);
    console.error('Vote validation will reject all votes until the list is loaded');
  }
}

app.use(express.static(path.join(__dirname, 'public')));

function getLeaderboard() {
  return Object.entries(votes)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalVotes > 0 ? +((count / totalVotes) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

io.on('connection', (socket) => {
  socket.emit('leaderboard', getLeaderboard());

  socket.on('vote', async (pokemonName) => {
    if (typeof pokemonName !== 'string' || pokemonName.length > 100) return;
    const clean = pokemonName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean) return;
    if (!validPokemon.has(clean)) return;

    // Update in-memory cache
    votes[clean] = (votes[clean] || 0) + 1;
    totalVotes++;

    // Persist to MongoDB (fire-and-forget; in-memory cache stays consistent)
    if (votesCol) {
      votesCol
        .updateOne({ _id: clean }, { $inc: { count: 1 } }, { upsert: true })
        .catch((err) => console.error('MongoDB write error:', err));
    }

    io.emit('leaderboard', getLeaderboard());
  });
});

async function start() {
  // Fetch valid Pokemon list before accepting any votes
  await loadValidPokemon();

  if (!process.env.MONGO_URI) {
    console.error('WARNING: MONGO_URI env var is not set — votes will not persist across restarts');
  } else {
    try {
      await client.connect();
      console.log('Connected to MongoDB');

      const db = client.db('pokemon');
      votesCol = db.collection('votes');

      // Remove any votes for names that aren't real Pokemon
      if (validPokemon.size > 0) {
        const result = await votesCol.deleteMany({ _id: { $nin: Array.from(validPokemon) } });
        if (result.deletedCount > 0) {
          console.log(`Purged ${result.deletedCount} fake vote entries from MongoDB`);
        }
      }

      const stored = await votesCol.find({}).toArray();
      for (const doc of stored) {
        votes[doc._id] = doc.count;
        totalVotes += doc.count;
      }
      console.log(`Loaded ${stored.length} Pokemon with ${totalVotes} total votes from DB`);
    } catch (err) {
      console.error('MongoDB connection failed — votes will not persist:', err.message);
    }
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Running on http://localhost:${PORT}`);
  });
}

start();
