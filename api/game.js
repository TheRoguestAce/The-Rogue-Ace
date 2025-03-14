const gameStates = {};

export default async function handler(req, res) {
  const { method, query } = req;
  const sessionId = query.session || 'default';

  const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

  let game = gameStates[sessionId] || {
    deck: shuffle([...deck]),
    discard: null,
    players: [
      { hand: [], ruler: null },
      { hand: [], ruler: null }
    ],
    turn: 0,
    phase: 'setup',
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

  function isValidPlay(cards, top) {
    if (cards.length === 0) return false;
    if (cards.length > 1) return false; // Pairs later
    const card = cards[0];
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);
    const value = r => parseInt(r) || { A: 1, J: 11, Q: 12, K: 13 }[r];
    return isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || value(card.rank) % 2 === value(top.rank) % 2;
  }

  if (method === 'GET' && !gameStates[sessionId]) {
    game.players[0].hand = dealHand();
    game.players[1].hand = dealHand();
    console.log('Player hand:', game.players[0].hand);
  }

  if (method === 'POST') {
    const { move, reset } = query;
    if (reset === 'true') {
      game = {
        deck: shuffle([...deck]),
        discard: null,
        players: [
          { hand: dealHand(), ruler: null },
          { hand: dealHand(), ruler: null }
        ],
        turn: 0,
        phase: 'setup',
        status: 'Pick your ruler!'
      };
    } else if (move === 'draw') {
      if (game.phase === 'play') {
        game.players[0].hand.push(...game.deck.splice(0, 2));
        game.turn = 1;
        aiMove();
      }
    } else if (move) {
      const cardStrings = move.split(',');
      const cards = cardStrings.map(cs => {
        const [rank, suitChar] = [cs.slice(0, -1), cs.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        return suit && ranks.includes(rank) ? { rank, suit } : null;
      }).filter(c => c);

      if (cards.length === 0) {
        game.status = 'Invalid selection!';
      } else if (game.phase === 'setup') {
        if (cards.length !== 1) {
          game.status = 'Pick one ruler!';
        } else {
          const idx = game.players[0].hand.findIndex(c => c.rank === cards[0].rank && c.suit === cards[0].suit);
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
      } else if (game.phase === 'play') {
        const indices = cards.map(card => game.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit));
        if (indices.some(i => i === -1) || !isValidPlay(cards, game.discard)) {
          game.status = 'Invalid play!';
        } else {
          indices.sort((a, b) => b - a).forEach(i => game.players[0].hand.splice(i, 1));
          game.discard = cards[0];
          game.turn = 1;
          aiMove();
        }
      }
      console.log('After move:', game.players[0].hand);
    }
  }

  function aiMove() {
    const ai = game.players[1];
    const idx = ai.hand.findIndex(c => isValidPlay([c], game.discard));
    if (idx !== -1) {
      game.discard = ai.hand.splice(idx, 1)[0];
      game.status = `AI played ${game.discard.rank}${game.discard.suit[0]}. Your turn!`;
    } else {
      ai.hand.push(...game.deck.splice(0, 2));
      game.status = 'AI drew 2. Your turn!';
    }
    game.turn = 0;
  }

  // Check winning
  const winner = game.players[0].hand.length === 0 ? 'player' : game.players[1].hand.length === 0 ? 'ai' : null;
  if (winner) {
    game.status = `${winner === 'player' ? 'You' : 'AI'} won! Reset to play again.`;
  }

  gameStates[sessionId] = game;

  res.status(200).json({
    discard: game.discard || { rank: 'None', suit: 'None' },
    playerHand: game.players[0].hand,
    aiHandSize: game.players[1].hand.length,
    playerRuler: game.players[0].ruler || { rank: 'None', suit: 'None' },
    aiRuler: game.players[1].ruler || { rank: 'None', suit: 'None' },
    status: game.status,
    phase: game.phase,
    session: sessionId,
    winner
  });
}
