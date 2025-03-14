const gameStates = {};

async function handler(req, res) {
  const { method, query } = req;
  const sessionId = query.session || 'default';
  console.log(`[${method}] Session: ${sessionId}`);

  const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

  let game = gameStates[sessionId];
  if (!game) {
    console.log(`New session ${sessionId} - Initializing`);
    game = {
      deck: shuffle([...deck]),
      discard: null,
      players: [
        { hand: [], ruler: null },
        { hand: [], ruler: null }
      ],
      turn: 0,
      phase: 'setup',
      status: 'Pick your ruler!',
      moveHistory: [],
      lastPlayCount: 1,
      lastPlayType: 'single',
      skipAITurn: false,
      firstWin: false,
      canPlay: true
    };
    gameStates[sessionId] = game;
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function dealHand(count) {
    let hand = game.deck.splice(0, count);
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
    const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r));
    const isEven = r => rankValue(r) % 2 === 0;
    const playerRuler = game.players[0].ruler;
    const rulerRank = playerRuler ? playerRuler.rank : null;
    const rulerSuit = playerRuler ? playerRuler.suit : null;
    const opponentRuler = game.players[1].ruler;
    const opponentRank = opponentRuler ? opponentRuler.rank : null;
    const opponentSuit = opponentRuler ? opponentRuler.suit : null;

    if (!top && game.phase === 'play') {
      if (rulerRank === 'A' && rulerSuit === 'Diamonds' && cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0)) return true;
      if (rulerRank === '3' && cards.length === 1 && cards[0].rank === '7') return true;
      if (rulerRank === '7' && cards.length === 1 && cards[0].rank === '3') return true;
      if (rulerRank === '10' && cards.every(c => isEven(c.rank))) return true;
      if (cards.length >= 2 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank)) return true;
      if (rulerRank === 'K') {
        if (opponentRank === 'A' && opponentSuit === 'Diamonds' && cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0)) return true;
        if (opponentRank === '3' && cards.length === 1 && cards[0].rank === '7') return true;
        if (opponentRank === '7' && cards.length === 1 && cards[0].rank === '3') return true;
        if (opponentRank === '10' && cards.every(c => isEven(c.rank))) return true;
      }
      return false;
    }

    const topValue = top ? rankValue(top.rank) : 0;
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);

    if (cards.length === 1) {
      const card = cards[0];
      const value = rankValue(card.rank);
      const slicedValue = card.suit === 'Spades' && (rulerSuit === 'Spades' || (rulerRank === 'K' && opponentSuit === 'Spades')) && rulerRank !== 'A' ? Math.ceil(value / 2) - 1 : null;
      let matches = isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || value % 2 === topValue % 2;

      if (rulerRank === 'A' && rulerSuit === 'Diamonds' && !['J', 'Q', 'K'].includes(card.rank) && value % 2 !== 0) matches = true;
      if ((rulerRank === 'A' && rulerSuit === 'Hearts') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Hearts') && card.suit === 'Hearts') matches = true;
      if (rulerRank === 'A' && rulerSuit === 'Spades') matches = Math.floor(value / 2) === topValue;
      if (rulerRank === 'A' && rulerSuit === 'Clubs') matches = Math.floor(value / 2) === topValue;
      if (rulerRank === '5' && ['J', 'Q', 'K'].includes(card.rank)) matches = topValue === 5;
      if (rulerRank === '10' && isEven(card.rank) && isEven(top.rank)) matches = true;
      if (rulerRank === 'J' && ['J', 'Q', 'K', 'A'].includes(card.rank)) matches = ['J', 'Q', 'K', 'A'].includes(top.rank);
      if (rulerRank === 'Q' && card.rank === 'K') matches = true;
      if (rulerSuit === 'Hearts' && rulerRank !== 'A') matches = value === rankValue(rulerRank);
      if (rulerSuit === 'Spades' && rulerRank !== 'A' && card.suit === 'Spades') matches = matches || slicedValue === topValue;
      if (rulerRank === 'K') {
        if (opponentRank === 'A' && opponentSuit === 'Diamonds' && !['J', 'Q', 'K'].includes(card.rank) && value % 2 !== 0) matches = true;
        if (opponentRank === 'A' && opponentSuit === 'Hearts' && card.suit === 'Hearts') matches = true;
        if (opponentRank === 'A' && opponentSuit === 'Spades') matches = Math.floor(value / 2) === topValue;
        if (opponentRank === 'A' && opponentSuit === 'Clubs') matches = Math.floor(value / 2) === topValue;
        if (opponentRank === '5' && ['J', 'Q', 'K'].includes(card.rank)) matches = topValue === 5;
        if (opponentRank === '10' && isEven(card.rank) && isEven(top.rank)) matches = true;
        if (opponentRank === 'J' && ['J', 'Q', 'K', 'A'].includes(card.rank)) matches = ['J', 'Q', 'K', 'A'].includes(top.rank);
        if (opponentRank === 'Q' && card.rank === 'K') matches = true;
        if (opponentSuit === 'Hearts' && opponentRank !== 'A') matches = value === rankValue(opponentRank);
        if (opponentSuit === 'Spades' && opponentRank !== 'A' && card.suit === 'Spades') matches = matches || slicedValue === topValue;
      }
      return matches;
    }

    if (rulerRank === '10' && cards.every(c => isEven(c.rank)) && isEven(top.rank)) {
      return true;
    }
    if (rulerRank === 'K' && opponentRank === '10' && cards.every(c => isEven(c.rank)) && isEven(top.rank)) {
      return true;
    }

    if (cards.length === 2 && rulerSuit === 'Clubs' && rulerRank !== 'A' && game.players[0].hand.length >= 5) {
      return cards.every(c => isValidPlay([c], top));
    }
    if (rulerRank === 'K' && opponentSuit === 'Clubs' && opponentRank !== 'A' && cards.length === 2 && game.players[0].hand.length >= 5) {
      return cards.every(c => isValidPlay([c], top));
    }

    if (cards.length >= 2 && cards.length <= 4) {
      return cards.every(c => c.rank === cards[0].rank);
    }

    if (cards.length === 5) {
      const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
      const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || 
                        (values.join(',') === '1,10,11,12,13');
      const isFlush = cards.every(c => c.suit === cards[0].suit);
      const allEven = cards.every(c => isEven(c.rank));
      const allOdd = cards.every(c => !isEven(c.rank));
      return isStraight || isFlush || allEven || allOdd;
    }

    if (cards.length > 5) {
      const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
      const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1);
      const isFlush = cards.every(c => c.suit === cards[0].suit);
      return isStraight || isFlush;
    }

    if (rulerSuit === 'Diamonds' && rulerRank !== 'A' && cards.length === 2 && cards[0].suit === 'Diamonds') {
      return isValidPlay([cards[0]], top);
    }
    if (rulerRank === 'K' && opponentSuit === 'Diamonds' && opponentRank !== 'A' && cards.length === 2 && cards[0].suit === 'Diamonds') {
      return isValidPlay([cards[0]], top);
    }

    return false;
  }

  if (method === 'GET') {
    if (!game.players[0].hand || game.players[0].hand.length === 0) {
      console.log(`Dealing hands for ${sessionId}`);
      game.players[0].hand = dealHand(8);
      game.players[1].hand = dealHand(8);
      console.log(`Player hand:`, game.players[0].hand);
    }
    if (!game.discard && game.deck.length > 0) {
      game.discard = game.deck.shift();
      console.log(`Initial discard set: ${game.discard.rank}${game.discard.suit[0]}`);
    }
    game.canPlay = game.players[0].hand.some(card => isValidPlay([card], game.discard));
  }

  if (method === 'POST') {
    const { move, reset } = query;
    if (reset === 'true') {
      console.log(`Resetting ${sessionId}`);
      game = {
        deck: shuffle([...deck]),
        discard: game.deck.length > 0 ? game.deck.shift() : null,
        players: [
          { hand: dealHand(8), ruler: null },
          { hand: dealHand(8), ruler: null }
        ],
        turn: 0,
        phase: 'setup',
        status: 'Pick your ruler!',
        moveHistory: [],
        lastPlayCount: 1,
        lastPlayType: 'single',
        skipAITurn: false,
        firstWin: false,
        canPlay: true
      };
      console.log(`Reset discard: ${game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None'}`);
    } else if (move === 'draw') {
      game.players[0].hand.push(...game.deck.splice(0, 2));
      game.moveHistory.unshift(`The player drew 2`);
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
            game.discard = game.deck.length > 0 ? game.deck.shift() : null;
            game.phase = 'play';
            game.status = 'Play a card!';
            game.moveHistory = [`The player set ruler ${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}`];
            game.lastPlayCount = 1;
            game.lastPlayType = 'single';
          }
        }
      } else if (game.phase === 'play') {
        const indices = cards.map(card => game.players[0].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit));
        if (indices.some(i => i === -1) || !isValidPlay(cards, game.discard)) {
          game.status = 'Invalid play!';
        } else {
          indices.sort((a, b) => b - a).forEach(i => game.players[0].hand.splice(i, 1));
          game.discard = cards[0];
          const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r));
          const playerRuler = game.players[0].ruler;
          const rulerRank = playerRuler ? playerRuler.rank : null;
          const opponentRuler = game.players[1].ruler;
          const opponentRank = opponentRuler ? opponentRuler.rank : null;

          const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
          const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || 
                            (cards.length === 5 && values.join(',') === '1,10,11,12,13');
          const isFlush = cards.every(c => c.suit === cards[0].suit);
          const allEven = cards.every(c => rankValue(c.rank) % 2 === 0);
          const allOdd = cards.every(c => rankValue(c.rank) % 2 !== 0);
          game.lastPlayType = cards.length === 1 ? 'single' :
                             (cards.length === 2 && playerRuler && playerRuler.suit === 'Clubs' && playerRuler.rank !== 'A' ? '2 of a kind' :
                             (cards.length <= 4 && cards.every(c => c.rank === cards[0].rank) ? `${cards.length} of a kind` :
                             (rulerRank === '10' && allEven ? 'even stack' :
                             (isStraight ? 'straight' : isFlush ? 'flush' : allEven ? 'even only' : 'odd only'))));
          game.lastPlayCount = cards.length;

          if (rulerRank === '3' && cards[0].rank === '7') {
            game.players[1].hand.push(...game.deck.splice(0, 2));
            game.moveHistory.unshift('The opponent drew 2 (3 ruler)');
          }
          if (rulerRank === '4' && game.lastPlayType === '4 of a kind') {
            game.deck.push(...game.players[0].hand, ...game.players[1].hand);
            game.players[0].hand = [];
            game.players[1].hand = [];
            shuffle(game.deck);
            game.players[0].hand = dealHand(3);
            game.players[1].hand = dealHand(7);
            game.moveHistory.unshift('All cards reshuffled, the player drew 3, the opponent drew 7 (4 ruler)');
          }
          if (rulerRank === '6' && cards[0].rank === '6') {
            const draw = Math.max(0, 7 - game.players[1].hand.length);
            if (draw > 0) {
              game.players[1].hand.push(...game.deck.splice(0, draw));
              game.moveHistory.unshift(`The opponent drew ${draw} to 7 (6 ruler)`);
            }
          }
          if (rulerRank === '7' && cards[0].rank === '3') {
            game.players[1].hand.push(...game.deck.splice(0, 2));
            game.moveHistory.unshift('The opponent drew 2 (7 ruler)');
          }
          if (rulerRank === '8' && cards[0].rank === '8' && game.players[1].hand.length <= 3) {
            game.players[1].hand.push(...game.deck.splice(0, 2));
            game.moveHistory.unshift('The opponent drew 2 (8 ruler)');
          }
          if (rulerRank === 'Q' && cards[0].rank === 'K') {
            game.players[1].hand.push(...game.deck.splice(0, 1));
            game.moveHistory.unshift('The opponent drew 1 (Q ruler)');
          }
          if (rulerRank === 'K') {
            if (opponentRank === '3' && cards[0].rank === '7') {
              game.players[1].hand.push(...game.deck.splice(0, 2));
              game.moveHistory.unshift('The opponent drew 2 (K inherits 3 ruler)');
            }
            if (opponentRank === '4' && game.lastPlayType === '4 of a kind') {
              game.deck.push(...game.players[0].hand, ...game.players[1].hand);
              game.players[0].hand = [];
              game.players[1].hand = [];
              shuffle(game.deck);
              game.players[0].hand = dealHand(3);
              game.players[1].hand = dealHand(7);
              game.moveHistory.unshift('All cards reshuffled, the player drew 3, the opponent drew 7 (K inherits 4 ruler)');
            }
            if (opponentRank === '6' && cards[0].rank === '6') {
              const draw = Math.max(0, 7 - game.players[1].hand.length);
              if (draw > 0) {
                game.players[1].hand.push(...game.deck.splice(0, draw));
                game.moveHistory.unshift(`The opponent drew ${draw} to 7 (K inherits 6 ruler)`);
              }
            }
            if (opponentRank === '7' && cards[0].rank === '3') {
              game.players[1].hand.push(...game.deck.splice(0, 2));
              game.moveHistory.unshift('The opponent drew 2 (K inherits 7 ruler)');
            }
            if (opponentRank === '8' && cards[0].rank === '8' && game.players[1].hand.length <= 3) {
              game.players[1].hand.push(...game.deck.splice(0, 2));
              game.moveHistory.unshift('The opponent drew 2 (K inherits 8 ruler)');
            }
            if (opponentRank === 'Q' && cards[0].rank === 'K') {
              game.players[1].hand.push(...game.deck.splice(0, 1));
              game.moveHistory.unshift('The opponent drew 1 (K inherits Q ruler)');
            }
          }

          game.moveHistory.unshift(`The player played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
          if (game.moveHistory.length > 2) game.moveHistory.pop();

          if (game.players[0].hand.length === 0) {
            game.status = 'The player wins!';
            game.phase = 'over';
            if (playerRuler && playerRuler.rank === 'K') {
              game.deck = shuffle([...deck]);
              game.players[0].hand = dealHand(5);
              game.players[1].hand = dealHand(8);
              game.phase = 'play';
              game.status = 'Play a card! (K ruler replay)';
              game.moveHistory.unshift('The player drew 5 to replay (K ruler)');
            } else if (playerRuler && playerRuler.rank === 'A' && playerRuler.suit === 'Clubs' && !game.firstWin) {
              game.deck = shuffle([...deck]);
              game.players[0].hand = dealHand(5);
              game.players[1].hand = dealHand(7);
              game.phase = 'play';
              game.status = 'Play a card! (AC ruler reset)';
              game.moveHistory.unshift('Game reset, the player drew 5, the opponent drew 7 (AC ruler)');
              game.firstWin = true;
            }
          } else {
            game.status = 'Opponent\'s turn!';
            game.turn = 1;
            aiMove();
          }
        }
      }
      console.log('Post-move hand:', game.players[0].hand);
    }

    if (game.phase !== 'over' && game.players[1].hand.length === 0) {
      game.status = 'The opponent wins!';
      game.phase = 'over';
      if (game.players[1].ruler.rank === 'A' && game.players[1].ruler.suit === 'Clubs' && !game.firstWin) {
        game.deck = shuffle([...deck]);
        game.players[0].hand = dealHand(7);
        game.players[1].hand = dealHand(5);
        game.phase = 'play';
        game.status = 'Play a card! (AC ruler reset)';
        game.moveHistory.unshift('Game reset, the player drew 7, the opponent drew 5 (AC ruler)');
        game.firstWin = true;
      }
    }
    game.canPlay = game.players[0].hand.some(card => isValidPlay([card], game.discard));
  }

  function aiMove() {
    const ai = game.players[1];
    const playerRuler = game.players[0].ruler;
    console.log(`Opponent turn - Last play: ${game.lastPlayCount} (${game.lastPlayType}), Opponent hand size: ${ai.hand.length}`);

    if (game.skipAITurn) {
      game.skipAITurn = false;
      game.status = 'The player\'s turn!';
      game.turn = 0;
      console.log('Opponent turn skipped');
      return;
    }

    if (game.lastPlayCount > 1 && game.deck.length > 0) {
      let drawCount = game.lastPlayType === 'even only' || game.lastPlayType === 'odd only' ? 
                     Math.max(0, game.lastPlayCount - 3) : 
                     (game.lastPlayCount > 4 ? Math.max(0, game.lastPlayCount - 2) : game.lastPlayCount);
      if (playerRuler && playerRuler.rank === '2' && game.lastPlayType === '2 of a kind') drawCount *= 2;
      const actualDraw = Math.min(drawCount, game.deck.length);
      game.players[1].hand.push(...game.deck.splice(0, actualDraw));
      game.moveHistory.unshift(`The opponent drew ${actualDraw} (caused by ${game.lastPlayType})`);
      if (game.moveHistory.length > 2) game.moveHistory.pop();
      console.log(`Opponent drew ${actualDraw}, new hand:`, ai.hand);
    }

    if (game.players[1].ruler.rank === '9' && game.lastPlayCount === 1 && game.discard.rank === '9' && game.players[0].hand.length > 5) {
      const discardCount = game.players[0].hand.length - 5;
      game.deck.push(...game.players[0].hand.splice(0, discardCount));
      shuffle(game.deck);
      game.moveHistory.unshift(`The player discarded ${discardCount} to 5 (Opponent 9 ruler)`);
    }

    const idx = ai.hand.findIndex(c => isValidPlay([c], game.discard));
    if (idx !== -1) {
      game.discard = ai.hand.splice(idx, 1)[0];
      game.status = 'The player\'s turn!';
      game.moveHistory.unshift(`The opponent played ${game.discard.rank}${game.discard.suit[0]}`);
      if (game.moveHistory.length > 2) game.moveHistory.pop();
      game.lastPlayCount = 1;
      game.lastPlayType = 'single';

      const aiRuler = game.players[1].ruler;
      if (aiRuler.rank === '3' && game.discard.rank === '7') {
        game.players[0].hand.push(...game.deck.splice(0, 2));
        game.moveHistory.unshift('The player drew 2 (Opponent 3 ruler)');
      }
      if (aiRuler.rank === '4' && game.lastPlayType === '4 of a kind') {
        game.deck.push(...game.players[0].hand, ...game.players[1].hand);
        game.players[0].hand = [];
        game.players[1].hand = [];
        shuffle(game.deck);
        game.players[0].hand = dealHand(7);
        game.players[1].hand = dealHand(3);
        game.moveHistory.unshift('All cards reshuffled, the player drew 7, the opponent drew 3 (Opponent 4 ruler)');
      }
      if (aiRuler.rank === '6' && game.discard.rank === '6') {
        const draw = Math.max(0, 7 - game.players[0].hand.length);
        if (draw > 0) {
          game.players[0].hand.push(...game.deck.splice(0, draw));
          game.moveHistory.unshift(`The player drew ${draw} to 7 (Opponent 6 ruler)`);
        }
      }
      if (aiRuler.rank === '7' && game.discard.rank === '3') {
        game.players[0].hand.push(...game.deck.splice(0, 2));
        game.moveHistory.unshift('The player drew 2 (Opponent 7 ruler)');
      }
      if (aiRuler.rank === '8' && game.discard.rank === '8' && game.players[0].hand.length <= 3) {
        game.players[0].hand.push(...game.deck.splice(0, 2));
        game.moveHistory.unshift('The player drew 2 (Opponent 8 ruler)');
      }
      if (aiRuler.rank === 'Q' && game.discard.rank === 'K') {
        game.players[0].hand.push(...game.deck.splice(0, 1));
        game.moveHistory.unshift('The player drew 1 (Opponent Q ruler)');
      }
    } else if (game.deck.length > 0) {
      game.players[1].hand.push(...game.deck.splice(0, 2));
      game.status = 'The player\'s turn!';
      game.moveHistory.unshift('The opponent drew 2');
      if (game.moveHistory.length > 2) game.moveHistory.pop();
    } else {
      game.status = 'The opponent can\'t play or draw. The player\'s turn!';
    }

    game.turn = 0;
    if (ai.hand.length === 0) {
      game.status = 'The opponent wins!';
      game.phase = 'over';
      if (game.players[1].ruler.rank === 'A' && game.players[1].ruler.suit === 'Clubs' && !game.firstWin) {
        game.deck = shuffle([...deck]);
        game.players[0].hand = dealHand(7);
        game.players[1].hand = dealHand(5);
        game.phase = 'play';
        game.status = 'Play a card! (AC ruler reset)';
        game.moveHistory.unshift('Game reset, the player drew 7, the opponent drew 5 (AC ruler)');
        game.firstWin = true;
      }
    }
  }

  gameStates[sessionId] = game;

  const response = {
    discard: game.discard && game.discard.rank ? `${game.discard.rank}${game.discard.suit[0]}` : 'None',
    playerHand: game.players[0].hand || [],
    aiHandSize: game.players[1].hand.length || 0,
    playerRuler: game.players[0].ruler ? `${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}` : 'None',
    aiRuler: game.players[1].ruler ? `${game.players[1].ruler.rank}${game.players[1].ruler.suit[0]}` : 'None',
    status: game.status || 'Error',
    phase: game.phase,
    session: sessionId,
    moveHistory: game.moveHistory,
    canPlay: game.canPlay
  };
  console.log('Sending response:', JSON.stringify(response));
  res.status(200).json(response);
}

module.exports = handler;
