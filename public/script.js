const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let selectedCards = [];
let sessionId = new URLSearchParams(window.location.search).get('session') || 'default';
let gameData = null; // Store latest game state

function isRed(suit) {
  return ['Diamonds', 'Hearts'].includes(suit);
}

function rankValue(rank) {
  return { A: 1, J: 11, Q: 12, K: 13 }[rank] || parseInt(rank);
}

function isEven(rank) {
  return rankValue(rank) % 2 === 0;
}

function updateGameState() {
  fetch(`/api/game?session=${sessionId}`)
    .then(response => response.json())
    .then(data => {
      gameData = data; // Store game state
      console.log('Game state:', data);
      document.getElementById('discard').innerText = `Discard: ${data.discard}`;
      document.getElementById('status').innerText = data.status;
      document.getElementById('deck-size').innerText = `Deck: ${data.deckSize} cards`;
      document.getElementById('move-history').innerHTML = data.moveHistory.map(move => `<div>${move}</div>`).join('');
      document.getElementById('turn').innerText = `Turn: Player ${data.turn}`;

      const playerAHand = document.getElementById('player-a-hand');
      const playerBHand = document.getElementById('player-b-hand');
      playerAHand.innerHTML = '';
      playerBHand.innerHTML = '';

      data.playerAHand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${isRed(card.suit) ? 'red' : ''}`;
        cardDiv.innerText = `${card.rank}${card.suit[0]}`;
        cardDiv.onclick = () => toggleCardSelection(card, cardDiv, 'A');
        playerAHand.appendChild(cardDiv);
      });

      data.playerBHand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${isRed(card.suit) ? 'red' : ''}`;
        cardDiv.innerText = `${card.rank}${card.suit[0]}`;
        cardDiv.onclick = () => toggleCardSelection(card, cardDiv, 'B');
        playerBHand.appendChild(cardDiv);
      });

      document.getElementById('player-a-ruler').innerText = `Ruler: ${data.playerARuler}`;
      document.getElementById('player-b-ruler').innerText = `Ruler: ${data.playerBRuler}`;
      document.getElementById('play-button').disabled = !data.canPlay;
      document.getElementById('draw-button').disabled = data.deckSize === 0;

      if (data.fortActive) {
        document.getElementById('fort').innerText = `Fort Active: ${data.fortRank}`;
      } else {
        document.getElementById('fort').innerText = 'Fort: None';
      }

      document.getElementById('pair5-choice').style.display = data.pair5Pending ? 'block' : 'none';
      document.getElementById('pair6-target').style.display = data.pair6Pending ? 'block' : 'none';
      document.getElementById('pair7-choice').style.display = data.pair7Pending ? 'block' : 'none';

      // Reset ruler abilities display if no cards selected or ruler clicked
      if (selectedCards.length === 0) {
        document.getElementById('ruler-abilities').innerHTML = '';
      }
    })
    .catch(error => console.error('Error fetching game state:', error));
}

function toggleCardSelection(card, cardDiv, player) {
  if (document.getElementById('turn').innerText !== `Turn: Player ${player}`) return;
  const cardStr = `${card.rank}${card.suit[0]}`;
  const index = selectedCards.indexOf(cardStr);
  if (index === -1) {
    selectedCards.push(cardStr);
    cardDiv.classList.add('selected');
  } else {
    selectedCards.splice(index, 1);
    cardDiv.classList.remove('selected');
  }
  showCardEffects();
}

function showRulerAbilities(player) {
  if (!gameData) return;
  const ruler = player === 'A' ? gameData.playerARuler : gameData.playerBRuler;
  if (ruler === 'None') {
    document.getElementById('ruler-abilities').innerHTML = 'No ruler selected.';
    return;
  }
  const effect = gameData.rulerEffects[player === 'A' ? 0 : 1];
  document.getElementById('ruler-abilities').innerHTML = `
    <h3>Player ${player} Ruler Effects (${ruler}):</h3>
    <p>${effect}</p>
  `;
}

