let selectedCards = [];
let currentPhase = 'setup';
let abilityDescription = '';
let currentGameState = null;

const rulerAbilities = {
  suits: {
    Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
    Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
    Spades: 'Sliced: Spades count as both their rank and rank ÷ 2 rounded up - 1 (2 = King)',
    Clubs: 'Strike: Play two valid cards as a pair if 5+ cards in hand (3+ remain after play)'
  },
  ranks: {
    2: 'Twice the Might: Pairs make all opponents draw 2 extra cards',
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
    K: 'Ruler of Rulers: Gain abilities of all other rulers on field',
    'A-Diamonds': 'Perfect Card: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)',
    'A-Hearts': 'Otherworldly Touch: Hearts are wild cards, counting as every rank (no pairs)',
    'A-Spades': 'Pocket Knife: All cards count as both their rank and half rank rounded down (pairs OK)',
    'A-Clubs': 'Nuclear Bomb: If another player wins without this ruler, reshuffle deck once, opponents draw 7, winner draws 5'
  },
  pairs: {
    A: 'Pocket Aces: Until you play again, all opponents must play 10 or above',
    2: 'Pair Pair: Opponent draws 1 extra card on top of the normal 2',
    3: 'Feeling Off: Until you play again, all opponents must play odd numbers',
    4: 'Half the Cards: Until you play again, all opponents cannot play 8 or above',
    5: 'Medium Rare: See last 5 unique discard pile cards, swap one with a hand card',
    6: 'Devilish Stare: Pick one opponent, they skip their next turn once',
    7: 'Double Luck: See top 2 deck cards, swap one with a hand card',
    8: 'Good Fortune: Play again and set discard (choose either card)',
    9: 'Fort: Only pairs or better can play until destroyed or your next turn; all opponents draw 1 if no pair',
    10: 'Feeling Right: Until you play again, all opponents must play even numbers',
    J: 'High Card: Until you play again, all opponents must play 8 or above',
    Q: 'Complaint: All opponents draw 1, play again and set any discard (choose either card)',
    K: 'I am your Father: Until you play again, all opponents alternate even/odd (start even, end on your turn)'
  }
};

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
  const statusText = game.status + (abilityDescription ? ` | Ability: ${abilityDescription}` : '');
  document.getElementById('status').textContent = statusText;
  document.getElementById('turn').textContent = String.fromCharCode(65 + game.turn);
  document.getElementById('discard').textContent = game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None';
  document.getElementById('deckSize').textContent = game.deck.length;
  document.getElementById('wins').textContent = game.wins.map((w, i) => `${String.fromCharCode(65 + i)}: ${w}`).join(', ');

  const playersDiv = document.getElementById('players');
  playersDiv.innerHTML = '';
  game.players.forEach((player, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.innerHTML = `<strong>Player ${String.fromCharCode(65 + index)} Hand:</strong> ${
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
  if (game.pair5Pending && game.turn === 0) {
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

  const pair7Choices = document.getElementById('pair7Choices');
  const pair7DeckOptions = document.getElementById('pair7DeckOptions');
  const pair7HandOptions = document.getElementById('pair7HandOptions');
  const pair7HandCards = document.getElementById('pair7HandCards');
  if (game.pair7Pending && game.turn === 0) {
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

  const pair6Choices = document.getElementById('pair6Choices');
  const pair6TargetOptions = document.getElementById('pair6TargetOptions');
  if (game.pair6Pending && game.turn === 0) {
    pair6Choices.style.display = 'block';
    pair6TargetOptions.innerHTML = '';
    game.opponents.forEach(idx => {
      const span = document.createElement('span');
      span.className = 'card';
      span.textContent = `Player ${String.fromCharCode(65 + idx)}`;
      span.onclick = () => selectPair6Target(idx);
      pair6TargetOptions.appendChild(span);
      pair6TargetOptions.appendChild(document.createTextNode(', '));
    });
  } else {
    pair6Choices.style.display = 'none';
  }

  const fortChoices = document.getElementById('fortChoices');
  if (game.fortChoicePending && game.turn === 0) {
    fortChoices.style.display = 'block';
  } else {
    fortChoices.style.display = 'none';
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
  if (playerIndex !== 0) return; // Only Player A can interact

  if (currentPhase === 'setup') {
    selectedCards = [card];
    const [rank, suitChar] = [card.slice(0, -1), card.slice(-1)];
    const suit = ['Diamonds', 'Hearts', 'Spades', 'Clubs'].find(s => s[0] === suitChar);
    const rulerKey = rank === 'A' ? `A-${suit}` : rank;
    abilityDescription = rulerAbilities.ranks[rulerKey] || rulerAbilities.suits[suit] || 'No special ability';
  } else {
    const index = selectedCards.indexOf(card);
    if (index === -1) {
      selectedCards.push(card);
    } else {
      selectedCards.splice(index, 1);
    }
    // Check for pair or ToaK and set ability description
    if (selectedCards.length === 2 && selectedCards.every(c => c.slice(0, -1) === selectedCards[0].slice(0, -1))) {
      const rank = selectedCards[0].slice(0, -1);
      abilityDescription = rulerAbilities.pairs[rank] || 'No pair ability';
    } else if (selectedCards.length === 3 && selectedCards.every(c => c.slice(0, -1) === selectedCards[0].slice(0, -1))) {
      abilityDescription = 'Three of a Kind: Activates Fort (same as Pair 9)';
    } else {
      abilityDescription = '';
    }
  }

  document.querySelectorAll('.card').forEach(span => {
    if (selectedCards.includes(span.textContent)) {
      span.style.backgroundColor = '#ddd';
    } else {
      span.style.backgroundColor = '';
    }
  });

  document.getElementById('moveInput').value = selectedCards.join(',');
  if (currentGameState) {
    updateUI(currentGameState);
  }
}

async function makeMove() {
  const move = document.getElementById('moveInput').value;
  if (!move) return;

  await fetch(`/api/game?move=${move}`, { method: 'POST' });
  selectedCards = [];
  abilityDescription = ''; // Reset ability description after move
  document.getElementById('moveInput').value = '';
  await fetchGameState(); // Refresh immediately after move
}

async function drawCard() {
  await fetch('/api/game?move=draw', { method: 'POST' });
  selectedCards = [];
  abilityDescription = '';
  document.getElementById('moveInput').value = '';
  await fetchGameState();
}

async function resetGame() {
  await fetch('/api/game?reset=true', { method: 'POST' });
  selectedCards = [];
  abilityDescription = '';
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

async function selectPair7DeckChoice(card) {
  await fetch(`/api/game?pair7DeckChoice=${card}`, { method: 'POST' });
  await fetchGameState();
}

async function selectPair7HandChoice(card) {
  await fetch(`/api/game?pair7HandChoice=${card}`, { method: 'POST' });
  await fetchGameState();
}

async function selectPair6Target(target) {
  await fetch(`/api/game?pair6Target=${target}`, { method: 'POST' });
  await fetchGameState();
}

async function fortChoice(choice) {
  await fetch(`/api/game?fortChoice=${choice}`, { method: 'POST' });
  await fetchGameState();
}

// Initial fetch and periodic refresh
fetchGameState();
setInterval(fetchGameState, 2000);
