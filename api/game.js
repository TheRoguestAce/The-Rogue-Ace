// Vercel serverless function
export default function handler(req, res) {
  const { method, query } = req;

  // Game state (in-memory for now, per session—later use a DB)
  let gameState = req.session?.gameState || {
    deck: shuffle([...suits.flatMap(suit => ranks.map(rank => ({ suit, rank })))]),
    discardPile: [],
    players: [{ hand: [], ruler: null }, { hand: [], ruler: null }],
    currentPlayer: 0,
    message: ''
  };

  const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function dealHand() {
    let hand = gameState.deck.splice(0, 8);
    while (hand.filter(c => c.rank === 'A').length > 1) {
      hand = hand.filter(c => c.rank !== 'A').concat(hand.filter(c => c.rank === 'A').slice(0, 1));
      hand.push(gameState.deck.shift());
      shuffle(gameState.deck);
    }
    return hand;
  }

  function isValidPlay(card, top) {
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);
    const parity = r => parseInt(r) || { A: 1, J: 11, Q: 12, K: 13 }[r];
    return isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || parity(card.rank) % 2 === parity(top.rank) % 2;
  }

  function applyRulerEffects(player, card) {
    const opponent = gameState.players[1 - gameState.currentPlayer];
    if (player.ruler.suit === 'Diamonds' && card.suit === 'Diamonds') {
      gameState.message = 'Diamond Storm! Play again.';
      return false; // Don’t switch turns
    }
    if (player.ruler.rank === '6' && opponent.hand.length < 7) {
      opponent.hand.push(...gameState.deck.splice(0, 7 - opponent.hand.length));
      gameState.message = 'Nightmare! Opponent draws to 7.';
    }
    return true;
  }

  // API Endpoints
  switch (method) {
    case 'GET': // Start or get state
      if (gameState.discardPile.length === 0) {
        gameState.players[0].hand = dealHand();
        gameState.players[1].hand = dealHand();
        gameState.players[0].ruler = gameState.players[0].hand.shift();
        gameState.players[1].ruler = gameState.players[1].hand.shift();
        gameState.discardPile.push(gameState.deck.shift());
      }
      break;

    case 'POST': // Play or draw
      const { action } = query;
      if (action === 'draw') {
        gameState.players[0].hand.push(...gameState.deck.splice(0, 2));
        gameState.currentPlayer = 1;
        aiTurn();
      } else {
        const [rank, suitChar] = [action.slice(0, -1), action.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        const card = { rank, suit };
        const idx = gameState.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
        if (idx >= 0 && isValidPlay(card, gameState.discardPile[0])) {
          gameState.discardPile.unshift(gameState.players[0].hand.splice(idx, 1)[0]);
          if (applyRulerEffects(gameState.players[0], card)) {
            gameState.currentPlayer = 1;
            aiTurn();
          }
        } else {
          gameState.message = 'Invalid play!';
        }
      }
      break;
  }

  function aiTurn() {
    const ai = gameState.players[1];
    const top = gameState.discardPile[0];
    const idx = ai.hand.findIndex(c => isValidPlay(c, top));
    if (idx >= 0) {
      gameState.discardPile.unshift(ai.hand.splice(idx, 1)[0]);
      applyRulerEffects(ai, gameState.discardPile[0]);
    } else {
      ai.hand.push(...gameState.deck.splice(0, 2));
    }
    gameState.currentPlayer = 0;
  }

  // Simulate session persistence (Vercel doesn’t natively support this in free tier)
  req.session = { gameState }; // For now, resets per request—later use a DB

  res.status(200).json({
    discard: gameState.discardPile[0],
    playerHand: gameState.players[0].hand,
    aiHandCount: gameState.players[1].hand.length,
    playerRuler: gameState.players[0].ruler,
    aiRuler: gameState.players[1].ruler,
    message: gameState.message,
    gameOver: gameState.players[0].hand.length === 0 || gameState.players[1].hand.length === 0
  });
}
