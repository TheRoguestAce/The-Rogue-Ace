let selectedCards = [];
let currentPhase = 'setup';
let currentGameState = null;

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
  document.getElementById('status').textContent = game.status;
  document.getElementById('turn').textContent = game.turn + 1;
  document.getElementById('discard').textContent = game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None';
  document.getElementById('deckSize').textContent = game.deck.length;
  document.getElementById('wins').textContent = game.wins.map((w, i) => `Player ${i + 1}: ${w}`).join(', ');

  const playersDiv = document.getElementById('players');
  playersDiv.innerHTML = '';
  game.players.forEach((player, index) => {
    const playerDiv = document.createElement('div');
    playerDiv.innerHTML = `<strong>Player ${index + 1} Hand:</strong> ${
      player.hand.length ? player.hand.map(c => {
        const cardStr = `${c.rank}${c.suit[0]}`;
        const isPair = selectedCards.length === 2 && selectedCards.includes(cardStr) && selectedCards.filter(sc => sc === cardStr).length === 2;
        const isToaK = selectedCards.length === 3 && selectedCards.every(sc => sc[0] === cardStr[0]);
        const isFoAK = selectedCards.length === 4 && selectedCards.every(sc => sc[0] === cardStr[0]);
        return `<span class="card" onclick="selectCard('${cardStr}', ${index}, ${isPair}, ${isToaK}, ${isFoAK})">${cardStr}</span>`;
      }).join(', ') : 'Empty'
    }<br><strong>Ruler:</strong> ${player.ruler ? `<span class="card" onclick="selectRuler('${player.ruler.rank}${player.ruler.suit[0]}')">${player.ruler.rank}${player.ruler.suit[0]}</span>` : 'None'}`;
    playersDiv.appendChild(playerDiv);
  });

  const abilitiesDiv = document.getElementById('abilities');
  if (selectedCards.length > 0) {
    abilitiesDiv.style.display = 'block';
    const abilityText = document.getElementById('abilityText');
    const rank = selectedCards[0][0] === '1' ? selectedCards[0].slice(0, 2) : selectedCards[0][0];
    const suit = selectedCards.length === 1 && game.phase === 'setup' ? selectedCards[0].slice(selectedCards[0].length - 1) : null;
    if (selectedCards.length === 1 && game.phase === 'setup' && suit) {
      const suitAbility = rulerAbilities.suits[suits.find(s => s[0] === suit.toUpperCase())] || '';
      const rankAbility = rulerAbilities.ranks[rank] || '';
      const aceAbility = rank === 'A' ? rulerAbilities.aces[`A-${suits.find(s => s[0] === suit.toUpperCase())}`] || '' : '';
      abilityText.textContent = `Ruler Abilities: ${suitAbility} ${rankAbility} ${aceAbility}`.trim();
    } else if (selectedCards.length === 2 && selectedCards[0][0] === selectedCards[1][0]) {
      abilityText.textContent = `Pair Ability: ${rulerAbilities.pairs[rank] || 'No special ability'}`;
    } else if (selectedCards.length === 3 && selectedCards.every(sc => sc[0] === selectedCards[0][0])) {
      abilityText.textContent = `ToaK Ability: ${rank === 'A' ? 'Draw 8 for opponents' : rulerAbilities.foaks[rank] || 'No special ability'}`;
    } else if (selectedCards.length === 4 && selectedCards.every(sc => sc[0] === selectedCards[0][0])) {
      abilityText.textContent = `FoAK Ability: ${rulerAbilities.foaks[rank] || 'No special ability'}`;
    } else {
      abilitiesDiv.style.display = 'none';
    }
  } else {
    abilitiesDiv.style.display = 'none';
  }

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
  if (game.pair5Pending && game.turn === 0) { // Only Player 1 interacts
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

  const pair6Choices = document.getElementById('pair6Choices');
  const pair6TargetOptions = document.getElementById('pair6TargetOptions');
  if (game.pair6Pending && game.turn === 0) { // Only Player 1 interacts
    pair6Choices.style.display = 'block';
    pair6TargetOptions.innerHTML = '';
    game.opponents.forEach(idx => {
      const span = document.createElement('span');
      span.className = 'card';
      span.textContent = `Player ${idx + 1}`;
      span.onclick = () => selectPair6Target(idx);
      pair6TargetOptions.appendChild(span);
      pair6TargetOptions.appendChild(document.createTextNode(', '));
    });
  } else {
    pair6Choices.style.display = 'none';
  }

  const pair7Choices = document.getElementById('pair7Choices');
  const pair7DeckOptions = document.getElementById('pair7DeckOptions');
  const pair7HandOptions = document.getElementById('pair7HandOptions');
  const pair7HandCards = document.getElementById('pair7HandCards');
  if (game.pair7Pending && game.turn === 0) { // Only Player 1 interacts
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

  document.querySelectorAll('.card').forEach(span => {
    if (selectedCards.includes(span.textContent)) {
      span.style.backgroundColor = '#ddd';
    } else {
      span.style.backgroundColor = '';
    }
  });

  document.getElementById('moveInput').value = selectedCards.join(',');
}

function selectCard(card, playerIndex, isPair, isToaK, isFoAK) {
  if (playerIndex !== 0) return; // Only Player 1 can interact

  const index = selectedCards.indexOf(card);
  if (index === -1) {
    selectedCards.push(card);
  } else {
    selectedCards.splice(index, 1);
  }

  if (isPair || isToaK || isFoAK) {
    selectedCards = selectedCards.filter(c => c[0] === card[0]); // Keep only cards of the same rank
  }

  document.querySelectorAll('.card').forEach(span => {
    if (selectedCards.includes(span.textContent)) {
      span.style.backgroundColor = '#ddd';
    } else {
      span.style.backgroundColor = '';
    }
  });

  document.getElementById('moveInput').value = selectedCards.join(',');
  updateUI(currentGameState); // Re-render to update abilities
}

function selectRuler(card) {
  if (currentGameState.phase === 'setup' && currentGameState.turn === 0) { // Only Player 1 in setup
    selectedCards = [card];
    document.getElementById('moveInput').value = card;
    updateUI(currentGameState); // Re-render to update abilities
  }
}

async function makeMove() {
  const move = document.getElementById('moveInput').value;
  if (!move) return;

  await fetch(`/api/game?move=${move}`, { method: 'POST' });
  selectedCards = [];
  document.getElementById('moveInput').value = '';
  await fetchGameState();
}

async function drawCard() {
  await fetch('/api/game?move=draw', { method: 'POST' });
  selectedCards = [];
  document.getElementById('moveInput').value = '';
  await fetchGameState();
}

async function resetGame() {
  await fetch('/api/game?reset=true', { method: 'POST' });
  selectedCards = [];
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

async function selectPair6Target(target) {
  await fetch(`/api/game?pair6Target=${target}`, { method: 'POST' });
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

const rulerAbilities = {
  suits: {
    Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
    Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
    Spades: 'Sliced: Spades count as half their rank rounded down (pairs OK)',
    Clubs: 'Strike: Play two valid cards as a pair if 5+ cards in hand (3+ remain)'
  },
  ranks: {
    2: 'Twice the Might: Pairs make all opponents draw 2 extra cards',
    3: 'Lucky Clover: Play a 7 anytime, all opponents draw 2',
    4: 'Fourfold: Four of a kind reshuffles all cards, opponents draw 7, player draws 3',
    5: 'High Five: Face cards count as 5 (pairs OK)',
    6: 'Nightmare: Playing a 6 makes all opponents draw to 7 cards',
    7: 'Lucky Spin: Play a 3 anytime, all opponents draw 2',
    8: 'Seeing Red: If any opponent has ≤3 cards, 8 makes them draw 2',
    9: 'Reverse Nightmare: Any opponent’s 9s make you discard to 5 cards',
    10: 'Perfection: Play multiple even cards on an even card (no pairs)',
    J: 'Servant: J/Q/K/A count as each other (pairs OK)',
    Q: 'Ruler’s Touch: Kings are wild, opponents draw 1 (pairs OK)',
    K: 'Ruler of Rulers: Gain all other rulers’ abilities, win again if you win'
  },
  aces: {
    'A-Diamonds': 'Perfect Card: Odd non-face cards playable anytime (no pairs)',
    'A-Hearts': 'Otherworldly Touch: Hearts are wild (no pairs)',
    'A-Spades': 'Pocket Knife: All cards count as half rank rounded down (pairs OK)',
    'A-Clubs': 'Nuclear Bomb: On first win, reshuffle, opponents draw 7, winner draws 5'
  },
  pairs: {
    A: 'Pocket Aces: Opponents must play 10+ until your next play',
    2: 'Pair Pair: Opponents draw 3 instead of 2',
    3: 'Feeling Off: Opponents must play odd numbers until your next play',
    4: 'Half the Cards: Opponents cannot play 8+ until your next play',
    5: 'Medium Rare: Look through the top 5 cards of the discard pile and take one card from it',
    6: 'Devilish Stare: Pick one opponent to skip their next turn',
    7: 'Double Luck: Look at the next two cards in the deck. You can choose to replace one of your cards with one of those cards. Then, put the other cards on the top of the deck and shuffle the deck',
    8: 'Good Fortune: Put any one of your other cards onto the top of the discard pile. The next player will have to follow that card',
    9: 'Fort: Only pairs or better can play until destroyed, opponents draw 1 if no pair',
    10: 'Feeling Right: Opponents must play even numbers until your next play',
    J: 'High Card: Opponents must play 8+ until your next play',
    Q: 'Complaint: Opponents draw 1, you discard 1 and shuffle',
    K: 'I am your Father: Opponents alternate even/odd until your next play'
  },
  foaks: {
    A: 'Pure Destruction: Put 4 of your cards into the deck and shuffle it',
    2: 'Two’s Domain: Until you play again, everyone else has to play even numbers that are the suit of the number on top of the discard pile. If they do not have that kind of card, they have to draw 3 cards instead of 2',
    3: 'Feeling More Off: Until you play again, everyone else has to play odd numbers that are the suit of the number on top of the discard pile. If they do not have that kind of card, they have to draw 3 cards instead of 2',
    4: 'Four Fours: Everyone has to draw 5 cards instead of 4',
    5: 'A Bit Above: Until you play again, everyone else has to play numbers above 5 that are the suit of the number on top of the discard pile. If they do not have that kind of card, they have to draw 3 cards instead of 2',
    6: 'Satanic Bomb: Discard all of your cards except one',
    7: 'Crazy Luck: Look at all of the cards in the deck and trade any of your cards for any cards in the deck. After that put every card in the discard pile and the deck together, shuffle it and put the card on the top of the deck as the new discard pile',
    8: 'Crazy Fortune: Same effects as Crazy Luck',
    9: 'Feeling Weird: Until you play again, everyone else has to play perfect squares',
    10: 'Ultimate Perfection: Same effects as Feeling Weird',
    J: 'Master Servant: Until you play again, everyone has to play a queen or a king or else they have to draw 3 cards instead of 2',
    Q: 'Second to One: Until you play again, everyone has to play a king. If they don’t play a king, they don’t draw cards but you get to put one card back into the deck and shuffle the deck',
    K: 'King of All: Creates a fort that can only be destroyed by a three of a kind ace'
  }
};

// Initial fetch
fetchGameState();
