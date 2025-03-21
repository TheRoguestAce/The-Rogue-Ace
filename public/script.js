const sessionId = localStorage.getItem('rogueAceSession') || Date.now().toString();
localStorage.setItem('rogueAceSession', sessionId);
let selectedCards = [];
let data = {};

const rulerAbilities = {
  suits: {
    Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
    Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
    Spades: 'Sliced: Spades count as both their rank and rank ÷ 2 rounded up - 1 (pairs OK)',
    Clubs: 'Strike: Play a pair if 5+ in hand'
  },
  ranks: {
    2: 'Twice the Might: Pairs make the opponent draw double (4 instead of 2)',
    3: 'Lucky Clover: Play a 7 anytime, the opponent draws 2',
    4: 'Fourfold: Four of a kind reshuffles all cards, the opponent draws 7, the player draws 3',
    5: 'High Five: Face cards count as 5 (pairs OK)',
    6: 'Nightmare: Playing a 6 makes the opponent draw to 7 cards',
    7: 'Lucky Spin: Play a 3 anytime, the opponent draws 2',
    8: 'Seeing Red: If the opponent has ≤3 cards, 8 makes them draw 2',
    9: 'Reverse Nightmare: The opponent’s 9s make the player discard to 5 cards',
    10: 'Perfection: Play multiple even cards on an even card or empty pile (no pairs)',
    J: 'Servant: J/Q/K/A count as each other (pairs OK)',
    Q: 'Ruler’s Touch: Kings are wild cards, counting as every rank, make the opponent draw 1 (pairs OK)',
    K: 'Ruler of Rulers: Inherits all of the opponent’s ruler abilities, replay with 5 cards on first win',
    'A-Diamonds': 'Perfect Card: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)',
    'A-Hearts': 'Otherworldly Touch: Hearts are wild cards, counting as every rank, others mimic this card (no pairs)',
    'A-Spades': 'Pocket Knife: All cards count as both their rank and half rank rounded down (pairs OK)',
    'A-Clubs': 'Nuclear Bomb: First win reshuffles, others 7 cards, winner 5 (skips if the player wins first)'
  },
  pairs: {
    A: 'Pocket Aces: Until you play again, opponent must play 10 or above',
    2: 'Pair Pair: Opponent draws 3 cards instead of 2',
    3: 'Feeling Off: Until you play again, opponent must play odd numbers',
    4: 'Half the Cards: Until you play again, opponent cannot play 8 or above',
    5: 'Medium Rare: Take a card from discard and swap with one of yours',
    6: 'Devilish Stare: Choose an opponent to skip their turn',
    7: 'Double Luck: Look at top deck card, swap with one of yours, reshuffle',
    8: 'Good Fortune: Play again and set discard',
    9: 'Fort: Only pairs or better can play until destroyed or your next turn; draw 1 if no pair',
    10: 'Feeling Right: Until you play again, opponent must play even numbers',
    J: 'High Card: Until you play again, opponent must play 8 or above',
    Q: 'Complaint: Opponent draws 1, you return a card to deck and shuffle',
    K: 'I am your Father: Until you play again, opponent alternates even/odd (K/J odd)'
  }
};

async function fetchGame(move = '', reset = false) {
  const url = reset ? `/api/game?session=${sessionId}&reset=true` : move ? `/api/game?session=${sessionId}&move=${move}` : `/api/game?session=${sessionId}`;
  console.log(`Fetching: ${url}`);
  const res = await fetch(url, { method: move || reset ? 'POST' : 'GET' });
  data = await res.json();
  console.log('Received:', JSON.stringify(data));
  updateDisplay(data);
}

