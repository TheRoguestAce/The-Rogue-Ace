const sessionId = localStorage.getItem('rogueAceSession') || Date.now().toString();
localStorage.setItem('rogueAceSession', sessionId);
let selectedCards = [];
let data = {};

const rulerAbilities = {
  suits: {
    Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
    Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
    Spades: 'Sliced: Spades count as both their rank and rank ÷ 2 rounded up - 1 (pairs OK)',
    Clubs: 'Strike: Play two valid cards as a pair if 5+ cards remain (7+ before play)'
  },
  ranks: {
    2: 'Twice the Might: Pairs make all opponents draw 2 extra (4 total)',
    3: 'Lucky Clover: Play a 7 anytime, all opponents draw 2',
    4: 'Fourfold: Four of a kind reshuffles all cards, all opponents draw 7, player draws 3',
    5: 'High Five: Face cards count as 5 (pairs OK)',
    6: 'Nightmare: Playing a 6 makes all opponents draw to 7 cards',
    7: 'Lucky Spin: Play a 3 anytime, all opponents draw 2',
    8: 'Seeing Red: If any opponent has ≤3 cards, 8 makes all opponents draw 2',
    9: 'Reverse Nightmare: Any opponent’s 9s make the player discard to 5 cards',
    10: 'Perfection: Play multiple even cards on an even card or empty pile (no pairs)',
    J: 'Servant: J/Q/K/A count as each other (pairs OK)',
    Q: 'Ruler’s Touch: Kings are wild cards, counting as every rank, all opponents draw 1 (pairs OK)',
    K: 'Ruler of Rulers: Inherits all opponents’ ruler abilities, replay with 5 cards on first win',
    'A-Diamonds': 'Perfect Card: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)',
    'A-Hearts': 'Otherworldly Touch: Hearts are wild cards, counting as every rank (no pairs)',
    'A-Spades': 'Pocket Knife: All cards count as both their rank and half rank rounded down (pairs OK)',
    'A-Clubs': 'Nuclear Bomb: First win reshuffles, others 7 cards, winner 5 (skips if player wins first)'
  },
  pairs: {
    A: 'Pocket Aces: Until you play again, all opponents must play 10 or above',
    2: 'Pair Pair: All opponents draw 2 extra (4 total)',
    3: 'Feeling Off: Until you play again, all opponents must play odd numbers',
    4: 'Half the Cards: Until you play again, all opponents cannot play 8 or above',
    5: 'Medium Rare: Return first 5 played to hand, take a random card from discard pile',
    6: 'Devilish Stare: Skips a random person’s next turn',
    7: 'Double Luck: Look at top card, replace one of yours, reshuffle',
    8: 'Good Fortune: Play again and set discard',
    9: 'Fort: Only pairs or better can play until destroyed or your next turn; all opponents draw 1 if no pair',
    10: 'Feeling Right: Until you play again, all opponents must play even numbers',
    J: 'High Card: Until you play again, all opponents must play 8 or above',
    Q: 'Complaint: All opponents draw 1, you pick a card to discard next turn',
    K: 'I am your Father: Until you play again, all opponents alternate even/odd (K/J odd)'
  }
};

async function fetchGame(move = '', reset = false, addCards = null) {
  let url = `/api/game?session=${sessionId}`;
  if (reset) url += '&reset=true';
  else if (move) url += `&move=${move}`;
  else if (addCards) url += `&addCards=${addCards}`;
  
  try {
    const res = await fetch(url, { method: move || reset || addCards ? 'POST' : 'GET' });
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
    data = await res.json();
    updateDisplay(data);
  } catch (error) {
    console.error('Fetch error:', error);
    document.getElementById('status').textContent = 'Error loading game!';
  }
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
  document.getElementById('play-button').disabled = selectedCards.length === 0;
  
  if (data.phase === 'over') alert(data.status);
  if (data.pairEffect) document.getElementById('status').textContent += ` (Pair ${data.pairEffect} active)`;
  if (data.fortActive) document.getElementById('status').textContent += ` (Fort active${data.fortRank ? ` - ${data.fortRank}` : ''})`;
  if (data.skipNext) document.getElementById('status').textContent += ` (Next skip: ${data.skipNext})`;

  if (data.phase === 'setup' && selectedCards.length === 1) {
    showRulerAbilities(data.turn === 'A' ? 'playerA' : 'playerB', selectedCards[0]);
  }
}

function toggleCard(card) {
  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
  } else {
    selectedCards.splice(index, 1);
  }
  updateDisplay(data);
}

function playSelected() {
  if (selectedCards.length > 0) {
    fetchGame(selectedCards.join(','));
    selectedCards = [];
  }
}

function addCards() {
  const input = document.getElementById('cardInput').value.trim();
  if (input) {
    fetchGame(null, false, input);
    document.getElementById('cardInput').value = '';
  }
}

function resetGame() {
  fetchGame('', true);
}

function showRulerAbilities(player, card = null) {
  const abilitiesDiv = document.getElementById('ruler-abilities');
  const ruler = player === 'playerA' ? data.playerARuler : data.playerBRuler;
  let abilitiesText = '';

  if (card && data.phase === 'setup') {
    const rank = card.slice(0, -1);
    const suit = card.slice(-1) === 'D' ? 'Diamonds' : card.slice(-1) === 'H' ? 'Hearts' : card.slice(-1) === 'S' ? 'Spades' : 'Clubs';
    abilitiesText = `${suit}: ${rulerAbilities.suits[suit]}<br>${rank}: ${rulerAbilities.ranks[rank] || rulerAbilities.ranks[`${rank}-${suit}`]}`;
  } else if (ruler !== 'None') {
    const rank = ruler.slice(0, -1);
    const suit = ruler.slice(-1) === 'D' ? 'Diamonds' : ruler.slice(-1) === 'H' ? 'Hearts' : ruler.slice(-1) === 'S' ? 'Spades' : 'Clubs';
    abilitiesText = `${suit}: ${rulerAbilities.suits[suit]}<br>${rank}: ${rulerAbilities.ranks[rank] || rulerAbilities.ranks[`${rank}-${suit}`]}`;
  }

  abilitiesDiv.innerHTML = abilitiesText;
  abilitiesDiv.style.display = abilitiesText ? 'block' : 'none';
}

fetchGame();
