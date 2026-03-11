const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const MONGO_URI = process.env.MONGO_URI;

const client = new MongoClient(MONGO_URI);
let votesCol; // MongoDB collection handle

// In-memory cache (kept in sync with DB for fast leaderboard reads)
const votes = {};
let totalVotes = 0;

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
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('pokemon');
    votesCol = db.collection('votes');

    // Load persisted votes into memory
    const stored = await votesCol.find({}).toArray();
    for (const doc of stored) {
      votes[doc._id] = doc.count;
      totalVotes += doc.count;
    }
    console.log(`Loaded ${stored.length} Pokemon with ${totalVotes} total votes from DB`);
  } catch (err) {
    console.error('MongoDB connection failed — running with in-memory votes only:', err.message);
  }

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Running on http://localhost:${PORT}`);
  });
}

start();