function showCardEffects() {
  if (!gameData || selectedCards.length === 0) {
    document.getElementById('ruler-abilities').innerHTML = '';
    return;
  }

  const cards = selectedCards.map(cs => {
    const rank = cs.slice(0, -1);
    const suitChar = cs.slice(-1);
    const suit = suits.find(s => s[0].toUpperCase() === suitChar.toUpperCase());
    return { rank, suit };
  });
  const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
  const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
  const isFourOfAKind = cards.length === 4 && cards.every(c => c.rank === cards[0].rank);
  const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
  const isStraight = (values.every((v, i) => i === 0 || v === values[i - 1] + 1) || values.join(',') === '1,10,11,12,13') && cards.length >= 4;
  const isFlush = cards.every(c => c.suit === cards[0].suit) && cards.length >= 4;
  const allEven = cards.every(c => isEven(c.rank)) && cards.length >= 5;
  const allOdd = cards.every(c => !isEven(c.rank)) && cards.length >= 5;

  let effectText = '';
  if (isPair) {
    effectText = gameData.pairEffects[cards[0].rank] || 'Opponents draw 2 cards.';
  } else if (isToaK) {
    effectText = cards[0].rank === 'A' ? 'Opponents draw 8 cards (3 + 5 for ToaK Aces).' : `Opponents draw 3 cards and create a fort (destroy with higher pair).`;
  } else if (isFourOfAKind) {
    effectText = gameData.fourOfAKindEffects[cards[0].rank] || 'Opponents draw 4 cards.';
  } else if (isStraight) {
    const drawAmount = Math.max(0, cards.length - 2);
    if (values[0] === 1 && values.length >= 5) {
      effectText = `Tiny Straight: Opponents draw ${drawAmount} + 2 cards, must play A, 2, or 3 next.`;
    } else if (values[0] === 10 && values.length >= 5 && values.join(',') === '10,11,12,13') {
      effectText = `Royal Straight: Opponents draw ${drawAmount} + 3 cards, must play J, Q, or K next.`;
    } else {
      effectText = `Straight: Opponents draw ${drawAmount} cards.`;
    }
  } else if (isFlush && cards.length >= 5) {
    const drawAmount = Math.max(0, cards.length - 2);
    if (cards.length === 5 && (values[0] === 1 || values[0] === 10)) {
      effectText = `${values[0] === 1 ? 'Tiny' : 'Royal'} Flush: Opponents draw 7 cards.`;
    } else {
      effectText = `Flush: Opponents draw ${drawAmount} cards.`;
    }
  } else if (allEven) {
    const drawAmount = Math.max(0, cards.length - 3);
    effectText = `Even Only: Opponents draw ${drawAmount} cards.`;
  } else if (allOdd) {
    const drawAmount = Math.max(0, cards.length - 3);
    effectText = `Odd Only: Opponents draw ${drawAmount} cards.`;
  } else if (cards.length === 1) {
    const ruler = gameData.turn === 'A' ? gameData.players[0].ruler : gameData.players[1].ruler;
    const rulerRank = ruler?.rank;
    const cardRank = cards[0].rank;
    if (rulerRank === '3' && cardRank === '7') effectText = 'Ruler 3: Lucky Clover - Opponents draw 2 cards.';
    else if (rulerRank === '7' && cardRank === '3') effectText = 'Ruler 7: Lucky Spin - Opponents draw 2 cards.';
    else if (rulerRank === '6' && cardRank === '6') effectText = 'Ruler 6: Nightmare - Opponents draw to 7 cards.';
    else if (rulerRank === '8' && cardRank === '8') effectText = 'Ruler 8: Seeing Red - Opponents with 3 or fewer cards draw 2.';
    else if (rulerRank === 'Q' && cardRank === 'K') effectText = 'Ruler Q: Ruler’s Touch - Opponents draw 1 card.';
    else if (cardRank === '9') effectText = 'Ruler 9 (if opponent has it): Reverse Nightmare - They discard to 5 cards.';
    else effectText = 'Matches discard by rank, suit, or even/odd.';
  }

  document.getElementById('ruler-abilities').innerHTML = `
    <h3>Selected Cards Effect (${selectedCards.join(', ')}):</h3>
    <p>${effectText || 'No special effect.'}</p>
  `;
}

function playCards() {
  if (selectedCards.length === 0) {
    alert('Select at least one card to play!');
    return;
  }
  fetch(`/api/game?session=${sessionId}&move=${selectedCards.join(',')}`, { method: 'POST' })
    .then(response => response.json())
    .then(data => {
      selectedCards = [];
      document.querySelectorAll('.card').forEach(card => card.classList.remove('selected'));
      updateGameState();
    });
}

function drawCard() {
  fetch(`/api/game?session=${sessionId}&move=draw`, { method: 'POST' })
    .then(response => response.json())
    .then(updateGameState);
}

function resetGame() {
  fetch(`/api/game?session=${sessionId}&reset=true`, { method: 'POST' })
    .then(response => response.json())
    .then(updateGameState);
}

function addCards() {
  const cardCode = document.getElementById('card-input').value.toUpperCase();
  fetch(`/api/game?session=${sessionId}&addCards=${cardCode}`, { method: 'POST' })
    .then(response => response.json())
    .then(updateGameState);
}

function submitPair5Choice() {
  const choice = document.getElementById('pair5-card').value.toUpperCase();
  fetch(`/api/game?session=${sessionId}&pair5Choice=${choice}`, { method: 'POST' })
    .then(response => response.json())
    .then(updateGameState);
}

function submitPair6Target() {
  const target = document.getElementById('pair6-player').value;
  fetch(`/api/game?session=${sessionId}&pair6Target=${target}`, { method: 'POST' })
    .then(response => response.json())
    .then(updateGameState);
}

function submitPair7Choice() {
  const choice = document.getElementById('pair7-card').value.toUpperCase();
  fetch(`/api/game?session=${sessionId}&pair7Choice=${choice}`, { method: 'POST' })
    .then(response => response.json())
    .then(updateGameState);
}

document.getElementById('play-button').onclick = playCards;
document.getElementById('draw-button').onclick = drawCard;
document.getElementById('reset-button').onclick = resetGame;
document.getElementById('add-cards-btn').onclick = addCards;
document.getElementById('pair5-submit').onclick = submitPair5Choice;
document.getElementById('pair6-submit').onclick = submitPair6Target;
document.getElementById('pair7-submit').onclick = submitPair7Choice;

updateGameState();
