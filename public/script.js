let selectedCards = [];

async function fetchGameState() {
  const response = await fetch('/api/game?players=2');
  const game = await response.json();
  updateUI(game);
}

function updateUI(game) {
  document.getElementById('status').textContent = game.status;
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
  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
  } else {
    selectedCards.splice(index, 1);
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

async function makeMove() {
  const move = document.getElementById('moveInput').value;
  if (move) {
    await fetch(`/api/game?players=2&move=${move}`, { method: 'POST' });
    selectedCards = [];
    document.getElementById('moveInput').value = '';
    fetchGameState();
  }
}

async function drawCard() {
  await fetch('/api/game?players=2&move=draw', { method: 'POST' });
  fetchGameState();
}

async function resetGame() {
  await fetch('/api/game?players=2&reset=true', { method: 'POST' });
  fetchGameState();
}

async function addCard() {
  const card = document.getElementById('addCardInput').value;
  if (card) {
    await fetch(`/api/game?players=2&addCards=${card}`, { method: 'POST' });
    fetchGameState();
  }
}

async function selectPair5DiscardChoice(choice) {
  await fetch(`/api/game?players=2&pair5DiscardChoice=${choice}`, { method: 'POST' });
  fetchGameState();
}

async function selectPair5HandChoice(choice) {
  await fetch(`/api/game?players=2&pair5HandChoice=${choice}`, { method: 'POST' });
  fetchGameState();
}

async function selectPair7DeckChoice(choice) {
  await fetch(`/api/game?players=2&pair7DeckChoice=${choice}`, { method: 'POST' });
  fetchGameState();
}

async function selectPair7HandChoice(choice) {
  await fetch(`/api/game?players=2&pair7HandChoice=${choice}`, { method: 'POST' });
  fetchGameState();
}

async function selectPair6Target(target) {
  await fetch(`/api/game?players=2&pair6Target=${target}`, { method: 'POST' });
  fetchGameState();
}

async function makeFortChoice(choice) {
  await fetch(`/api/game?players=2&fortChoice=${choice}`, { method: 'POST' });
  fetchGameState();
}

fetchGameState();
setInterval(fetchGameState, 5000);
