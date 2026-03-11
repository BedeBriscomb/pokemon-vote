(() => {
  const socket = io('https://pokemon-vote-production.up.railway.app');

  // Cached Pokemon list (names from PokeAPI)
  let pokemonList = [];
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

  // ── Audio: vote sound ─────────────────────────────────────
  const plink = new Audio('PokemonPlink.mp3');
  plink.volume = 0.7;

  function playCry() {
    try {
      // Rewind so rapid clicks always play from the start
      plink.currentTime = 0;
      plink.play().catch(() => {});
    } catch (_) {}
  }

  // ── Helpers ───────────────────────────────────────────────
  function spriteUrl(name) {
    return `https://img.pokemondb.net/sprites/scarlet-violet/icon/${name}.png`;
  }

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

  function setCard(imgEl, nameEl, pokeName) {
    imgEl.classList.add('loading');
    imgEl.src = '';
    nameEl.textContent = '';

    const url = spriteUrl(pokeName);
    imgEl.onload  = () => imgEl.classList.remove('loading');
    imgEl.onerror = () => {
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

    // 🔊 Play the vote sound!
    playCry();

    socket.emit('vote', chosen);
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
    // Guard: recalculate percentages client-side if server sends 0s
    const total = entries.reduce((sum, e) => sum + e.count, 0);
    entries.forEach((e, i) => {
      const pct = total > 0 ? +((e.count / total) * 100).toFixed(1) : e.percentage;
      const li  = document.createElement('li');
      li.className = 'entry';
      li.innerHTML = `
        <div class="entry-row">
          <span class="entry-rank">${i + 1}</span>
          <span class="entry-name">${formatName(e.name)}</span>
          <span class="entry-pct">${pct}%</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%"></div>
        </div>`;
      lbList.appendChild(li);
    });
  });

  // ── Bootstrap: fetch Pokémon list from PokeAPI ────────────
  async function init() {
    try {
      const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025');
      const data = await res.json();
      pokemonList = data.results.map(p => p.name);
    } catch {
      // Minimal fallback
      pokemonList = [
        'bulbasaur','charmander','squirtle','pikachu','mewtwo','mew',
        'gengar','snorlax','dragonite','eevee','charizard','blastoise',
        'venusaur','raichu','vaporeon','jolteon','flareon','gyarados',
        'lapras','ditto',
      ];
    }

    loading.remove();
    loadPair();
  }

  init();
})();
