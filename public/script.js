async function fetchGame(move = '') {
  const url = move ? `/api/game?move=${move}` : '/api/game';
  const res = await fetch(url, { method: move ? 'POST' : 'GET' });
  const data = await res.json();
  updateDisplay(data);
}

function updateDisplay(data) {
  document.getElementById('discard').textContent = `${data.discard.rank}${data.discard.suit[0]}`;
  document.getElementById('player-hand').innerHTML = data.playerHand.map(c =>
    `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''}">${c.rank}${c.suit[0]}</span>`
  ).join('');
  document.getElementById('ai-hand').textContent = data.aiHandSize;
  document.getElementById('player-ruler').textContent = `${data.playerRuler.rank}${data.playerRuler.suit[0]}`;
  document.getElementById('ai-ruler').textContent = `${data.aiRuler.rank}${data.aiRuler.suit[0]}`;
  document.getElementById('status').textContent = data.status;
  console.log('Hand size:', data.playerHand.length);
  if (data.winner) {
    alert(data.winner === 'player' ? 'You win!' : 'AI wins!');
  }
}

function submitMove() {
  const move = document.getElementById('move').value.toUpperCase();
  fetchGame(move);
}

// Start
fetchGame();
