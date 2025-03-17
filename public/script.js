let selectedCards = [];
let currentPhase = 'setup'; // Track the game phase
let abilityDescription = ''; // Store the ability description to display

async function fetchGameState() {
  try {
    const response = await fetch('/api/game?players=2');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const game = await response.json();
    currentPhase = game.phase; // Update the current phase
    updateUI(game);
  } catch (error) {
    console.error('Error fetching game state:', error);
    document.getElementById('status').textContent = `Error loading game: ${error.message}`;
  }
}

function updateUI(game) {
  document.getElementById('status').textContent = game.status + (abilityDescription ? ` | Ability: ${abilityDescription}` : '');
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
      const button = document.createElement('button');
      button.textContent = `Player ${String.fromCharCode(65 + idx)}`;
      button.onclick = () => selectPair6Target(idx);
      pair6TargetOptions.appendChild(button);
      pair6TargetOptions.appendChild(document.createTextNode(' '));
    });
  } else {
    pair6Choices.style.display = 'none';
  }

  const fortChoice = document.getElementById('fortChoice');
  fortChoice.style.display = game.fortChoicePending && game.turn === game.fortChoicePlayer ? 'block' : 'none';
}

function selectCard(card, playerIndex) {
  if (playerIndex !== 0) return;

  if (currentPhase === 'setup') {
    // During ruler selection, replace the selected card instead of toggling
    selectedCards = [card];
    // Show ruler ability description
    const [rank, suitChar] = [card.slice(0, -1), card.slice(-1)];
    const suit = ['Diamonds', 'Hearts', 'Spades', 'Clubs'].find(s => s[0] === suitChar);
    const rulerKey = rank === 'A' ? `A-${suit}` : rank;
    abilityDescription = rulerAbilities.ranks[rulerKey] || rulerAbilities.suits[suit] || 'No special ability';
  } else {
    // Normal behavior for other phases: toggle selection
    const index = selectedCards.indexOf(card);
    if (index === -1) {
      selectedCards.push(card);
    } else {
      selectedCards.splice(index, 1);
    }
    // Show pair or ToaK ability if applicable
    if (selectedCards.length === 2 && selectedCards.every(c => {
      const [r] = [c.slice(0, -1)];
      return r === selectedCards[0].slice(0, -1);
    })) {
      abilityDescription = rulerAbilities.pairs[selectedCards[0].slice(0, -1)] || 'No pair ability';
    } else if (selectedCards.length === 3 && selectedCards.every(c => {
      const [r] = [c.slice(0, -1)];
      return r === selectedCards[0].slice(0, -1);
    })) {
      abilityDescription = 'Three of a Kind: Activates Fort (same as Pair 9)';
    } else {
      abilityDescription = '';
    }
  }

  // Update visual feedback for selected cards
  document.querySelectorAll('.card').forEach(span => {
    if (selectedCards.includes(span.textContent)) {
      span.style.backgroundColor = '#ddd';
    } else {
      span.style.backgroundColor = '';
    }
  });

  // Update the move input field with the selected cards
  document.getElementById('moveInput').value = selectedCards.join(',');
  updateUI({ ...gameStates['default'], status: gameStates['default'].status }); // Refresh UI to show ability
}

async function makeMove() {
  try {
    const move = document.getElementById('moveInput').value;
    if (move) {
      const response = await fetch(`/api/game?players=2&move=${move}`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      selectedCards = [];
      abilityDescription = ''; // Clear ability description after move
      document.getElementById('moveInput').value = '';
      fetchGameState();
    }
  } catch (error) {
    console.error('Error making move:', error);
    document.getElementById('status').textContent = `Error making move: ${error.message}`;
  }
}

async function drawCard() {
  try {
    const response = await fetch('/api/game?players=2&move=draw', { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error drawing card:', error);
    document.getElementById('status').textContent = `Error drawing card: ${error.message}`;
  }
}

async function resetGame() {
  try {
    const response = await fetch('/api/game?players=2&reset=true', { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error resetting game:', error);
    document.getElementById('status').textContent = `Error resetting game: ${error.message}`;
  }
}

async function addCard() {
  try {
    const card = document.getElementById('addCardInput').value;
    if (card) {
      const response = await fetch(`/api/game?players=2&addCards=${card}`, { method: 'POST' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      fetchGameState();
    }
  } catch (error) {
    console.error('Error adding card:', error);
    document.getElementById('status').textContent = `Error adding card: ${error.message}`;
  }
}

async function selectPair5DiscardChoice(choice) {
  try {
    const response = await fetch(`/api/game?players=2&pair5DiscardChoice=${choice}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error selecting pair5 discard:', error);
    document.getElementById('status').textContent = `Error selecting pair5 discard: ${error.message}`;
  }
}

async function selectPair5HandChoice(choice) {
  try {
    const response = await fetch(`/api/game?players=2&pair5HandChoice=${choice}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error selecting pair5 hand:', error);
    document.getElementById('status').textContent = `Error selecting pair5 hand: ${error.message}`;
  }
}

async function selectPair7DeckChoice(choice) {
  try {
    const response = await fetch(`/api/game?players=2&pair7DeckChoice=${choice}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error selecting pair7 deck:', error);
    document.getElementById('status').textContent = `Error selecting pair7 deck: ${error.message}`;
  }
}

async function selectPair7HandChoice(choice) {
  try {
    const response = await fetch(`/api/game?players=2&pair7HandChoice=${choice}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error selecting pair7 hand:', error);
    document.getElementById('status').textContent = `Error selecting pair7 hand: ${error.message}`;
  }
}

async function selectPair6Target(target) {
  try {
    const response = await fetch(`/api/game?players=2&pair6Target=${target}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error selecting pair6 target:', error);
    document.getElementById('status').textContent = `Error selecting pair6 target: ${error.message}`;
  }
}

async function makeFortChoice(choice) {
  try {
    const response = await fetch(`/api/game?players=2&fortChoice=${choice}`, { method: 'POST' });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    fetchGameState();
  } catch (error) {
    console.error('Error making fort choice:', error);
    document.getElementById('status').textContent = `Error making fort choice: ${error.message}`;
  }
}

fetchGameState();
setInterval(fetchGameState, 5000);
