async function fetchGameState(action = '') {
  const url = action ? `/api/game?action=${action}` : '/api/game';
  const res = await fetch(url, { method: action ? 'POST' : 'GET' });
  const data = await res.json();
  updateUI(data);
}

function updateUI(data) {
  document.getElementById('discard').innerText = `${data.discard.rank}${data.discard.suit[0]}`;
  document.getElementById('player-hand').innerHTML = data.playerHand.map(c =>
    `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''}">${c.rank}${c.suit[0]}</span>`).join('');
  document.getElementById('ai-hand').innerText = data.aiHandCount;
  document.getElementById('player-ruler').innerText = data.playerRuler ? `${data.playerRuler.rank}${data.playerRuler.suit[0]}` : 'Not set';
  document.getElementById('ai-ruler').innerText = data.aiRuler ? `${data.aiRuler.rank}${data.aiRuler.suit[0]}` : 'Not set';
  document.getElementById('message').innerText = data.message;
  if (data.gameOver) alert(data.playerHand.length === 0 ? 'You win!' : 'AI wins!');
}

function play() {
  const action = document.getElementById('action').value.toUpperCase();
  fetchGameState(action);
}

// Load initial state
fetchGameState();
