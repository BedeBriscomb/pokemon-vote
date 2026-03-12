(() => {
  const socket = io('https://pokemon-vote-production.up.railway.app');

  // Cached Pokemon list (names from PokeAPI)
  let pokemonList = [];
  let pokemonIdMap = {};   // name → id, for leaderboard sprites
  let current = [null, null];
  let voted = false;

  // ── DOM refs ──────────────────────────────────────────────
  const card1   = document.getElementById('card1');
  const card2   = document.getElementById('card2');
  const img1    = document.getElementById('img1');
  const img2    = document.getElementById('img2');
  const name1   = document.getElementById('name1');
  const name2   = document.getElementById('name2');
  const lbList  = document.getElementById('lb-list');

  // Loading overlay
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.textContent = 'LOADING…';
  document.body.appendChild(loading);

  // ── Audio ─────────────────────────────────────────────────
  let soundOn = false;

  const bgMusic = document.getElementById('bg-music');
  bgMusic.volume = 0.5;

  const plink = new Audio('PokemonPlink.mp3');
  plink.volume = 0.7;

  const soundToggle = document.getElementById('sound-toggle');
  soundToggle.addEventListener('click', () => {
    soundOn = !soundOn;
    soundToggle.classList.toggle('sound-off', !soundOn);
    if (soundOn) {
      bgMusic.play().catch(() => {});
    } else {
      bgMusic.pause();
    }
  });
  // Start in OFF state
  soundToggle.classList.add('sound-off');

  function playCry() {
    if (!soundOn) return;
    try {
      plink.currentTime = 0;
      plink.play().catch(() => {});
    } catch (_) {}
  }

  // ── Helpers ───────────────────────────────────────────────
  function formatName(name) {
    return name
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function pickTwo() {
    const a = Math.floor(Math.random() * pokemonList.length);
    let b;
    do { b = Math.floor(Math.random() * pokemonList.length); } while (b === a);
    return [pokemonList[a], pokemonList[b]];
  }

  // ── Load a new pair ───────────────────────────────────────
  function loadPair() {
    voted = false;
    card1.classList.remove('selected');
    card2.classList.remove('selected');
    const [p1, p2] = pickTwo();
    current = [p1, p2];
    setCard(img1, name1, p1);
    setCard(img2, name2, p2);
  }

  function setCard(imgEl, nameEl, pokemon) {
    imgEl.classList.add('loading');
    imgEl.src = '';
    nameEl.textContent = '';

    imgEl.onload  = () => imgEl.classList.remove('loading');
    imgEl.onerror = () => {
      // pokemondb doesn't host form-variant sprites (e.g. mimikyu-disguised).
      // Fall back to PokeAPI's sprite repo, indexed by ID, which covers every form.
      imgEl.onerror = null;
      imgEl.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
      imgEl.classList.remove('loading');
    };
    imgEl.src = `https://img.pokemondb.net/sprites/scarlet-violet/icon/${pokemon.name}.png`;
    nameEl.textContent = formatName(pokemon.name);
  }

  // ── Vote ──────────────────────────────────────────────────
  function vote(index) {
    if (voted || !current[index]) return;
    voted = true;
    const chosen = current[index];

    if (index === 0) card1.classList.add('selected');
    else             card2.classList.add('selected');

    // 🔊 Play the vote sound!
    playCry();

    socket.emit('vote', chosen.name);
    setTimeout(loadPair, 420);
  }

  card1.addEventListener('click', () => vote(0));
  card2.addEventListener('click', () => vote(1));

  // ── Leaderboard updates ───────────────────────────────────
  socket.on('leaderboard', (entries) => {
    lbList.innerHTML = '';
    if (!entries || entries.length === 0) {
      lbList.innerHTML = '<li class="empty">No votes yet</li>';
      return;
    }
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    entries.forEach((e, i) => {
      const barPct = total > 0 ? +((e.count / total) * 100).toFixed(1) : 0;
      const id = pokemonIdMap[e.name];
      const li  = document.createElement('li');
      li.className = 'entry';
      li.innerHTML = `
        <div class="entry-row">
          <span class="entry-rank">${i + 1}</span>
          <img class="entry-sprite" src="https://img.pokemondb.net/sprites/scarlet-violet/icon/${e.name}.png" alt="" />
          <span class="entry-name">${formatName(e.name)}</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${barPct}%"></div>
        </div>`;
      if (id) {
        const img = li.querySelector('.entry-sprite');
        img.onerror = () => {
          img.onerror = null;
          img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
        };
      }
      lbList.appendChild(li);
    });
  });

  // ── Bootstrap: fetch Pokémon list from PokeAPI ────────────
  async function init() {
    try {
      const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
      const data = await res.json();
      pokemonList = data.results.map(p => ({
        name: p.name,
        id: +p.url.split('/').filter(Boolean).pop(),
      }));
      pokemonList.forEach(p => { pokemonIdMap[p.name] = p.id; });
    } catch {
      // Minimal fallback with national dex IDs
      pokemonList = [
        { name: 'bulbasaur', id: 1 },  { name: 'charmander', id: 4 },
        { name: 'squirtle',  id: 7 },  { name: 'pikachu',    id: 25 },
        { name: 'mewtwo',    id: 150 }, { name: 'mew',        id: 151 },
        { name: 'gengar',    id: 94 },  { name: 'snorlax',    id: 143 },
        { name: 'dragonite', id: 149 }, { name: 'eevee',      id: 133 },
        { name: 'charizard', id: 6 },   { name: 'blastoise',  id: 9 },
        { name: 'venusaur',  id: 3 },   { name: 'raichu',     id: 26 },
        { name: 'vaporeon',  id: 134 }, { name: 'jolteon',    id: 135 },
        { name: 'flareon',   id: 136 }, { name: 'gyarados',   id: 130 },
        { name: 'lapras',    id: 131 }, { name: 'ditto',      id: 132 },
      ];
      pokemonList.forEach(p => { pokemonIdMap[p.name] = p.id; });
    }

    loading.remove();
    loadPair();
  }

  init();
})();
