export default async function handler(req, res) {
  const { method, query } = req;

  // Constants
  const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

  // Initial state
  let game = {
    deck: shuffle([...deck]),
    discard: null,
    players: [
      { hand: [], ruler: null },
      { hand: [], ruler: null }
    ],
    turn: 0, // 0 = player, 1 = AI
    phase: 'setup', // 'setup' or 'play'
    status: 'Pick your ruler!'
  };

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function dealHand() {
    let hand = game.deck.splice(0, 8);
    while (hand.filter(c => c.rank === 'A').length > 1) {
      const extraAces = hand.filter(c => c.rank === 'A').slice(1);
      hand = hand.filter(c => c.rank !== 'A').concat(hand.filter(c => c.rank === 'A')[0]);
      game.deck.push(...extraAces);
      shuffle(game.deck);
      hand.push(game.deck.shift());
    }
    return hand;
  }

  function isValidPlay(card, top) {
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);
    const value = r => parseInt(r) || { A: 1, J: 11, Q: 12, K: 13 }[r];
    return isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || value(card.rank) % 2 === value(top.rank) % 2;
  }

  // Initialize
  if (method === 'GET') {
    game.players[0].hand = dealHand();
    game.players[1].hand = dealHand();
    console.log('Player hand:', game.players[0].hand);
  }

  // Actions
  if (method === 'POST') {
    const { move } = query;
    if (game.phase === 'setup') {
      const [rank, suitChar] = [move.slice(0, -1), move.slice(-1)];
      const suit = suits.find(s => s[0] === suitChar);
      if (!suit || !ranks.includes(rank)) {
        game.status = 'Invalid ruler! Use format like 5H.';
      } else {
        const card = { rank, suit };
        const idx = game.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
        if (idx === -1) {
          game.status = 'Ruler not in hand!';
        } else {
          game.players[0].ruler = game.players[0].hand.splice(idx, 1)[0];
          game.players[1].ruler = game.players[1].hand.splice(Math.floor(Math.random() * game.players[1].hand.length), 1)[0];
          game.discard = game.deck.shift();
          game.phase = 'play';
          game.status = 'Play a card!';
        }
      }
      console.log('After ruler pick:', game.players[0].hand);
    } else if (game.phase === 'play') {
      if (move === 'draw') {
        game.players[0].hand.push(...game.deck.splice(0, 2));
        game.turn = 1;
        aiMove();
      } else {
        const [rank, suitChar] = [move.slice(0, -1), move.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        if (!suit || !ranks.includes(rank)) {
          game.status = 'Invalid card! Use format like 5H.';
        } else {
          const card = { rank, suit };
          const idx = game.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit);
          if (idx === -1 || !isValidPlay(card, game.discard)) {
            game.status = 'Invalid play!';
          } else {
            game.discard = game.players[0].hand.splice(idx, 1)[0];
            game.turn = 1;
            aiMove();
          }
        }
      }
    }
  }

  function aiMove() {
    const ai = game.players[1];
    const idx = ai.hand.findIndex(c => isValidPlay(c, game.discard));
    if (idx !== -1) {
      game.discard = ai.hand.splice(idx, 1)[0];
      game.status = 'AI played. Your turn!';
    } else {
      ai.hand.push(...game.deck.splice(0, 2));
      game.status = 'AI drew 2. Your turn!';
    }
    game.turn = 0;
  }

  // Response
  res.status(200).json({
    discard: game.discard || { rank: 'N/A', suit: 'N/A' },
    playerHand: game.players[0].hand,
    aiHandSize: game.players[1].hand.length,
    playerRuler: game.players[0].ruler || { rank: 'N/A', suit: 'N/A' },
    aiRuler: game.players[1].ruler || { rank: 'N/A', suit: 'N/A' },
    status: game.status,
    phase: game.phase
  });
}
