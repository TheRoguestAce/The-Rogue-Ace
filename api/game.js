export default async function handler(req, res) {
  const { method, query } = req;

  // Constants
  const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const initialDeck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

  // Fresh state per request (no persistence yet)
  let gameState = {
    deck: shuffle([...initialDeck]),
    discardPile: [],
    players: [{ hand: [], ruler: null }, { hand: [], ruler: null }],
    currentPlayer: 0,
    message: 'Pick your ruler!',
    state: 'setup'
  };

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
      const extraAces = hand.filter(c => c.rank === 'A').slice(1);
      hand = hand.filter(c => c.rank !== 'A').concat(hand.filter(c => c.rank === 'A').slice(0, 1));
      gameState.deck.push(...extraAces);
      shuffle(gameState.deck);
      hand.push(gameState.deck.shift());
    }
    console.log('Dealt hand:', hand); // Debug
    return hand;
  }

  function isValidPlay(card, top) {
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);
    const parity = r => parseInt(r) || { A: 1, J: 11, Q: 12, K: 13 }[r];
    return isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || parity(card.rank) % 2 === parity(top.rank) % 2;
  }

  // Initialize on GET
  if (method === 'GET') {
    gameState.players[0].hand = dealHand();
    gameState.players[1].hand = dealHand();
    console.log('Player 0 hand:', gameState.players[0].hand); // Debug
    console.log('Player 1 hand:', gameState.players[1].hand); // Debug
  }

  // Handle actions on POST
  if (method === 'POST') {
    const { action } = query;
    if (gameState.state === 'setup') {
      const [rank, suitChar] = [action.slice(0, -1), action.slice(-1)];
      const suit = suits.find(s => s[0] === suitChar);
      if (!suit || !ranks.includes(rank)) {
        gameState.message = 'Invalid ruler! Try again (e.g., 5H).';
      } else {
        const card = { rank, suit };
        const idx = gameState.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
        if (idx >= 0) {
          gameState.players[0].ruler = gameState.players[0].hand.splice(idx, 1)[0];
          gameState.players[1].ruler = gameState.players[1].hand.splice(Math.floor(Math.random() * gameState.players[1].hand.length), 1)[0];
          gameState.discardPile.push(gameState.deck.shift());
          gameState.state = 'playing';
          gameState.message = 'Game started! Play a card.';
        } else {
          gameState.message = 'Card not in hand! Pick from your hand.';
        }
      }
      console.log('Post-ruler Player 0 hand:', gameState.players[0].hand); // Debug
    } else if (gameState.state === 'playing') {
      if (action === 'draw') {
        gameState.players[0].hand.push(...gameState.deck.splice(0, 2));
        gameState.currentPlayer = 1;
        aiTurn();
      } else {
        const [rank, suitChar] = [action.slice(0, -1), action.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        if (suit && ranks.includes(rank)) {
          const card = { rank, suit };
          const idx = gameState.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
          if (idx >= 0 && isValidPlay(card, gameState.discardPile[0])) {
            gameState.discardPile.unshift(gameState.players[0].hand.splice(idx, 1)[0]);
            gameState.currentPlayer = 1;
            aiTurn();
          } else {
            gameState.message = 'Invalid play!';
          }
        } else {
          gameState.message = 'Invalid card format!';
        }
      }
    }
  }

  function aiTurn() {
    const ai = gameState.players[1];
    const top = gameState.discardPile[0];
    const idx = ai.hand.findIndex(c => isValidPlay(c, top));
    if (idx >= 0) {
      gameState.discardPile.unshift(ai.hand.splice(idx, 1)[0]);
    } else {
      ai.hand.push(...gameState.deck.splice(0, 2));
    }
    gameState.currentPlayer = 0;
  }

  // Return state
  res.status(200).json({
    discard: gameState.discardPile[0] || { rank: 'N/A', suit: 'N/A' },
    playerHand: gameState.players[0].hand,
    aiHandCount: gameState.players[1].hand.length,
    playerRuler: gameState.players[0].ruler || { rank: 'N/A', suit: 'N/A' },
    aiRuler: gameState.players[1].ruler || { rank: 'N/A', suit: 'N/A' },
    message: gameState.message,
    gameState: gameState.state,
    gameOver: gameState.players[0].hand.length === 0 || gameState.players[1].hand.length === 0
  });
}
