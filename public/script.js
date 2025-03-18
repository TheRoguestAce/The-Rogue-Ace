let selectedCards = [];
let currentPhase = 'setup';
let currentGameState = null;

async function fetchGameState() {
  try {
    const response = await fetch('/api/game?players=2', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const game = await response.json();
    currentPhase = game.phase;
    currentGameState = game;
    updateUI(game);
  } catch (error) {
    console.error('Error fetching game state:', error);
    document.getElementById('status').textContent = `Error loading game: ${error.message}`;
  }
}

function updateUI(game) {
  document.getElementById('status').textContent = game.status;
  document.getElementById('turn').textContent = game.turn + 1;
  document.getElementById('discard').textContent = game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None';
  document.getElementById('deckSize').textContent = game.deck.length;
  document.getElementById('wins').textContent = game.wins.map((w, i) => `Player ${i + 1}: ${w}`).join(', ');

  const playersDiv = document.getElementById('players');
  playersDiv.innerHTML = '';
  game.players.forEach((player, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.innerHTML = `<strong>Player ${index + 1} Hand:</strong> ${
      player.hand.length ? player.hand.map(c => `<span class="card" onclick="selectCard('${c.rank}${c.suit[0]}', ${index})">${c.rank}${c.suit[0]}</span>`).join(', ') : 'Empty'
    }<br><strong>Ruler:</strong> ${player.ruler ? `${player.ruler.rank}${player.ruler.suit[0]}` : 'None'}`;
    playersDiv.appendChild(playerDiv);
  });

  const historyUl = document.getElementById('history');
  historyUl.innerHTML = '';
  game.moveHistory.forEach(move => {
    const li = document.createElement('li');
    li.textContent = move;
    historyUl.appendChild(li);
  });

  const pair5Choices = document.getElementById('pair5Choices');
  const pair5DiscardOptions = document.getElementById('pair5DiscardOptions');
  const pair5HandOptions = document.getElementById('pair5HandOptions');
  const pair5HandCards = document.getElementById('pair5HandCards');
  if (game.pair5Pending && game.turn === 0) { // Only Player 1 interacts
    pair5Choices.style.display = 'block';
    pair5DiscardOptions.innerHTML = '';
    const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
    topFive.forEach(card => {
      const span = document.createElement('span');
      span.className = 'card';
      span.textContent = `${card.rank}${card.suit[0]}`;
      span.onclick = () => selectPair5DiscardChoice(`${card.rank}${card.suit[0]}`);
      pair5DiscardOptions.appendChild(span);
      pair5DiscardOptions.appendChild(document.createTextNode(', '));
    });
    if (game.pair5DiscardChoice) {
      pair5HandOptions.style.display = 'block';
      pair5HandCards.innerHTML = '';
      game.players[0].hand.forEach(card => {
        const span = document.createElement('span');
        span.className = 'card';
        span.textContent = `${card.rank}${card.suit[0]}`;
        span.onclick = () => selectPair5HandChoice(`${card.rank}${card.suit[0]}`);
        pair5HandCards.appendChild(span);
        pair5HandCards.appendChild(document.createTextNode(', '));
      });
    } else {
      pair5HandOptions.style.display = 'none';
    }
  } else {
    pair5Choices.style.display = 'none';
  }

  const pair6Choices = document.getElementById('pair6Choices');
  const pair6TargetOptions = document.getElementById('pair6TargetOptions');
  if (game.pair6Pending && game.turn === 0) { // Only Player 1 interacts
    pair6Choices.style.display = 'block';
    pair6TargetOptions.innerHTML = '';
    game.opponents.forEach(idx => {
      const span = document.createElement('span');
      span.className = 'card';
      span.textContent = `Player ${idx + 1}`;
      span.onclick = () => selectPair6Target(idx);
      pair6TargetOptions.appendChild(span);
      pair6TargetOptions.appendChild(document.createTextNode(', '));
    });
  } else {
    pair6Choices.style.display = 'none';
  }

  const pair7Choices = document.getElementById('pair7Choices');
  const pair7DeckOptions = document.getElementById('pair7DeckOptions');
  const pair7HandOptions = document.getElementById('pair7HandOptions');
  const pair7HandCards = document.getElementById('pair7HandCards');
  if (game.pair7Pending && game.turn === 0) { // Only Player 1 interacts
    pair7Choices.style.display = 'block';
    pair7DeckOptions.innerHTML = '';
    const topTwo = game.deck.slice(0, 2);
    topTwo.forEach(card => {
      const span = document.createElement('span');
      span.className = 'card';
      span.textContent = `${card.rank}${card.suit[0]}`;
      span.onclick = () => selectPair7DeckChoice(`${card.rank}${card.suit[0]}`);
      pair7DeckOptions.appendChild(span);
      pair7DeckOptions.appendChild(document.createTextNode(', '));
    });
    if (game.pair7DeckChoice) {
      pair7HandOptions.style.display = 'block';
      pair7HandCards.innerHTML = '';
      game.players[0].hand.forEach(card => {
        const span = document.createElement('span');
        span.className = 'card';
        span.textContent = `${card.rank}${card.suit[0]}`;
        span.onclick = () => selectPair7HandChoice(`${card.rank}${card.suit[0]}`);
        pair7HandCards.appendChild(span);
        pair7HandCards.appendChild(document.createTextNode(', '));
      });
    } else {
      pair7HandOptions.style.display = 'none';
    }
  } else {
    pair7Choices.style.display = 'none';
  }

  document.querySelectorAll('.card').forEach(span => {
    if (selectedCards.includes(span.textContent)) {
      span.style.backgroundColor = '#ddd';
    } else {
      span.style.backgroundColor = '';
    }
  });

  document.getElementById('moveInput').value = selectedCards.join(',');
}

function selectCard(card, playerIndex) {
  if (playerIndex !== 0) return; // Only Player 1 can interact

  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
  } else {
    selectedCards.splice(index, 1);
  }

  document.querySelectorAll('.card').forEach(span => {
    if (selectedCards.includes(span.textContent)) {
      span.style.backgroundColor = '#ddd';
    } else {
      span.style.backgroundColor = '';
    }
  });

  document.getElementById('moveInput').value = selectedCards.join(',');
}

