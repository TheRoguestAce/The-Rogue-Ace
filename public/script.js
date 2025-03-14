const sessionId = localStorage.getItem('rogueAceSession') || Date.now().toString();
localStorage.setItem('rogueAceSession', sessionId);
let selectedCards = [];

async function fetchGame(move = '', reset = false) {
  const url = reset ? `/api/game?session=${sessionId}&reset=true` : move ? `/api/game?session=${sessionId}&move=${move}` : `/api/game?session=${sessionId}`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, { method: move || reset ? 'POST' : 'GET' });
  const data = await res.json();
  console.log('Received:', JSON.stringify(data));
  updateDisplay(data);
}

function updateDisplay(data) {
  document.getElementById('discard').textContent = data.discard || 'None';
  document.getElementById('player-hand').innerHTML = (data.playerHand || []).map(c => {
    const cardStr = `${c.rank}${c.suit[0]}`;
    const isSelected = selectedCards.includes(cardStr);
    return `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''} ${isSelected ? 'selected' : ''}" data-card="${cardStr}" onclick="toggleCard('${cardStr}')">${cardStr}</span>`;
  }).join(' ') || 'Empty';
  document.getElementById('ai-hand').textContent = data.aiHandSize || 0;
  document.getElementById('player-ruler').textContent = data.playerRuler || 'None';
  document.getElementById('ai-ruler').textContent = data.aiRuler || 'None';
  document.getElementById('status').textContent = data.status || 'Error';
  document.getElementById('move-history').textContent = (data.moveHistory || []).join(' | ') || 'None';
  console.log('Hand size:', data.playerHand.length);
  if (data.phase === 'over') {
    alert(data.status);
  }
}

function toggleCard(card) {
  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
  } else {
    selectedCards.splice(index, 1);
  }
  fetchGame(); // Refresh display
}

function playSelected() {
  if (selectedCards.length === 0) return;
  const move = selectedCards.join(',');
  selectedCards = [];
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

fetchGame();
