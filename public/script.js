const sessionId = localStorage.getItem('rogueAceSession') || Date.now().toString();
localStorage.setItem('rogueAceSession', sessionId);
let selectedCards = [];
let data = {};

const rulerAbilities = {
  suits: {
    Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
    Hearts: 'Campfire: Other cards count as this heart’s rank (no pairs)',
    Spades: 'Sliced: Spades count as half their rank, rounded up (pairs OK)',
    Clubs: 'Strike: Play 2 cards if 5+ in hand, counts as a pair'
  },
  ranks: {
    2: 'Twice the Might: Pairs make AI draw double (4 instead of 2)',
    3: 'Lucky Clover: Play a 7 anytime, AI draws 2',
    4: 'Fourfold: Four of a kind reshuffles all cards, AI draws 7, you draw 3',
    5: 'High Five: Face cards count as 5 (pairs OK)',
    6: 'Nightmare: Playing a 6 makes AI draw to 7 cards',
    7: 'Lucky Spin: Play a 3 anytime, AI draws 2',
    8: 'Seeing Red: If AI has ≤3 cards, 8 makes them draw 2',
    9: 'Reverse Nightmare: AI’s 9s make you discard to 5 cards',
    10: 'Perfection: Even cards stack on evens (no pairs)',
    J: 'Servant: J/Q/K/A count as each other (pairs OK)',
    Q: 'Ruler’s Touch: Kings are wild, make AI draw 1 (pairs OK)',
    K: 'Ruler of Rulers: Inherits all rank abilities (2-Q), draw 5 on win to replay',
    'A-Diamonds': 'Perfect Card: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)',
    'A-Hearts': 'Otherworldly Touch: Hearts are wild, others mimic this card (no pairs)',
    'A-Spades': 'Pocket Knife: All cards count as half rank, rounded down (pairs OK)',
    'A-Clubs': 'Nuclear Bomb: First win reshuffles, others 7 cards, winner 5 (skips if you win first)'
  }
};

async function fetchGame(move = '', reset = false) {
  const url = reset ? `/api/game?session=${sessionId}&reset=true` : move ? `/api/game?session=${sessionId}&move=${move}` : `/api/game?session=${sessionId}`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, { method: move || reset ? 'POST' : 'GET' });
  data = await res.json();
  console.log('Received:', JSON.stringify(data));
  updateDisplay(data);
  if (data.turn === 0 && move && move !== 'draw' && !reset) {
    setTimeout(() => fetchGame(), 500);
  }
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
  if (data.phase === 'over') alert(data.status);
}

function toggleCard(card) {
  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
    if (data.phase === 'setup') {
      const [rank, suitChar] = [card.slice(0, -1), card.slice(-1)];
      const suit = Object.keys(rulerAbilities.suits).find(s => s[0] === suitChar);
      const abilityKey = rank === 'A' ? `A-${suit}` : rank;
      const suitAbility = rank === 'A' ? '' : `Suit: ${rulerAbilities.suits[suit]} | `;
      document.getElementById('ruler-abilities').style.display = 'block';
      document.getElementById('ruler-abilities').textContent = `${suitAbility}Rank: ${rulerAbilities.ranks[abilityKey]}`;
    }
  } else {
    selectedCards.splice(index, 1);
    document.getElementById('ruler-abilities').style.display = 'none';
  }
  fetchGame();
}

function showRulerAbilities(player) {
  const ruler = player === 'player' ? document.getElementById('player-ruler').textContent : document.getElementById('ai-ruler').textContent;
  if (ruler === 'None') return;
  const [rank, suitChar] = [ruler.slice(0, -1), ruler.slice(-1)];
  const suit = Object.keys(rulerAbilities.suits).find(s => s[0] === suitChar);
  const abilityKey = rank === 'A' ? `A-${suit}` : rank;
  const suitAbility = rank === 'A' ? '' : `Suit: ${rulerAbilities.suits[suit]} | `;
  document.getElementById('ruler-abilities').style.display = 'block';
  document.getElementById('ruler-abilities').textContent = 
    `${player === 'player' ? 'Your' : 'AI'} Ruler - ${suitAbility}Rank: ${rulerAbilities.ranks[abilityKey]}`;
}

function playSelected() {
  if (selectedCards.length === 0) return;
  const move = selectedCards.join(',');
  selectedCards = [];
  document.getElementById('ruler-abilities').style.display = 'none';
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