async function makeMove() {
  const move = document.getElementById('moveInput').value;
  if (!move) return;

  await fetch(`/api/game?move=${move}`, { method: 'POST' });
  selectedCards = [];
  document.getElementById('moveInput').value = '';
  await fetchGameState();
}

async function drawCard() {
  await fetch('/api/game?move=draw', { method: 'POST' });
  selectedCards = [];
  document.getElementById('moveInput').value = '';
  await fetchGameState();
}

async function resetGame() {
  await fetch('/api/game?reset=true', { method: 'POST' });
  selectedCards = [];
  document.getElementById('moveInput').value = '';
  await fetchGameState();
}

async function addCard() {
  const cardCode = document.getElementById('addCardInput').value;
  if (cardCode) {
    await fetch(`/api/game?addCards=${cardCode}`, { method: 'POST' });
    document.getElementById('addCardInput').value = '';
    await fetchGameState();
  }
}

async function selectPair5DiscardChoice(card) {
  await fetch(`/api/game?pair5DiscardChoice=${card}`, { method: 'POST' });
  await fetchGameState();
}

async function selectPair5HandChoice(card) {
  await fetch(`/api/game?pair5HandChoice=${card}`, { method: 'POST' });
  await fetchGameState();
}

async function selectPair6Target(target) {
  await fetch(`/api/game?pair6Target=${target}`, { method: 'POST' });
  await fetchGameState();
}

async function selectPair7DeckChoice(card) {
  await fetch(`/api/game?pair7DeckChoice=${card}`, { method: 'POST' });
  await fetchGameState();
}

async function selectPair7HandChoice(card) {
  await fetch(`/api/game?pair7HandChoice=${card}`, { method: 'POST' });
  await fetchGameState();
}

// Initial fetch
fetchGameState();
