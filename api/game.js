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
      canPlay: true,
      pairEffect: null, // Tracks active pair effect
      pairEffectOwner: null, // 0 = player, 1 = AI
      fortActive: false, // For 9's Fort
      fortCard: null // Top card of fort
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
    const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
    const topValue = top ? rankValue(top.rank) : 0;
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);

    // Fort rules for 9
    if (game.fortActive && game.turn !== game.pairEffectOwner) {
      if (!isPair && cards.length < 2) return false; // Must play pair or better to destroy fort
    }

    // Pair effect restrictions
    if (game.pairEffect && game.turn !== game.pairEffectOwner) {
      const value = rankValue(cards[0].rank);
      if (game.pairEffect === 'A') return value >= 10;
      if (game.pairEffect === '3') return value % 2 !== 0;
      if (game.pairEffect === '4') return value < 8;
      if (game.pairEffect === '10') return value % 2 === 0;
      if (game.pairEffect === 'J') return value >= 8;
      if (game.pairEffect === 'K') {
        const lastWasEven = game.moveHistory.length > 0 && rankValue(game.discard.rank) % 2 === 0;
        return lastWasEven ? value % 2 !== 0 : value % 2 === 0;
      }
    }

    if (!top && game.phase === 'play') {
      if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Diamonds') && cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0)) return !isPair;
      if ((rulerRank === '3' || (rulerRank === 'K' && opponentRank === '3')) && cards.length === 1 && cards[0].rank === '7') return true;
      if ((rulerRank === '7' || (rulerRank === 'K' && opponentRank === '7')) && cards.length === 1 && cards[0].rank === '3') return true;
      if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && cards.length >= 2 && cards.every(c => isEven(c.rank))) return !isPair;
      if (cards.length >= 2 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank)) return true;
      return false;
    }

    if (cards.length === 1) {
      const card = cards[0];
      const value = rankValue(card.rank);
      const rulerValue = (rulerSuit === 'Hearts' || (rulerRank === 'K' && opponentSuit === 'Hearts')) && rulerRank !== 'A' ? rankValue(rulerRank === 'K' ? opponentRank : rulerRank) : null;
      const slicedValue = (rulerSuit === 'Spades' || (rulerRank === 'K' && opponentSuit === 'Spades')) && rulerRank !== 'A' && card.suit === 'Spades' ? Math.ceil(value / 2) - 1 : null;
      let matches = isRed(card.suit) === isRed(top.suit) || card.rank === top.rank || value % 2 === topValue % 2;

      if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Diamonds') && !['J', 'Q', 'K'].includes(card.rank) && value % 2 !== 0) matches = true;
      if (((rulerRank === 'A' && rulerSuit === 'Hearts') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Hearts')) && card.suit === 'Hearts') matches = true;
      if ((rulerRank === 'A' && rulerSuit === 'Spades') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Spades')) matches = matches || Math.floor(value / 2) === topValue;
      if (rulerRank === 'A' && rulerSuit === 'Clubs') matches = Math.floor(value / 2) === topValue;
      if ((rulerRank === '5' || (rulerRank === 'K' && opponentRank === '5')) && ['J', 'Q', 'K'].includes(card.rank)) matches = topValue === 5;
      if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && isEven(card.rank) && isEven(top.rank)) matches = true;
      if ((rulerRank === 'J' || (rulerRank === 'K' && opponentRank === 'J')) && ['J', 'Q', 'K', 'A'].includes(card.rank)) matches = ['J', 'Q', 'K', 'A'].includes(top.rank);
      if ((rulerRank === 'Q' || (rulerRank === 'K' && opponentRank === 'Q')) && card.rank === 'K') matches = true;
      if ((rulerSuit === 'Hearts' || (rulerRank === 'K' && opponentSuit === 'Hearts')) && rulerRank !== 'A') matches = matches || rulerValue === topValue || rulerValue % 2 === topValue % 2;
      if ((rulerSuit === 'Spades' || (rulerRank === 'K' && opponentSuit === 'Spades')) && rulerRank !== 'A' && card.suit === 'Spades') matches = matches || slicedValue === topValue || slicedValue % 2 === topValue % 2;
      return matches;
    }

    if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && cards.length >= 2 && cards.every(c => isEven(c.rank)) && isEven(top.rank)) return !isPair;

    if (cards.length === 2 && (rulerSuit === 'Clubs' || (rulerRank === 'K' && opponentSuit === 'Clubs')) && rulerRank !== 'A' && game.players[0].hand.length >= 5 && isPair) {
      return cards.every(c => isValidPlay([c], top));
    }

    if (cards.length === 2 && (rulerSuit === 'Diamonds' || (rulerRank === 'K' && opponentSuit === 'Diamonds')) && rulerRank !== 'A' && cards[0].suit === 'Diamonds') {
      return !isPair && isValidPlay([cards[0]], top);
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
        canPlay: true,
        pairEffect: null,
        pairEffectOwner: null,
        fortActive: false,
        fortCard: null
      };
      console.log(`Reset discard: ${game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None'}`);
    } else if (move === 'draw') {
      game.players[0].hand.push(...game.deck.splice(0, game.fortActive ? 1 : 2));
      game.moveHistory.unshift(`The player drew ${game.fortActive ? 1 : 2}`);
      game.turn = 1;
      aiMove();
    } else if (move) {
      const cardStrings = move.split(',');
      const cards = cardStrings.map(cs => {
        const [rank, suitChar] = [cs.slice(0, -1), cs.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        return suit && ranks.includes(rank) ? { rank, suit } : null;
      }).filter(c => c);
      const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;

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
                             (cards.length === 2 && playerRuler && playerRuler.suit === 'Clubs' && playerRuler.rank !== 'A' && isPair ? 'pair' :
                             (cards.length <= 4 && cards.every(c => c.rank === cards[0].rank) ? `${cards.length} of a kind` :
                             (rulerRank === '10' && allEven ? 'even stack' :
                             (isStraight ? 'straight' : 
                             (isFlush ? 'flush' : 
                             (cards.length === 5 && allEven ? 'even only' : 
                             (cards.length === 5 && allOdd ? 'odd only' : 'multi')))))));
          game.lastPlayCount = cards.length;

          // Handle pair effects
          if (isPair) {
            game.pairEffect = cards[0].rank;
            game.pairEffectOwner = 0;
            switch (cards[0].rank) {
              case 'A': game.moveHistory.unshift('Pair A: Opponent must play 10+'); break;
              case '2': 
                game.players[1].hand.push(...game.deck.splice(0, Math.min(3, game.deck.length)));
                game.moveHistory.unshift('Pair 2: Opponent drew 3');
                break;
              case '3': game.moveHistory.unshift('Pair 3: Opponent must play odds'); break;
              case '4': game.moveHistory.unshift('Pair 4: Opponent cannot play 8+'); break;
              case '5':
                if (game.discard.rank === '5') {
                  game.players[0].hand.push(game.discard);
                  const discardIdx = Math.floor(Math.random() * game.deck.length);
                  if (game.deck.length > 0) game.players[0].hand.push(game.deck.splice(discardIdx, 1)[0]);
                  shuffle(game.deck);
                  game.discard = cards[0];
                  game.moveHistory.unshift('Pair 5: Took 5 and a card from discard');
                }
                break;
              case '6': 
                game.skipAITurn = true;
                game.moveHistory.unshift('Pair 6: Opponent skips next turn');
                break;
              case '7':
                if (game.deck.length >= 2) {
                  const [card1, card2] = game.deck.slice(0, 2);
                  const replaceIdx = Math.floor(Math.random() * game.players[0].hand.length);
                  game.players[0].hand[replaceIdx] = card1;
                  game.deck.splice(0, 2);
                  game.deck.unshift(card2);
                  shuffle(game.deck);
                  game.moveHistory.unshift('Pair 7: Replaced a card');
                }
                break;
              case '8':
                const otherIdx = Math.floor(Math.random() * game.players[0].hand.length);
                game.discard = game.players[0].hand.splice(otherIdx, 1)[0];
                game.moveHistory.unshift(`Pair 8: Set discard to ${game.discard.rank}${game.discard.suit[0]}`);
                break;
              case '9':
                game.fortActive = true;
                game.fortCard = cards[0];
                game.moveHistory.unshift('Pair 9: Fort created');
                break;
              case '10': game.moveHistory.unshift('Pair 10: Opponent must play evens'); break;
              case 'J': game.moveHistory.unshift('Pair J: Opponent must play 8+'); break;
              case 'Q':
                game.players[1].hand.push(...game.deck.splice(0, 1));
                const returnIdx = Math.floor(Math.random() * game.players[0].hand.length);
                game.deck.push(game.players[0].hand.splice(returnIdx, 1)[0]);
                shuffle(game.deck);
                game.moveHistory.unshift('Pair Q: Opponent drew 1, returned a card');
                break;
              case 'K': game.moveHistory.unshift('Pair K: Opponent alternates even/odd'); break;
            }
          }

          // Clear pair effect if player plays again
          if (game.pairEffectOwner === 0 && game.turn === 0) {
            game.pairEffect = null;
            game.pairEffectOwner = null;
            if (!game.fortActive) game.fortCard = null;
          }

          // Fort maintenance
          if (game.fortActive && game.turn === game.pairEffectOwner && isPair) {
            game.moveHistory.unshift('Fort maintained');
          } else if (game.fortActive && cards.length >= 2) {
            game.fortActive = false;
            game.fortCard = null;
            game.moveHistory.unshift('Fort destroyed');
          } else if (game.fortActive && game.turn === game.pairEffectOwner) {
            game.fortActive = false;
            game.fortCard = null;
            game.moveHistory.unshift('Fort auto-destroyed');
          }

          // Existing ruler effects
          if ((rulerRank === '3' || (rulerRank === 'K' && opponentRank === '3')) && cards[0].rank === '7') {
            game.players[1].hand.push(...game.deck.splice(0, 2));
            game.moveHistory.unshift('The opponent drew 2 (3 ruler)');
          }
          if ((rulerRank === '4' || (rulerRank === 'K' && opponentRank === '4')) && game.lastPlayType === '4 of a kind') {
            game.deck.push(...game.players[0].hand, ...game.players[1].hand);
            game.players[0].hand = [];
            game.players[1].hand = [];
            shuffle(game.deck);
            game.players[0].hand = dealHand(3);
            game.players[1].hand = dealHand(7);
            game.moveHistory.unshift('All cards reshuffled, the player drew 3, the opponent drew 7 (4 ruler)');
          }
          if ((rulerRank === '6' || (rulerRank === 'K' && opponentRank === '6')) && cards[0].rank === '6') {
            const draw = Math.max(0, 7 - game.players[1].hand.length);
            if (draw > 0) {
              game.players[1].hand.push(...game.deck.splice(0, draw));
              game.moveHistory.unshift(`The opponent drew ${draw} to 7 (6 ruler)`);
            }
          }
          if ((rulerRank === '7' || (rulerRank === 'K' && opponentRank === '7')) && cards[0].rank === '3') {
            game.players[1].hand.push(...game.deck.splice(0, 2));
            game.moveHistory.unshift('The opponent drew 2 (7 ruler)');
          }
          if ((rulerRank === '8' || (rulerRank === 'K' && opponentRank === '8')) && cards[0].rank === '8' && game.players[1].hand.length <= 3) {
            game.players[1].hand.push(...game.deck.splice(0, 2));
            game.moveHistory.unshift('The opponent drew 2 (8 ruler)');
          }
          if ((rulerRank === 'Q' || (rulerRank === 'K' && opponentRank === 'Q')) && cards[0].rank === 'K') {
            game.players[1].hand.push(...game.deck.splice(0, 1));
            game.moveHistory.unshift('The opponent drew 1 (Q ruler)');
          }

          game.moveHistory.unshift(`The player played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
          if (game.moveHistory.length > 2) game.moveHistory.pop();

          if (game.players[0].hand.length === 0) {
            game.status = 'The player wins!';
            game.phase = 'over';
            if (playerRuler && playerRuler.rank === 'K' && !game.firstWin) {
              game.deck = shuffle([...deck]);
              game.players[0].hand = dealHand(5);
              game.phase = 'play';
              game.status = 'Play a card! (K ruler replay)';
              game.moveHistory.unshift('The player drew 5 to replay (K ruler)');
              game.firstWin = true;
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

    if (game.lastPlayCount > 1 && game.deck.length > 0 && !game.fortActive) {
      let drawCount = (game.lastPlayType === 'even only' || game.lastPlayType === 'odd only') ? 
                     Math.max(0, game.lastPlayCount - 3) : 
                     (game.lastPlayCount > 4 ? Math.max(0, game.lastPlayCount - 2) : game.lastPlayCount);
      if (playerRuler && playerRuler.rank === '2' && game.lastPlayType === 'pair') drawCount = 3; // Pair 2 override
      if (game.lastPlayType === 'multi') drawCount = game.lastPlayCount;
      const actualDraw = Math.min(drawCount, game.deck.length);
      if (actualDraw > 0) {
        game.players[1].hand.push(...game.deck.splice(0, actualDraw));
        game.moveHistory.unshift(`The opponent drew ${actualDraw} (caused by ${game.lastPlayType})`);
        if (game.moveHistory.length > 2) game.moveHistory.pop();
        console.log(`Opponent drew ${actualDraw}, new hand:`, ai.hand);
      }
    }

    if (game.fortActive && game.deck.length > 0) {
      const pairIdx = ai.hand.findIndex((c, i) => i < ai.hand.length - 1 && ai.hand[i + 1].rank === c.rank);
      if (pairIdx === -1) {
        game.players[1].hand.push(...game.deck.splice(0, 1));
        game.moveHistory.unshift('The opponent drew 1 (fort active)');
        game.turn = 0;
        return;
      }
    }

    const pairIdx = ai.hand.findIndex((c, i) => i < ai.hand.length - 1 && ai.hand[i + 1].rank === c.rank && isValidPlay([c, ai.hand[i + 1]], game.discard));
    if (pairIdx !== -1) {
      const cards = [ai.hand[pairIdx], ai.hand[pairIdx + 1]];
      ai.hand.splice(pairIdx, 2);
      game.discard = cards[0];
      game.lastPlayCount = 2;
      game.lastPlayType = 'pair';

      // AI pair effects
      if (cards[0].rank === 'A') {
        game.pairEffect = 'A';
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair A: Player must play 10+');
      } else if (cards[0].rank === '2') {
        game.players[0].hand.push(...game.deck.splice(0, Math.min(3, game.deck.length)));
        game.moveHistory.unshift('Pair 2: Player drew 3');
      } else if (cards[0].rank === '3') {
        game.pairEffect = '3';
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair 3: Player must play odds');
      } else if (cards[0].rank === '4') {
        game.pairEffect = '4';
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair 4: Player cannot play 8+');
      } else if (cards[0].rank === '5') {
        if (game.discard.rank === '5') {
          game.players[1].hand.push(game.discard);
          const discardIdx = Math.floor(Math.random() * game.deck.length);
          if (game.deck.length > 0) game.players[1].hand.push(game.deck.splice(discardIdx, 1)[0]);
          shuffle(game.deck);
          game.discard = cards[0];
          game.moveHistory.unshift('Pair 5: Took 5 and a card from discard');
        }
      } else if (cards[0].rank === '6') {
        game.skipAITurn = true;
        game.moveHistory.unshift('Pair 6: Player skips next turn');
      } else if (cards[0].rank === '7') {
        if (game.deck.length >= 2) {
          const [card1, card2] = game.deck.slice(0, 2);
          const replaceIdx = Math.floor(Math.random() * game.players[1].hand.length);
          game.players[1].hand[replaceIdx] = card1;
          game.deck.splice(0, 2);
          game.deck.unshift(card2);
          shuffle(game.deck);
          game.moveHistory.unshift('Pair 7: Replaced a card');
        }
      } else if (cards[0].rank === '8') {
        const otherIdx = Math.floor(Math.random() * game.players[1].hand.length);
        game.discard = game.players[1].hand.splice(otherIdx, 1)[0];
        game.moveHistory.unshift(`Pair 8: Set discard to ${game.discard.rank}${game.discard.suit[0]}`);
      } else if (cards[0].rank === '9') {
        game.fortActive = true;
        game.fortCard = cards[0];
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair 9: Fort created');
      } else if (cards[0].rank === '10') {
        game.pairEffect = '10';
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair 10: Player must play evens');
      } else if (cards[0].rank === 'J') {
        game.pairEffect = 'J';
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair J: Player must play 8+');
      } else if (cards[0].rank === 'Q') {
        game.players[0].hand.push(...game.deck.splice(0, 1));
        const returnIdx = Math.floor(Math.random() * game.players[1].hand.length);
        game.deck.push(game.players[1].hand.splice(returnIdx, 1)[0]);
        shuffle(game.deck);
        game.moveHistory.unshift('Pair Q: Player drew 1, returned a card');
      } else if (cards[0].rank === 'K') {
        game.pairEffect = 'K';
        game.pairEffectOwner = 1;
        game.moveHistory.unshift('Pair K: Player alternates even/odd');
      }

      // Fort maintenance for AI
      if (game.fortActive && game.turn === game.pairEffectOwner) {
        game.moveHistory.unshift('Fort maintained');
      } else if (game.fortActive) {
        game.fortActive = false;
        game.fortCard = null;
        game.moveHistory.unshift('Fort destroyed');
      }

      game.moveHistory.unshift(`The opponent played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
      if (game.moveHistory.length > 2) game.moveHistory.pop();
    } else {
      const idx = ai.hand.findIndex(c => isValidPlay([c], game.discard));
      if (idx !== -1) {
        game.discard = ai.hand.splice(idx, 1)[0];
        game.lastPlayCount = 1;
        game.lastPlayType = 'single';
        game.moveHistory.unshift(`The opponent played ${game.discard.rank}${game.discard.suit[0]}`);
        if (game.moveHistory.length > 2) game.moveHistory.pop();
      } else if (game.deck.length > 0) {
        game.players[1].hand.push(...game.deck.splice(0, game.fortActive ? 1 : 2));
        game.moveHistory.unshift(`The opponent drew ${game.fortActive ? 1 : 2}`);
        if (game.moveHistory.length > 2) game.moveHistory.pop();
      } else {
        game.status = 'The opponent can\'t play or draw. The player\'s turn!';
      }
    }

    if (game.pairEffectOwner === 1 && game.turn === 1) {
      game.pairEffect = null;
      game.pairEffectOwner = null;
      if (!game.fortActive) game.fortCard = null;
    }

    game.status = 'The player\'s turn!';
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
    canPlay: game.canPlay,
    pairEffect: game.pairEffect,
    fortActive: game.fortActive
  };
  console.log('Sending response:', JSON.stringify(response));
  res.status(200).json(response);
}

module.exports = handler;