function updateDisplay(data) {
  document.getElementById('discard').textContent = data.discard || 'None';
  const playerAHandElement = document.getElementById('playerAHand');
  const playerBHandElement = document.getElementById('playerBHand');
  
  if (data.playerAHand && data.playerAHand.length > 0 && data.turn === 'A') {
    playerAHandElement.innerHTML = data.playerAHand.map(c => {
      const cardStr = `${c.rank}${c.suit[0]}`;
      const isSelected = selectedCards.includes(cardStr);
      return `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''} ${isSelected ? 'selected' : ''}" data-card="${cardStr}" onclick="toggleCard('${cardStr}')">${cardStr}</span>`;
    }).join(' ');
  } else {
    playerAHandElement.textContent = data.playerAHand.map(c => `${c.rank}${c.suit[0]}`).join(', ') || 'Empty';
  }

  if (data.playerBHand && data.playerBHand.length > 0 && data.turn === 'B') {
    playerBHandElement.innerHTML = data.playerBHand.map(c => {
      const cardStr = `${c.rank}${c.suit[0]}`;
      const isSelected = selectedCards.includes(cardStr);
      return `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''} ${isSelected ? 'selected' : ''}" data-card="${cardStr}" onclick="toggleCard('${cardStr}')">${cardStr}</span>`;
    }).join(' ');
  } else {
    playerBHandElement.textContent = data.playerBHand.map(c => `${c.rank}${c.suit[0]}`).join(', ') || 'Empty';
  }

  document.getElementById('playerARuler').textContent = data.playerARuler || 'None';
  document.getElementById('playerBRuler').textContent = data.playerBRuler || 'None';
  document.getElementById('status').textContent = data.status || 'Error';
  document.getElementById('turn').textContent = data.turn || '?';
  document.getElementById('moveHistory').textContent = (data.moveHistory || []).join(' | ') || 'None';
  document.getElementById('deckSize').textContent = data.deckSize || '?';
  document.getElementById('draw-button').style.display = data.canPlay ? 'none' : 'inline';
  
  if (data.phase === 'over') alert(data.status);
  if (data.pairEffect) document.getElementById('status').textContent += ` (Pair ${data.pairEffect} active)`;
  if (data.fortActive) document.getElementById('status').textContent += ` (Fort active${data.fortRank ? ` - ${data.fortRank}` : ''})`;

  if (data.pair5Pending && data.turn === 'A') {
    document.getElementById('status').textContent += ' Select card to swap with discard';
    playerAHandElement.innerHTML += ' <span onclick="playSelected(\'swap\')">Swap</span>';
  } else if (data.pair6Pending && data.turn === 'A') {
    document.getElementById('status').textContent += ' Select opponent to skip';
    playerAHandElement.innerHTML += ' <span onclick="playSelected(\'skip\')">Skip</span>';
  } else if (data.pair7Pending && data.turn === 'A') {
    document.getElementById('status').textContent += ' Select card to swap with deck';
    playerAHandElement.innerHTML += ' <span onclick="playSelected(\'swap\')">Swap</span>';
  }

  if (data.phase === 'setup' && selectedCards.length === 1) {
    showRulerAbilities(data.turn === 'A' ? 'playerA' : 'playerB', selectedCards[0]);
  } else if (data.phase === 'play' && selectedCards.length >= 2) {
    const isPair = selectedCards.length === 2 && selectedCards.every(c => c.slice(0, -1) === selectedCards[0].slice(0, -1));
    const isToaK = selectedCards.length === 3 && selectedCards.every(c => c.slice(0, -1) === selectedCards[0].slice(0, -1));
    if (isPair) {
      const rank = selectedCards[0].slice(0, -1);
      document.getElementById('ruler-abilities').style.display = 'block';
      document.getElementById('ruler-abilities').textContent = `Pair Effect - ${rulerAbilities.pairs[rank]}`;
    } else if (isToaK) {
      const rank = selectedCards[0].slice(0, -1);
      document.getElementById('ruler-abilities').style.display = 'block';
      document.getElementById('ruler-abilities').textContent = rank === 'A' ? 'ToaK Aces: Opponent draws 8' : `ToaK ${rank}: Fort created (destroy with higher pair)`;
    } else {
      document.getElementById('ruler-abilities').style.display = 'none';
    }
  } else {
    document.getElementById('ruler-abilities').style.display = 'none';
  }
}

function toggleCard(card) {
  if (data.phase === 'setup') {
    selectedCards = [card];
    fetchGame();
  } else if (data.turn === 'A' && data.playerAHand.some(c => `${c.rank}${c.suit[0]}` === card) ||
             data.turn === 'B' && data.playerBHand.some(c => `${c.rank}${c.suit[0]}` === card)) {
    const index = selectedCards.indexOf(card);
    if (index === -1) {
      selectedCards.push(card);
    } else {
      selectedCards.splice(index, 1);
    }
    fetchGame();
  }
}

function showRulerAbilities(player, selectedCard = null) {
  const ruler = selectedCard || (player === 'playerA' ? data.playerARuler : data.playerBRuler);
  if (!ruler || ruler === 'None') return;
  const [rank, suitChar] = [ruler.slice(0, -1), ruler.slice(-1)];
  const suit = Object.keys(rulerAbilities.suits).find(s => s[0] === suitChar);
  const abilityKey = rank === 'A' ? `A-${suit}` : rank;
  const suitAbility = rank === 'A' ? '' : `Suit: ${rulerAbilities.suits[suit]} | `;
  document.getElementById('ruler-abilities').style.display = 'block';
  document.getElementById('ruler-abilities').textContent = 
    `${player === 'playerA' ? 'Player A' : 'Player B'} Ruler - ${suitAbility}Rank: ${rulerAbilities.ranks[abilityKey]}`;
}

function playSelected(action = '') {
  if (selectedCards.length === 0 && !action) return;
  if (data.pair5Pending && action === 'swap' && data.turn === 'A') {
    fetchGame(`?pair5Choice=${selectedCards[0]}`);
  } else if (data.pair6Pending && action === 'skip' && data.turn === 'A') {
    fetchGame(`?pair6Target=1`); // Only supports skipping Player B for now
  } else if (data.pair7Pending && action === 'swap' && data.turn === 'A') {
    fetchGame(`?pair7Choice=${selectedCards[0]}`);
  } else if (data.fortRank === '9' && action === 'break') {
    fetchGame('break');
  } else if (data.fortRank === '9' && action === 'maintain') {
    fetchGame('maintain');
  } else {
    const move = selectedCards.join(',');
    selectedCards = [];
    document.getElementById('ruler-abilities').style.display = 'none';
    fetchGame(move);
  }
}

function drawCards() {
  selectedCards = [];
  document.getElementById('ruler-abilities').style.display = 'none';
  fetchGame('draw');
}

function resetGame() {
  selectedCards = [];
  document.getElementById('ruler-abilities').style.display = 'none';
  fetchGame('', true);
}

document.getElementById('addCardsBtn').addEventListener('click', async () => {
  const cardInput = document.getElementById('cardInput').value.trim();
  if (cardInput) {
    await fetch(`/api/game?session=${sessionId}&addCards=${cardInput}`, { method: 'POST' });
    document.getElementById('cardInput').value = '';
    await fetchGame();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  fetchGame();
});
