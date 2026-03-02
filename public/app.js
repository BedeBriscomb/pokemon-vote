(() => {
  const socket = io();

  // Cached Pokemon list (names from PokeAPI)
  let pokemonList = [];
  let current = [null, null];
  let voted = false;

  // ── DOM refs ──────────────────────────────────────────────
  const card1  = document.getElementById('card1');
  const card2  = document.getElementById('card2');
  const img1   = document.getElementById('img1');
  const img2   = document.getElementById('img2');
  const name1  = document.getElementById('name1');
  const name2  = document.getElementById('name2');
  const lbList = document.getElementById('lb-list');

  // Loading overlay
  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.textContent = 'LOADING…';
  document.body.appendChild(loading);

  // ── Helpers ───────────────────────────────────────────────
  function spriteUrl(name) {
    // Scarlet/Violet icon sprites — exist for every Pokemon, match pokemondb.net/sprites
    return `https://img.pokemondb.net/sprites/scarlet-violet/icon/${name}.png`;
  }

  function formatName(name) {
    // "mr-mime" → "Mr Mime", "nidoran-f" → "Nidoran F", etc.
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

  function setCard(imgEl, nameEl, pokeName) {
    imgEl.classList.add('loading');
    imgEl.src = '';
    nameEl.textContent = '';

    const url = spriteUrl(pokeName);
    imgEl.onload = () => imgEl.classList.remove('loading');
    imgEl.onerror = () => {
      // Fall back to pokemondb HOME sprite
      imgEl.onerror = null;
      imgEl.src = `https://img.pokemondb.net/sprites/home/normal/${pokeName}.png`;
      imgEl.classList.remove('loading');
    };
    imgEl.src = url;
    nameEl.textContent = formatName(pokeName);
  }

  // ── Vote ──────────────────────────────────────────────────
  function vote(index) {
    if (voted || !current[index]) return;
    voted = true;

    const chosen = current[index];
    if (index === 0) card1.classList.add('selected');
    else             card2.classList.add('selected');

    socket.emit('vote', chosen);

    // Brief pause so the user sees their selection, then load next pair
    setTimeout(loadPair, 420);
  }

  card1.addEventListener('click', () => vote(0));
  card2.addEventListener('click', () => vote(1));

  // ── Leaderboard updates ───────────────────────────────────
  socket.on('leaderboard', (entries) => {
    lbList.innerHTML = '';
    if (entries.length === 0) {
      lbList.innerHTML = '<li class="empty">No votes yet</li>';
      return;
    }
    entries.forEach((e, i) => {
      const li = document.createElement('li');
      li.className = 'entry';
      li.innerHTML = `
        <div class="entry-row">
          <span class="entry-rank">${i + 1}</span>
          <span class="entry-name">${formatName(e.name)}</span>
          <span class="entry-pct">${e.percentage}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${e.percentage}%"></div>
        </div>`;
      lbList.appendChild(li);
    });
  });

  // ── Bootstrap: fetch Pokemon list from PokeAPI ────────────
  async function init() {
    try {
      const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
      const data = await res.json();
      pokemonList = data.results.map(p => p.name);
    } catch {
      // Minimal fallback — first 20 well-known Pokemon
      pokemonList = [
        'bulbasaur','ivysaur','venusaur','charmander','charmeleon','charizard',
        'squirtle','wartortle','blastoise','caterpie','metapod','butterfree',
        'weedle','kakuna','beedrill','pidgey','pidgeotto','pidgeot',
        'rattata','pikachu','raichu','eevee','vaporeon','jolteon','flareon',
        'mewtwo','mew','gengar','snorlax','dragonite',
      ];
    }
    loading.remove();
    loadPair();
  }

  init();
})();
