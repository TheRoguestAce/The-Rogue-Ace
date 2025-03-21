const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
let selectedCards = [];
let sessionId = new URLSearchParams(window.location.search).get('session') || 'default';

function updateGameState() {
  fetch(`/api/game?session=${sessionId}`)
    .then(response => response.json())
    .then(data => {
      console.log('Game state:', data);
      document.getElementById('discard').innerText = `Discard: ${data.discard}`;
      document.getElementById('status').innerText = data.status;
      document.getElementById('deck-size').innerText = `Deck: ${data.deckSize} cards`;
      document.getElementById('move-history').innerHTML = data.moveHistory.map(move => `<div>${move}</div>`).join('');

      const playerAHand = document.getElementById('player-a-hand');
      const playerBHand = document.getElementById('player-b-hand');
      playerAHand.innerHTML = '';
      playerBHand.innerHTML = '';

      data.playerAHand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.innerText = `${card.rank}${card.suit[0]}`;
        cardDiv.onclick = () => toggleCardSelection(card, cardDiv, 'A');
        playerAHand.appendChild(cardDiv);
      });

      data.playerBHand.forEach(card => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card';
        cardDiv.innerText = `${card.rank}${card.suit[0]}`;
        cardDiv.onclick = () => toggleCardSelection(card, cardDiv, 'B');
        playerBHand.appendChild(cardDiv);
      });

      document.getElementById('player-a-ruler').innerText = `Ruler: ${data.playerARuler}`;
      document.getElementById('player-b-ruler').innerText = `Ruler: ${data.playerBRuler}`;
      document.getElementById('turn').innerText = `Turn: Player ${data.turn}`;
      document.getElementById('play-button').disabled = !data.canPlay;
      document.getElementById('draw-button').disabled = data.deckSize === 0;

      if (data.fortActive) {
        document.getElementById('fort').innerText = `Fort Active: ${data.fortRank}`;
      } else {
        document.getElementById('fort').innerText = 'Fort: None';
      }

      if (data.pair5Pending) {
        document.getElementById('pair5-choice').style.display = 'block';
      } else {
        document.getElementById('pair5-choice').style.display = 'none';
      }

      if (data.pair6Pending) {
        document.getElementById('pair6-target').style.display = 'block';
      } else {
        document.getElementById('pair6-target').style.display = 'none';
      }

      if (data.pair7Pending) {
        document.getElementById('pair7-choice').style.display = 'block';
      } else {
        document.getElementById('pair7-choice').style.display = 'none';
      }
    });
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
  const cardCode = document.getElementById('card-code').value.toUpperCase();
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
document.getElementById('add-cards-button').onclick = addCards;
document.getElementById('pair5-submit').onclick = submitPair5Choice;
document.getElementById('pair6-submit').onclick = submitPair6Target;
document.getElementById('pair7-submit').onclick = submitPair7Choice;

updateGameState();
