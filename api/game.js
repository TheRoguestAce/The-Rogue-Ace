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
        { hand: [], ruler: null }, // Player A
        { hand: [], ruler: null }  // Player B
      ],
      turn: 0, // 0 = Player A, 1 = Player B
      phase: 'setup',
      status: 'Developer Mode: Pick your ruler or add cards!',
      moveHistory: [],
      lastPlayCount: 1,
      lastPlayType: 'single',
      canPlay: true,
      pairEffect: null,
      pairEffectOwner: null,
      fortActive: false,
      fortCard: null,
      fortRank: null, // For ToaK Fort rank
      extraTurn: false
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

  function getActiveEffectName() {
    if (!game.pairEffect || game.turn === game.pairEffectOwner) return '';
    switch (game.pairEffect) {
      case 'A': return 'Ace High';
      case '2': return 'Pair Pair';
      case '3': return 'Odd Job';
      case '4': return 'Low Life';
      case '5': return 'Feeling Off';
      case '6': return 'Skip It';
      case '7': return 'Switch Up';
      case '8': return 'Discard Twist';
      case '9': return 'Fortified';
      case '10': return 'Even Steven';
      case 'J': return 'Jack Up';
      case 'Q': return 'Queen\'s Trade';
      case 'K': return 'King\'s Rule';
      default: return '';
    }
  }

  function isValidPlay(cards, top) {
    if (cards.length === 0) return false;
    const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r));
    const isEven = r => rankValue(r) % 2 === 0;
    const playerRuler = game.players[game.turn].ruler;
    const rulerRank = playerRuler ? playerRuler.rank : null;
    const rulerSuit = playerRuler ? playerRuler.suit : null;
    const opponentRuler = game.players[1 - game.turn].ruler;
    const opponentRank = opponentRuler ? opponentRuler.rank : null;
    const opponentSuit = opponentRuler ? opponentRuler.suit : null;
    const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
    const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
    const topValue = top ? rankValue(top.rank) : 0;
    const isRed = s => ['Diamonds', 'Hearts'].includes(s);

    if (game.fortActive && game.turn !== game.pairEffectOwner) {
      if (cards.length === 1) return false; // Single cards blocked
      if (isPair && game.fortRank) {
        const fortValue = rankValue(game.fortRank);
        const pairValue = rankValue(cards[0].rank);
        return pairValue >= 2 && pairValue <= 13; // Any pair 2-K valid, Aces (1) not enough
      }
    }

    if (game.pairEffect && game.turn !== game.pairEffectOwner) {
      const value = rankValue(cards[0].rank);
      if (game.pairEffect === 'A' && value < 10) return false;
      if (game.pairEffect === '3' && value % 2 === 0) return false;
      if (game.pairEffect === '4' && value >= 8) return false;
      if (game.pairEffect === '10' && value % 2 !== 0) return false;
      if (game.pairEffect === 'J' && value < 8) return false;
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

    if (cards.length === 2 && cards[0].rank === cards[1].rank && top) {
      const validSingle = cards.every(card => isValidPlay([card], top));
      if (!validSingle) return false;
      return true;
    }

    if (cards.length === 3 && isToaK && top) {
      const validSingle = cards.every(card => isValidPlay([card], top));
      if (!validSingle) return false;
      return true;
    }

    if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && cards.length >= 2 && cards.every(c => isEven(c.rank)) && isEven(top.rank)) return !isPair;

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
      console.log(`Dealing initial hands for ${sessionId}`);
      game.players[0].hand = dealHand(8);
      game.players[1].hand = dealHand(8);
      console.log(`Player A hand:`, game.players[0].hand);
    }
    if (!game.discard && game.deck.length > 0) {
      game.discard = game.deck.shift();
      console.log(`Initial discard set: ${game.discard.rank}${game.discard.suit[0]}`);
    }
    game.canPlay = game.players[game.turn].hand.some(card => isValidPlay([card], game.discard));
  }

  if (method === 'POST') {
    const { move, reset, addCards } = query;
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
        status: 'Developer Mode: Pick your ruler or add cards!',
        moveHistory: [],
        lastPlayCount: 1,
        lastPlayType: 'single',
        canPlay: true,
        pairEffect: null,
        pairEffectOwner: null,
        fortActive: false,
        fortCard: null,
        fortRank: null,
        extraTurn: false
      };
    } else if (addCards) {
      const match = addCards.match(/^(\d)([A2-9JQK]|10)([DHSC])([AB])$/i);
      if (!match) {
        game.status = 'Invalid card code! Use e.g., "18DA" (1 8D to A)';
      } else {
        const [_, amountStr, rank, suitChar, playerChar] = match;
        const amount = parseInt(amountStr);
        const suit = suits.find(s => s[0].toUpperCase() === suitChar.toUpperCase());
        const validRank = rank === '10' ? '10' : ranks.find(r => r.toUpperCase() === rank.toUpperCase());
        const playerIdx = playerChar.toUpperCase() === 'A' ? 0 : 1;

        if (!validRank || !suit || amount < 1 || amount > 9) {
          game.status = 'Invalid rank, suit, or amount!';
        } else {
          const card = { rank: validRank, suit };
          let added = 0;
          for (let i = 0; i < amount && game.deck.length > 0; i++) {
            const deckIdx = game.deck.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (deckIdx !== -1) {
              game.players[playerIdx].hand.push(game.deck.splice(deckIdx, 1)[0]);
              added++;
            }
          }
          game.moveHistory.unshift(`Added ${added} ${card.rank}${suit[0]} to Player ${playerChar.toUpperCase()}${added < amount ? ' (deck limited)' : ''}`);
          if (game.moveHistory.length > 3) game.moveHistory.pop();
          game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn: Added ${added} card(s)!`;
        }
      }
    } else if (move === 'draw') {
      const drawCount = game.fortActive && game.turn !== game.pairEffectOwner ? 2 : (game.fortActive ? 1 : 2);
      const actualDraw = Math.min(drawCount, game.deck.length);
      game.players[game.turn].hand.push(...game.deck.splice(0, actualDraw));
      game.moveHistory.unshift(`Player ${game.turn === 0 ? 'A' : 'B'} drew ${actualDraw}${game.fortActive && game.turn !== game.pairEffectOwner ? ' (fort)' : ''}`);
      game.turn = 1 - game.turn;
      game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn!`;
    } else if (move) {
      const cardStrings = move.split(',');
      const cards = cardStrings.map(cs => {
        const [rank, suitChar] = [cs.slice(0, -1), cs.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        return suit && ranks.includes(rank) ? { rank, suit } : null;
      }).filter(c => c);
      const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
      const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);

      if (cards.length === 0) {
        game.status = 'Invalid selection!';
      } else if (game.phase === 'setup') {
        if (cards.length !== 1) {
          game.status = 'Pick one ruler!';
        } else {
          const idx = game.players[game.turn].hand.findIndex(c => c.rank === cards[0].rank && c.suit === cards[0].suit);
          if (idx === -1) {
            game.status = 'Ruler not in hand!';
          } else {
            game.players[game.turn].ruler = game.players[game.turn].hand.splice(idx, 1)[0];
            if (!game.players[1 - game.turn].ruler) {
              game.turn = 1 - game.turn;
              game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn: Pick your ruler!`;
            } else {
              game.discard = game.deck.length > 0 ? game.deck.shift() : null;
              game.phase = 'play';
              game.turn = 1 - game.turn;
              game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn!`;
              game.moveHistory = [`Player ${game.turn === 0 ? 'B' : 'A'} set ruler ${game.players[1 - game.turn].ruler.rank}${game.players[1 - game.turn].ruler.suit[0]}`];
            }
          }
        }
      } else if (game.phase === 'play') {
        const indices = cards.map(card => game.players[game.turn].hand.findIndex(c => c.rank === card.rank && c.suit === card.suit));
        if (indices.some(i => i === -1) || !isValidPlay(cards, game.discard)) {
          game.status = 'Invalid play!';
        } else {
          indices.sort((a, b) => b - a).forEach(i => game.players[game.turn].hand.splice(i, 1));
          const oldDiscard = game.discard;
          game.discard = cards[0];
          const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r));
          const playerRuler = game.players[game.turn].ruler;
          const rulerRank = playerRuler ? playerRuler.rank : null;

          const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
          const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || 
                            (cards.length === 5 && values.join(',') === '1,10,11,12,13');
          const isFlush = cards.every(c => c.suit === cards[0].suit);
          const allEven = cards.every(c => rankValue(c.rank) % 2 === 0);
          const allOdd = cards.every(c => rankValue(c.rank) % 2 !== 0);
          game.lastPlayType = cards.length === 1 ? 'single' :
                             (isPair ? 'pair' :
                             (isToaK ? 'three of a kind' :
                             (cards.length === 4 && cards.every(c => c.rank === cards[0].rank) ? 'four of a kind' :
                             (rulerRank === '10' && allEven ? 'even stack' :
                             (isStraight ? 'straight' : 
                             (isFlush ? 'flush' : 
                             (cards.length === 5 && allEven ? 'even only' : 
                             (cards.length === 5 && allOdd ? 'odd only' : 'multi'))))))));
          game.lastPlayCount = cards.length;

          let pairEffectMessage = null;
          if (isPair) {
            game.pairEffect = cards[0].rank;
            game.pairEffectOwner = game.turn;
            switch (cards[0].rank) {
              case 'A': pairEffectMessage = 'Pair A: Opponent must play 10+'; break;
              case '2': 
                const drawCount2 = Math.min(3, game.deck.length);
                game.players[1 - game.turn].hand.push(...game.deck.splice(0, drawCount2));
                pairEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${drawCount2} (Pair Pair)`;
                break;
              case '3': pairEffectMessage = 'Pair 3: Opponent must play odd'; break;
              case '4': pairEffectMessage = 'Pair 4: Opponent cannot play 8+'; break;
              case '5':
                if (oldDiscard && oldDiscard.rank === '5') {
                  game.players[game.turn].hand.push(oldDiscard);
                  const drawIdx = game.deck.length > 0 ? Math.floor(Math.random() * game.deck.length) : -1;
                  if (drawIdx >= 0) game.players[game.turn].hand.push(game.deck.splice(drawIdx, 1)[0]);
                  shuffle(game.deck);
                  game.discard = cards[0];
                  pairEffectMessage = 'Pair 5: Took 5 and a card from discard';
                } else {
                  pairEffectMessage = 'Pair 5: No 5 in discard to take';
                }
                break;
              case '6': pairEffectMessage = 'Pair 6: Opponent draws 1 next turn'; break;
              case '7':
                if (game.deck.length >= 1) {
                  const card1 = game.deck.shift();
                  const replaceIdx = Math.floor(Math.random() * game.players[game.turn].hand.length);
                  game.deck.push(game.players[game.turn].hand.splice(replaceIdx, 1)[0]);
                  game.players[game.turn].hand.push(card1);
                  shuffle(game.deck);
                  pairEffectMessage = 'Pair 7: Replaced a card';
                } else {
                  pairEffectMessage = 'Pair 7: No cards in deck to replace';
                }
                break;
              case '8':
                pairEffectMessage = 'Pair 8: Play again and set discard';
                game.extraTurn = true;
                break;
              case '9':
                game.fortActive = true;
                game.fortCard = cards[0];
                game.fortRank = cards[0].rank;
                pairEffectMessage = 'Pair 9: Fort created';
                break;
              case '10': pairEffectMessage = 'Pair 10: Opponent must play even'; break;
              case 'J': pairEffectMessage = 'Pair J: Opponent must play 8+'; break;
              case 'Q':
                game.players[1 - game.turn].hand.push(...game.deck.splice(0, 1));
                const returnIdx = Math.floor(Math.random() * game.players[game.turn].hand.length);
                game.deck.push(game.players[game.turn].hand.splice(returnIdx, 1)[0]);
                shuffle(game.deck);
                pairEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew 1, returned a card (Pair Q)`;
                break;
              case 'K': pairEffectMessage = 'Pair K: Opponent alternates even/odd'; break;
            }
            if (pairEffectMessage) game.moveHistory.unshift(pairEffectMessage);
          }

          if (isToaK) {
            if (cards[0].rank === 'A') {
              const aceDraw = Math.min(8, game.deck.length);
              game.players[1 - game.turn].hand.push(...game.deck.splice(0, aceDraw));
              game.moveHistory.unshift(`Player ${game.turn === 0 ? 'B' : 'A'} drew ${aceDraw} (ToaK Aces)`);
            } else {
              game.fortActive = true;
              game.fortCard = cards[0];
              game.fortRank = cards[0].rank;
              game.moveHistory.unshift(`ToaK ${cards[0].rank}: Fort created`);
            }
          }

          if (game.fortActive && game.turn === game.pairEffectOwner) {
            if (cards.length === 1) {
              game.fortActive = false;
              game.fortCard = null;
              game.fortRank = null;
              game.moveHistory.unshift('Fort expired (single play)');
            } else if (isPair || isToaK) {
              game.moveHistory.unshift('Fort maintained');
            } else {
              game.fortActive = false;
              game.fortCard = null;
              game.fortRank = null;
              game.moveHistory.unshift('Fort destroyed (multi play)');
            }
          } else if (game.fortActive && isPair) {
            const fortValue = rankValue(game.fortRank);
            const pairValue = rankValue(cards[0].rank);
            if (pairValue > fortValue) {
              game.fortActive = false;
              game.fortCard = null;
              game.fortRank = null;
              game.moveHistory.unshift(`Fort destroyed (higher pair: ${cards[0].rank})`);
            } else {
              game.moveHistory.unshift(`Fort avoided (lower pair: ${cards[0].rank})`);
            }
          }

          if (game.pairEffectOwner === game.turn && !isPair) {
            game.pairEffect = null;
            game.pairEffectOwner = null;
          }

          const effectName = getActiveEffectName();
          const playMessage = `Player ${game.turn === 0 ? 'A' : 'B'} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}${effectName ? ` (${effectName})` : ''}`;
          game.moveHistory.unshift(playMessage);
          if (game.moveHistory.length > 3) game.moveHistory.pop();

          if (game.players[game.turn].hand.length === 0) {
            game.status = `Player ${game.turn === 0 ? 'A' : 'B'} wins! Reset to continue.`;
            game.phase = 'over';
          } else if (game.extraTurn && cards[0].rank === '8' && isPair) {
            game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn: Play again and set discard!`;
            game.extraTurn = false;
          } else {
            game.turn = 1 - game.turn;
            game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn!`;
          }
        }
      }
    }
    game.canPlay = game.players[game.turn].hand.some(card => isValidPlay([card], game.discard));
  }

  gameStates[sessionId] = game;

  const response = {
    discard: game.discard && game.discard.rank ? `${game.discard.rank}${game.discard.suit[0]}` : 'None',
    playerAHand: game.players[0].hand || [],
    playerBHand: game.players[1].hand || [],
    playerARuler: game.players[0].ruler ? `${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}` : 'None',
    playerBRuler: game.players[1].ruler ? `${game.players[1].ruler.rank}${game.players[1].ruler.suit[0]}` : 'None',
    status: game.status || 'Error',
    phase: game.phase,
    turn: game.turn === 0 ? 'A' : 'B',
    session: sessionId,
    moveHistory: game.moveHistory,
    canPlay: game.canPlay,
    pairEffect: game.pairEffect,
    fortActive: game.fortActive,
    fortRank: game.fortRank,
    deckSize: game.deck.length
  };
  console.log('Sending response:', JSON.stringify(response));
  res.status(200).json(response);
}

module.exports = handler;
