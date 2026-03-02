const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// In-memory vote store: { pokemonName: voteCount }
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
  // Send the current leaderboard to the newly connected client
  socket.emit('leaderboard', getLeaderboard());

  socket.on('vote', (pokemonName) => {
    if (typeof pokemonName !== 'string' || pokemonName.length > 100) return;
    // Sanitize: only allow lowercase letters, digits, and hyphens
    const clean = pokemonName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean) return;

    votes[clean] = (votes[clean] || 0) + 1;
    totalVotes++;

    // Broadcast updated leaderboard to every connected client
    io.emit('leaderboard', getLeaderboard());
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Running on http://localhost:${PORT}`);
});
