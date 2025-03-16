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
      extraTurn: false,
      discardPile: [] // Track discarded cards for Pair 5
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
      case '5': return 'Medium Rare';
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
      if (cards.length === 1) return false;
      if (isPair && game.fortRank) {
        const fortValue = rankValue(game.fortRank);
        const pairValue = rankValue(cards[0].rank);
        return pairValue >= 2 && pairValue <= 13;
      }
    }

    if (game.pairEffect && game.turn !== game.pairEffectOwner) {
      const checkValue = c => {
        let value = rankValue(c.rank);
        if (((rulerSuit === 'Hearts' && c.suit === 'Hearts') || (rulerRank === 'A' && rulerSuit === 'Hearts')) && rulerRank !== 'A') value = rankValue(rulerRank);
        return value;
      };
      const values = cards.map(checkValue);
      if (game.pairEffect === 'A' && values.some(v => v < 10)) return false;
      if (game.pairEffect === '3' && values.some(v => v % 2 === 0)) return false;
      if (game.pairEffect === '4' && values.some(v => v >= 8)) return false;
      if (game.pairEffect === '10' && values.some(v => v % 2 !== 0)) return false;
      if (game.pairEffect === 'J' && values.some(v => v < 8)) return false;
      if (game.pairEffect === 'K') {
        const lastWasEven = game.moveHistory.length > 0 && rankValue(game.discard.rank) % 2 === 0;
        return lastWasEven ? values.every(v => v % 2 !== 0) : values.every(v => v % 2 === 0);
      }
    }

    if (!top && game.phase === 'play') {
      if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Diamonds') && cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0)) return !isPair;
      if ((rulerSuit === 'Diamonds' || (rulerRank === 'K' && opponentSuit === 'Diamonds')) && cards.length === 2 && cards.some(c => c.suit === 'Diamonds') && !isPair) return true;
      if ((rulerRank === '3' || (rulerRank === 'K' && opponentRank === '3')) && cards.length === 1 && cards[0].rank === '7') return true;
      if ((rulerRank === '7' || (rulerRank === 'K' && opponentRank === '7')) && cards.length === 1 && cards[0].rank === '3') return true;
      if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && cards.length >= 2 && cards.every(c => isEven(c.rank))) return !isPair;
      if (cards.length >= 2 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank)) return true;
      return false;
    }

    if (cards.length === 1) {
      const card = cards[0];
      const value = rankValue(card.rank);
      const rulerValue = ((rulerSuit === 'Hearts' && card.suit === 'Hearts') || (rulerRank === 'A' && rulerSuit === 'Hearts')) && rulerRank !== 'A' ? rankValue(rulerRank === 'K' ? opponentRank : rulerRank) : null;
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

    if (cards.length === 2) {
      if (isPair) {
        const valid = cards.every(card => isValidPlay([card], top));
        if (!valid) return false;
        return true;
      }
      if ((rulerSuit === 'Diamonds' || (rulerRank === 'K' && opponentSuit === 'Diamonds')) && cards.some(c => c.suit === 'Diamonds')) return true;
    }

    if (cards.length === 3 && isToaK) {
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
        extraTurn: false,
        discardPile: []
      };
    } else if (addCards) {
      const match = addCards.match(/^([A2-9JQK]|10)([DHSC])([ABD])$/i);
      if (!match) {
        game.status = 'Invalid card code! Use e.g., "8DA" (A) or "KSD" (discard)';
      } else {
        const [_, rank, suitChar, targetChar] = match;
        const suit = suits.find(s => s[0].toUpperCase() === suitChar.toUpperCase());
        const validRank = rank === '10' ? '10' : ranks.find(r => r.toUpperCase() === rank.toUpperCase());
        const target = targetChar.toUpperCase();

        if (!validRank || !suit) {
          game.status = 'Invalid rank or suit!';
        } else {
          const card = { rank: validRank, suit };
          if (target === 'D') {
            const deckIdx = game.deck.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (deckIdx !== -1) {
              game.discardPile.push(game.discard);
              game.discard = game.deck.splice(deckIdx, 1)[0];
            } else {
              game.discardPile.push(game.discard);
              game.discard = { rank: validRank, suit };
            }
            game.moveHistory.unshift(`Set ${card.rank}${suit[0]} as discard`);
            if (game.moveHistory.length > 3) game.moveHistory.pop();
            game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn: Set discard!`;
          } else {
            const playerIdx = target === 'A' ? 0 : 1;
            const deckIdx = game.deck.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (deckIdx !== -1) {
              game.players[playerIdx].hand.push(game.deck.splice(deckIdx, 1)[0]);
            } else {
              game.players[playerIdx].hand.push({ rank: validRank, suit });
            }
            game.moveHistory.unshift(`Added ${card.rank}${suit[0]} to Player ${target}`);
            if (game.moveHistory.length > 3) game.moveHistory.pop();
            game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn: Added card!`;
          }
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
          const sortedIndices = indices.sort((a, b) => b - a);
          const playedCards = sortedIndices.map(i => game.players[game.turn].hand.splice(i, 1)[0]);
          game.discardPile.push(game.discard);
          game.discard = playedCards[0];
          const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r));
          const playerRuler = game.players[game.turn].ruler;
          const rulerRank = playerRuler ? playerRuler.rank : null;

          const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
          const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || 
                            (cards.length === 5 && values.join(',') === '1,10,11,12,13');
          const isFlush = cards.every(c => c.suit === cards[0].suit);
          const allEven = cards.every(c => isEven(c.rank));
          const allOdd = cards.every(c => !isEven(c.rank));
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

          // Ruler Abilities
          let rulerEffectMessage = null;
          if (cards.length === 1) {
            const cardRank = cards[0].rank;
            if ((rulerRank === '6' || (rulerRank === 'K' && opponentRank === '6')) && cardRank === '6') {
              const opponentHandSize = game.players[1 - game.turn].hand.length;
              const drawTo7 = Math.max(0, 7 - opponentHandSize);
              const actualDraw = Math.min(drawTo7, game.deck.length);
              if (actualDraw > 0) {
                game.players[1 - game.turn].hand.push(...game.deck.splice(0, actualDraw));
                rulerEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${actualDraw} (Ruler 6: Nightmare)`;
              }
            }
            if ((rulerRank === '7' || (rulerRank === 'K' && opponentRank === '7')) && cardRank === '3') {
              const actualDraw = Math.min(2, game.deck.length);
              if (actualDraw > 0) {
                game.players[1 - game.turn].hand.push(...game.deck.splice(0, actualDraw));
                rulerEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${actualDraw} (Ruler 7: Lucky Spin)`;
              }
            }
            if ((rulerRank === '8' || (rulerRank === 'K' && opponentRank === '8')) && cardRank === '8' && game.players[1 - game.turn].hand.length <= 3) {
              const actualDraw = Math.min(2, game.deck.length);
              if (actualDraw > 0) {
                game.players[1 - game.turn].hand.push(...game.deck.splice(0, actualDraw));
                rulerEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${actualDraw} (Ruler 8: Seeing Red)`;
              }
            }
            if (rulerEffectMessage) game.moveHistory.unshift(rulerEffectMessage);
          }

          // Pair Abilities
          let pairEffectMessage = null;
          let defaultDrawMessage = null;
          if (isPair) {
            const opponentIdx = 1 - game.turn;
            const defaultDraw = Math.min(2, game.deck.length);
            if (defaultDraw > 0) {
              game.players[opponentIdx].hand.push(...game.deck.splice(0, defaultDraw));
              defaultDrawMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${defaultDraw} (Pair Default)`;
            }
            game.pairEffect = cards[0].rank;
            game.pairEffectOwner = game.turn;
            switch (cards[0].rank) {
              case 'A': pairEffectMessage = 'Pair A: Opponent must play 10+'; break;
              case '2':
                const extraDraw2 = Math.min(2, game.deck.length);
                if (extraDraw2 > 0) {
                  game.players[opponentIdx].hand.push(...game.deck.splice(0, extraDraw2));
                  pairEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${extraDraw2} (Pair 2: Extra Draw)`;
                }
                break;
              case '3': pairEffectMessage = 'Pair 3: Opponent must play odd'; break;
              case '4': pairEffectMessage = 'Pair 4: Opponent cannot play 8+'; break;
              case '5':
                if (game.discardPile.length > 0) {
                  const fiveIdx = playedCards.findIndex(c => c.rank === '5');
                  if (fiveIdx !== -1) game.players[game.turn].hand.push(playedCards[fiveIdx]);
                  const discardIdx = Math.floor(Math.random() * game.discardPile.length);
                  game.players[game.turn].hand.push(game.discardPile.splice(discardIdx, 1)[0]);
                  pairEffectMessage = 'Pair 5: Returned a 5 and took a random discard';
                } else {
                  pairEffectMessage = 'Pair 5: No discard pile to take from';
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
                const qDraw = Math.min(1, game.deck.length);
                if (qDraw > 0) {
                  game.players[opponentIdx].hand.push(...game.deck.splice(0, qDraw));
                  pairEffectMessage = `Player ${game.turn === 0 ? 'B' : 'A'} drew ${qDraw} (Pair Q)`;
                  game.extraTurn = true; // Allow picking discard next turn
                }
                break;
              case 'K': pairEffectMessage = 'Pair K: Opponent alternates even/odd'; break;
            }
            if (defaultDrawMessage) game.moveHistory.unshift(defaultDrawMessage);
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

          if (game.fortActive) {
            if (game.turn === game.pairEffectOwner) {
              game.moveHistory.unshift('Fort continues');
            } else if (isPair) {
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
          } else if (game.extraTurn && (cards[0].rank === '8' || cards[0].rank === 'Q') && isPair) {
            game.status = `Player ${game.turn === 0 ? 'A' : 'B'}\'s turn: ${cards[0].rank === '8' ? 'Play again and set discard!' : 'Pick a card to discard!'}`;
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
