const suits = ['D', 'H', 'S', 'C'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const deck = suits.flatMap(suit => ranks.map(rank => `${rank}${suit}`));
const gameStates = {};

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function dealHand(deck, count) {
  return deck.splice(0, count);
}

function isValidPlay(cards, discard, ruler) {
  if (!cards.length) return false;
  const ranks = cards.map(c => c.slice(0, -1));
  const isPair = cards.length === 2 && ranks[0] === ranks[1];
  const isToaK = cards.length === 3 && ranks.every(r => r === ranks[0]);
  const rulerRank = ruler?.slice(0, -1);

  if (cards.length === 1) {
    const cardRank = ranks[0];
    if (rulerRank === '3' && cardRank === '7') return true; // Ruler 3 special case
    if (!discard) return true; // First play
    return cardRank === discard.slice(0, -1); // Must match discard rank
  }
  if (isPair || isToaK) return true; // Pairs and ToaK are always valid
  return false;
}

module.exports = (req, res) => {
  const { method, query, body } = req;
  const sessionId = query.session || 'default';
  let game = gameStates[sessionId];

  if (method === 'GET' || (method === 'POST' && query.reset === 'true')) {
    game = {
      deck: shuffle([...deck]),
      discard: null,
      players: [
        { hand: dealHand(shuffle([...deck]), 5), ruler: null },
        { hand: dealHand(shuffle([...deck]), 5), ruler: null }
      ],
      turn: 0,
      currentPlayer: 0,
      status: 'Pick your ruler!',
      canPlay: true,
      moveHistory: []
    };
    game.discard = game.deck.shift();
    gameStates[sessionId] = game;
  }

  if (method === 'POST' && !query.reset) {
    const { move } = body;
    if (!game) return res.status(400).json({ error: 'Game not initialized' });

    if (move === 'draw') {
      if (game.deck.length) {
        game.players[game.turn].hand.push(game.deck.shift());
        game.moveHistory.unshift(`Player ${game.turn + 1} drew a card`);
        game.turn = (game.turn + 1) % 2;
        game.currentPlayer = game.turn;
        game.status = `Player ${game.turn + 1}'s turn`;
      }
    } else if (Array.isArray(move)) {
      const playerHand = game.players[game.turn].hand;
      const validMove = move.every(card => playerHand.includes(card));

      if (!validMove) {
        return res.json({ error: 'Invalid move: Cards not in hand' });
      }

      if (!game.players[game.turn].ruler) {
        if (move.length === 1) {
          game.players[game.turn].ruler = move[0];
          game.players[game.turn].hand = playerHand.filter(c => c !== move[0]);
          game.moveHistory.unshift(`Player ${game.turn + 1} set ruler ${move[0]}`);
          game.turn = (game.turn + 1) % 2;
          game.currentPlayer = game.turn;
          game.status = game.players[game.turn].ruler ? `Player ${game.turn + 1}'s turn` : `Player ${game.turn + 1}: Pick your ruler!`;
        } else {
          return res.json({ error: 'Select one card as ruler' });
        }
      } else if (isValidPlay(move, game.discard, game.players[game.turn].ruler)) {
        move.forEach(card => {
          game.players[game.turn].hand = playerHand.filter(c => c !== card);
        });
        game.discard = move[0];
        game.turn = (game.turn + 1) % 2;
        game.currentPlayer = game.turn;
        game.status = `Player ${game.turn + 1}'s turn`;

        if (game.players[game.turn === 0 ? 1 : 0].hand.length === 0) {
          game.status = `Player ${game.turn === 0 ? 2 : 1} wins! Reset to play again.`;
          game.canPlay = false;
        }
      } else {
        return res.json({ error: 'Invalid play: Must match discard rank, be a pair, or ToaK' });
      }
    }
    gameStates[sessionId] = game;
  }

  res.json({
    deck: game.deck,
    discard: game.discard,
    players: game.players,
    turn: game.turn,
    currentPlayer: game.currentPlayer,
    status: game.status,
    canPlay: game.canPlay,
    moveHistory: game.moveHistory
  });
};
