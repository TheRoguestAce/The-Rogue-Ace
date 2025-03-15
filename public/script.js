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
    5: 'Medium Rare: Take a 5 from discard, pick a card from deck, reshuffle, set 5 as discard',
    6: 'Devilish Stare: Opponent skips their next turn',
    7: 'Double Luck: Look at top 2 cards, replace one of yours, reshuffle',
    8: 'Good Fortune: Put any card on discard pile, opponent follows it',
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
  if (data.phase !== 'over' && data.turn === 0 && move && move !== 'draw' && !reset) {
    setTimeout(() => fetchGame(), 500);
  }
}

function updateDisplay(data) {
  document.getElementById('discard').textContent = data.discard || 'None';
  const playerHandElement = document.getElementById('player-hand');
  if (data.playerHand && data.playerHand.length > 0) {
    playerHandElement.innerHTML = data.playerHand.map(c => {
      const cardStr = `${c.rank}${c.suit[0]}`;
      const isSelected = selectedCards.includes(cardStr);
      return `<span class="card ${['Diamonds', 'Hearts'].includes(c.suit) ? 'red' : ''} ${isSelected ? 'selected' : ''}" data-card="${cardStr}" onclick="toggleCard('${cardStr}')">${cardStr}</span>`;
    }).join(' ');
  } else {
    playerHandElement.textContent = 'Empty';
  }
  document.getElementById('ai-hand').textContent = data.aiHandSize || 0;
  document.getElementById('player-ruler').textContent = data.playerRuler || 'None';
  document.getElementById('ai-ruler').textContent = data.aiRuler || 'None';
  document.getElementById('status').textContent = data.status || 'Error';
  document.getElementById('move-history').textContent = (data.moveHistory || []).join(' | ') || 'None';
  document.getElementById('draw-button').style.display = data.canPlay ? 'none' : 'inline';
  console.log('Hand size:', data.playerHand.length);
  if (data.phase === 'over') alert(data.status);
  if (data.pairEffect) document.getElementById('status').textContent += ` (Pair ${data.pairEffect} active)`;
  if (data.fortActive) document.getElementById('status').textContent += ' (Fort active)';

  // Show pair effect only for valid pairs
  if (data.phase === 'play' && selectedCards.length === 2) {
    const [card1, card2] = selectedCards;
    const rank1 = card1.slice(0, -1);
    const rank2 = card2.slice(0, -1);
    const suit1 = card1.slice(-1);
    const suit2 = card2.slice(-1);
    const cardsToCheck = [
      { rank: rank1, suit: Object.keys(rulerAbilities.suits).find(s => s[0] === suit1) },
      { rank: rank2, suit: Object.keys(rulerAbilities.suits).find(s => s[0] === suit2) }
    ];
    const top = data.discard === 'None' ? null : {
      rank: data.discard.slice(0, -1),
      suit: Object.keys(rulerAbilities.suits).find(s => s[0] === data.discard.slice(-1))
    };
    
    // Simulate isValidPlay check (simplified client-side version)
    const isPair = rank1 === rank2;
    let isValid = false;
    if (isPair) {
      // Check if pair is valid against current game state
      const move = selectedCards.join(',');
      fetch(`/api/game?session=${sessionId}&move=${move}`, { method: 'POST' })
        .then(res => res.json())
        .then(result => {
          if (result.status !== 'Invalid play!') {
            isValid = true;
            document.getElementById('ruler-abilities').style.display = 'block';
            document.getElementById('ruler-abilities').textContent = `Pair Effect - ${rulerAbilities.pairs[rank1]}`;
          } else {
            document.getElementById('ruler-abilities').style.display = 'none';
          }
        })
        .catch(() => {
          document.getElementById('ruler-abilities').style.display = 'none';
        });
    } else {
      document.getElementById('ruler-abilities').style.display = 'none';
    }
  } else {
    document.getElementById('ruler-abilities').style.display = 'none';
  }
}

// Inline CSS for yellow highlight
document.head.insertAdjacentHTML('beforeend', `
  <style>
    .card.selected {
      background-color: yellow;
      color: black; /* Ensure readability on yellow */
    }
    .card.red {
      color: red;
    }
    .card {
      padding: 2px 5px;
      margin: 2px;
      cursor: pointer;
      display: inline-block;
    }
  </style>
`);

function toggleCard(card) {
  if (data.phase === 'setup') {
    selectedCards = [card];
    showRulerAbilities('player', card);
  } else {
    const index = selectedCards.indexOf(card);
    if (index === -1) {
      selectedCards.push(card);
    } else {
      selectedCards.splice(index, 1);
    }
    fetchGame(); // Refreshes display to check for valid pair
  }
}

function showRulerAbilities(player, selectedCard = null) {
  const ruler = selectedCard ? selectedCard : (player === 'player' ? document.getElementById('player-ruler').textContent : document.getElementById('ai-ruler').textContent);
  if (ruler === 'None' && !selectedCard) return;
  const [rank, suitChar] = [ruler.slice(0, -1), ruler.slice(-1)];
  const suit = Object.keys(rulerAbilities.suits).find(s => s[0] === suitChar);
  const abilityKey = rank === 'A' ? `A-${suit}` : rank;
  const suitAbility = rank === 'A' ? '' : `Suit: ${rulerAbilities.suits[suit]} | `;
  const pairAbility = rulerAbilities.pairs[rank] ? `Pair: ${rulerAbilities.pairs[rank]} | ` : '';
  document.getElementById('ruler-abilities').style.display = 'block';
  document.getElementById('ruler-abilities').textContent = 
    `${player === 'player' ? 'Player' : 'Opponent'} Ruler - ${suitAbility}${pairAbility}Rank: ${rulerAbilities.ranks[abilityKey]}`;
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
  document.getElementById('ruler-abilities').style.display = 'none';
  fetchGame('draw');
}

function resetGame() {
  selectedCards = [];
  document.getElementById('ruler-abilities').style.display = 'none';
  fetchGame('', true);
}

document.addEventListener('DOMContentLoaded', () => {
  fetchGame();
});
