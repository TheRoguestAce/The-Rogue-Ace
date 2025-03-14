const sessionId = localStorage.getItem('rogueAceSession') || Date.now().toString();
localStorage.setItem('rogueAceSession', sessionId);
let selectedCards = [];

async function fetchGame(move = '', reset = false) {
  const url = reset ? `/api/game?session=${sessionId}&reset=true` : move ? `/api/game?session=${sessionId}&move=${move}` : `/api/game?session=${sessionId}`;
  const res = await fetch(url, { method: move || reset ? 'POST' : 'GET' });
  const data = await res.json();
  updateDisplay(data);
}

function updateDisplay(data) {
  document.getElementById('discard').textContent = `${data.discard.rank}${data.discard.suit[0]}`;
  document.getElementById('player-hand').innerHTML = data.playerHand.map((c, i) => {
    const cardStr = `${c.rank}${c.suit[0]}`;
    const isSelected = selectedCards.includes(cardStr);
    return `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''} ${isSelected ? 'selected' : ''}" data-card="${cardStr}" onclick="toggleCard('${cardStr}')">${cardStr}</span>`;
  }).join('');
  document.getElementById('ai-hand').textContent = data.aiHandSize;
  document.getElementById('player-ruler').textContent = `${data.playerRuler.rank}${data.playerRuler.suit[0]}`;
  document.getElementById('ai-ruler').textContent = `${data.aiRuler.rank}${data.aiRuler.suit[0]}`;
  document.getElementById('status').textContent = data.status;
  console.log('Hand size:', data.playerHand.length);
}

function toggleCard(card) {
  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
  } else {
    selectedCards.splice(index, 1);
  }
  fetchGame(); // Refresh display to show selection
}

function playSelected() {
  if (selectedCards.length === 0) return;
  const move = selectedCards.join(',');
  selectedCards = []; // Clear selection
  fetchGame(move);
}

function drawCards() {
  selectedCards = [];
  fetchGame('draw');
}

function resetGame() {
  selectedCards = [];
  fetchGame('', true);
}

// Start
fetchGame();
