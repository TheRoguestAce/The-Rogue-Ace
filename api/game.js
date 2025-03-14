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
    status: 'Pick your ruler!',
    moveHistory: [] // Track last two moves
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
    if (game.phase === 'play' && !top) return false;

    const rankValue = r => {
      const map = { A: 1, J: 11, Q: 12, K: 13 };
      return map[r] || parseInt(r);
    };

    if (cards.length === 1) {
      const card = cards[0];
      const isRed = s => ['Diamonds', 'Hearts'].includes(s);
      const value = rankValue(card.rank);
      const topValue = rankValue(top.rank);
      return isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || value % 2 === topValue % 2;
    }

    if (cards.length >= 2 && cards.length <= 4) {
      const allSameRank = cards.every(c => c.rank === cards[0].rank);
      return allSameRank;
    }

    if (cards.length === 5) {
      const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
      const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || 
                        (values.join(',') === '1,10,11,12,13');
      const isFlush = cards.every(c => c.suit === cards[0].suit);
      return isStraight || isFlush;
    }

    return false;
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
        status: 'Pick your ruler!',
        moveHistory: []
      };
    } else if (move === 'draw') {
      game.players[0].hand.push(...game.deck.splice(0, 2));
      game.turn = 1;
      aiMove();
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
            game.moveHistory = [`You set ruler ${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}`];
          }
        }
      } else if (game.phase === 'play') {
        const indices = cards.map(card => game.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit));
        if (indices.some(i => i === -1) || !isValidPlay(cards, game.discard)) {
          game.status = 'Invalid play!';
        } else {
          indices.sort((a, b) => b - a).forEach(i => game.players[0].hand.splice(i, 1));
          game.discard = cards[0];
          game.status = 'AI\'s turn!';
          game.moveHistory.unshift(`You played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
          if (game.moveHistory.length > 2) game.moveHistory.pop();
          game.turn = 1;
          aiMove();
        }
      }
      console.log('After move:', game.players[0].hand);
    }

    if (game.players[0].hand.length === 0) {
      game.status = 'You win!';
      game.phase = 'over';
    } else if (game.players[1].hand.length === 0) {
      game.status = 'AI wins!';
      game.phase = 'over';
    }
  }

  function aiMove() {
    const ai = game.players[1];
    const idx = ai.hand.findIndex(c => isValidPlay([c], game.discard));
    if (idx !== -1) {
      game.discard = ai.hand.splice(idx, 1)[0];
      game.status = 'Your turn!';
      game.moveHistory.unshift(`AI played ${game.discard.rank}${game.discard.suit[0]}`);
      if (game.moveHistory.length > 2) game.moveHistory.pop();
    } else {
      ai.hand.push(...game.deck.splice(0, 2));
      game.status = 'AI drew 2. Your turn!';
      game.moveHistory.unshift('AI drew 2');
      if (game.moveHistory.length > 2) game.moveHistory.pop();
    }
    game.turn = 0;

    if (ai.hand.length === 0) {
      game.status = 'AI wins!';
      game.phase = 'over';
    }
  }

  gameStates[sessionId] = game;

  res.status(200).json({
    discard: game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None',
    playerHand: game.players[0].hand,
    aiHandSize: game.players[1].hand.length,
    playerRuler: game.players[0].ruler ? `${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}` : 'None',
    aiRuler: game.players[1].ruler ? `${game.players[1].ruler.rank}${game.players[1].ruler.suit[0]}` : 'None',
    status: game.status,
    phase: game.phase,
    session: sessionId,
    moveHistory: game.moveHistory
  });
}
