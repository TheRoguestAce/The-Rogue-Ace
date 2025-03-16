const gameStates = {};

async function handler(req, res) {
  const { method, query } = req;
  const sessionId = query.session || 'default';
  console.log(`[${method}] Session: ${sessionId}`);

  const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

  let game = gameStates[sessionId] || {
    deck: shuffle([...deck]),
    discard: null,
    discardPile: [],
    players: [{ hand: [], ruler: null }, { hand: [], ruler: null }],
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
    wins: [0, 0]
  };

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
    return rulerAbilities.pairs[game.pairEffect].split(':')[0];
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

    // Fort restrictions
    if (game.fortActive && game.turn !== game.pairEffectOwner) {
      if (cards.length === 1) return false;
      if (isPair && game.fortRank) {
        const fortValue = rankValue(game.fortRank);
        const pairValue = rankValue(cards[0].rank);
        return pairValue >= 2 && pairValue <= 13;
      }
    }

    // Pair effect restrictions
    if (game.pairEffect && game.turn !== game.pairEffectOwner) {
      const checkValue = c => {
        let value = rankValue(c.rank);
        if (((rulerSuit === 'Hearts' && c.suit === 'Hearts') || (rulerRank === 'A' && rulerSuit === 'Hearts')) && rulerRank !== 'A') value = rankValue(rulerRank);
        if ((rulerRank === 'Q' || (rulerRank === 'K' && opponentRank === 'Q')) && c.rank === 'K') value = topValue;
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

    // Empty pile plays
    if (!top && game.phase === 'play') {
      if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Diamonds') && cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0)) return !isPair;
      if ((rulerSuit === 'Diamonds' || (rulerRank === 'K' && opponentSuit === 'Diamonds')) && cards.length === 2 && cards.some(c => c.suit === 'Diamonds') && !isPair) return true;
      if ((rulerRank === '3' || (rulerRank === 'K' && opponentRank === '3')) && cards.length === 1 && cards[0].rank === '7') return true;
      if ((rulerRank === '7' || (rulerRank === 'K' && opponentRank === '7')) && cards.length === 1 && cards[0].rank === '3') return true;
      if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && cards.length >= 2 && cards.every(c => isEven(c.rank))) return !isPair;
      if (cards.length >= 2 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank)) return true;
      return false;
    }

    // Single card
    if (cards.length === 1) {
      const card = cards[0];
      const value = rankValue(card.rank);
      const rulerValue = ((rulerSuit === 'Hearts' && card.suit === 'Hearts') || (rulerRank === 'A' && rulerSuit === 'Hearts')) && rulerRank !== 'A' ? rankValue(rulerRank) : null;
      const slicedValue = (rulerSuit === 'Spades' || (rulerRank === 'K' && opponentSuit === 'Spades')) && card.suit === 'Spades' ? Math.ceil(value / 2) - 1 : null;
      const pocketValue = (rulerRank === 'A' && rulerSuit === 'Spades') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Spades') ? Math.floor(value / 2) : null;
      let matches = card.suit === top.suit || card.rank === top.rank || value % 2 === topValue % 2;

      if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Diamonds') && !['J', 'Q', 'K'].includes(card.rank) && value % 2 !== 0) matches = true;
      if ((rulerRank === 'A' && rulerSuit === 'Hearts') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Hearts')) matches = true;
      if ((rulerRank === 'A' && rulerSuit === 'Spades') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Spades')) matches = matches || pocketValue === topValue;
      if ((rulerRank === 'A' && rulerSuit === 'Clubs') || (rulerRank === 'K' && opponentRank === 'A' && opponentSuit === 'Clubs')) matches = matches || Math.floor(value / 2) === topValue;
      if ((rulerRank === '5' || (rulerRank === 'K' && opponentRank === '5')) && ['J', 'Q', 'K'].includes(card.rank)) matches = topValue === 5;
      if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && isEven(card.rank) && isEven(top.rank)) matches = true;
      if ((rulerRank === 'J' || (rulerRank === 'K' && opponentRank === 'J')) && ['J', 'Q', 'K', 'A'].includes(card.rank)) matches = ['J', 'Q', 'K', 'A'].includes(top.rank);
      if ((rulerRank === 'Q' || (rulerRank === 'K' && opponentRank === 'Q')) && card.rank === 'K') matches = true;
      if ((rulerSuit === 'Hearts' || (rulerRank === 'K' && opponentSuit === 'Hearts')) && rulerRank !== 'A') matches = matches || rulerValue === topValue || rulerValue % 2 === topValue % 2;
      if ((rulerSuit === 'Spades' || (rulerRank === 'K' && opponentSuit === 'Spades')) && card.suit === 'Spades') matches = matches || slicedValue === topValue || slicedValue % 2 === topValue % 2;
      return matches;
    }

    // Pair
    if (isPair) {
      if ((rulerSuit === 'Clubs' || (rulerRank === 'K' && opponentSuit === 'Clubs')) && game.players[game.turn].hand.length >= 5) return true;
      return cards.every(card => isValidPlay([card], top));
    }

    // Diamond Storm
    if (cards.length === 2 && (rulerSuit === 'Diamonds' || (rulerRank === 'K' && opponentSuit === 'Diamonds')) && cards.some(c => c.suit === 'Diamonds') && !isPair) return true;

    // Three of a Kind
    if (isToaK) return cards.every(card => isValidPlay([card], top));

    // Ruler 10
    if ((rulerRank === '10' || (rulerRank === 'K' && opponentRank === '10')) && cards.length >= 2 && cards.every(c => isEven(c.rank)) && isEven(top.rank)) return !isPair;

    // Multi-card plays
    if (cards.length >= 2 && cards.length <= 4) return cards.every(c => c.rank === cards[0].rank);

    if (cards.length === 5) {
      const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
      const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || (values.join(',') === '1,10,11,12,13');
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

  const rulerAbilities = {
    suits: {
      Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
      Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
      Spades: 'Sliced: Spades count as both their rank and rank ÷ 2 rounded up - 1 (pairs OK)',
      Clubs: 'Strike: Play a pair if 5+ in hand'
    },
    ranks: {
      2: 'Twice the Might: Pairs make the opponent draw 2 extra (4 total)',
      3: 'Lucky Clover: Play a 7 anytime, the opponent draws 2',
      4: 'Fourfold: Four of a kind reshuffles all cards, the opponent draws 7, the player draws 3',
      5: 'High Five: Face cards count as 5 (pairs OK)',
      6: 'Nightmare: Playing a 6 makes the opponent draw to 7 cards',
      7: 'Lucky Spin: Play a 3 anytime, the opponent draws 2',
      8: 'Seeing Red: If the opponent has ≤3 cards, 8 makes them draw 2',
      9: 'Reverse Nightmare: The opponent’s 9s make the player discard to 5 cards',
      10: 'Perfection: Play multiple even cards on an even card or empty pile (no pairs)',
      J: 'Servant: J/Q/K/A count as each other (pairs OK)',
      Q: 'Ruler’s Touch: Kings are wild cards, counting as every rank, make the opponent draw 1 (pairs OK)',
      K: 'Ruler of Rulers: Inherits all of the opponent’s ruler abilities, replay with 5 cards on first win',
      'A-Diamonds': 'Perfect Card: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)',
      'A-Hearts': 'Otherworldly Touch: Hearts are wild cards, counting as every rank (no pairs)',
      'A-Spades': 'Pocket Knife: All cards count as both their rank and half rank rounded down (pairs OK)',
      'A-Clubs': 'Nuclear Bomb: First win reshuffles, others 7 cards, winner 5 (skips if the player wins first)'
    },
    pairs: {
      A: 'Pocket Aces: Until you play again, opponent must play 10 or above',
      2: 'Pair Pair: Opponent draws 2 extra (4 total)',
      3: 'Feeling Off: Until you play again, opponent must play odd numbers',
      4: 'Half the Cards: Until you play again, opponent cannot play 8 or above',
      5: 'Medium Rare: Return first 5 played to hand, take a random card from discard pile',
      6: 'Devilish Stare: Opponent draws 1 next turn',
      7: 'Double Luck: Look at top card, replace one of yours, reshuffle',
      8: 'Good Fortune: Play again and set discard',
      9: 'Fort: Only pairs or better can play until destroyed or your next turn; draw 1 if no pair',
      10: 'Feeling Right: Until you play again, opponent must play even numbers',
      J: 'High Card: Until you play again, opponent must play 8 or above',
      Q: 'Complaint: Opponent draws 1, you pick a card to discard next turn',
      K: 'I am your Father: Until you play again, opponent alternates even/odd (K/J odd)'
    }
  };

  if (method === 'GET') {
    if (!game.players[0].hand.length) {
      game.players[0].hand = dealHand(8);
      game.players[1].hand = dealHand(8);
    }
    if (!game.discard && game.deck.length) game.discard = game.deck.shift();
    game.canPlay = game.players[game.turn].hand.some(card => isValidPlay([card], game.discard));
  }

  if (method === 'POST') {
    const { move, reset, addCards } = query;
    if (reset === 'true') {
      game = {
        deck: shuffle([...deck]),
        discard: game.deck.length ? game.deck.shift() : null,
        discardPile: [],
        players: [{ hand: dealHand(8), ruler: null }, { hand: dealHand(8), ruler: null }],
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
        wins: [0, 0]
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
            game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn: Set discard!`;
          } else {
            const playerIdx = target === 'A' ? 0 : 1;
            const deckIdx = game.deck.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (deckIdx !== -1) {
              game.players[playerIdx].hand.push(game.deck.splice(deckIdx, 1)[0]);
            } else {
              game.players[playerIdx].hand.push({ rank: validRank, suit });
            }
            game.moveHistory.unshift(`Added ${card.rank}${suit[0]} to Player ${target}`);
            game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn: Added card!`;
          }
          if (game.moveHistory.length > 3) game.moveHistory.pop();
        }
      }
    } else if (move === 'draw') {
      const drawCount = game.fortActive && game.turn !== game.pairEffectOwner ? 2 : (game.fortActive ? 1 : 2);
      const actualDraw = Math.min(drawCount, game.deck.length);
      game.players[game.turn].hand.push(...game.deck.splice(0, actualDraw));
      game.moveHistory.unshift(`Player ${game.turn ? 'B' : 'A'} drew ${actualDraw}${game.fortActive && game.turn !== game.pairEffectOwner ? ' (fort)' : ''}`);
      game.turn = 1 - game.turn;
      game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn!`;
    } else if (move) {
      const cardStrings = move.split(',');
      const cards = cardStrings.map(cs => {
        const [rank, suitChar] = [cs.slice(0, -1), cs.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        return suit && ranks.includes(rank) ? { rank, suit } : null;
      }).filter(c => c);
      const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
      const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
      const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r));

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
              game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn: Pick your ruler!`;
            } else {
              game.discard = game.deck.length ? game.deck.shift() : null;
              game.phase = 'play';
              game.turn = 1 - game.turn;
              game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn!`;
              game.moveHistory = [`Player ${game.turn ? 'B' : 'A'} set ruler ${game.players[1 - game.turn].ruler.rank}${game.players[1 - game.turn].ruler.suit[0]}`];
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
          const playerRuler = game.players[game.turn].ruler;
          const rulerRank = playerRuler ? playerRuler.rank : null;

          // Play type
          const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
          const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || (cards.length === 5 && values.join(',') === '1,10,11,12,13');
          const isFlush = cards.every(c => c.suit === cards[0].suit);
          const allEven = cards.every(c => rankValue(c.rank) % 2 === 0);
          game.lastPlayType = cards.length === 1 ? 'single' :
                             (isPair ? 'pair' :
                             (isToaK ? 'three of a kind' :
                             (cards.length === 4 && cards.every(c => c.rank === cards[0].rank) ? 'four of a kind' :
                             (rulerRank === '10' && allEven ? 'even stack' :
                             (isStraight ? 'straight' : (isFlush ? 'flush' : 'multi'))))));
          game.lastPlayCount = cards.length;

          // Ruler Abilities
          let rulerEffectMessage = null;
          const opponentIdx = 1 - game.turn;
          if (cards.length === 1) {
            const cardRank = cards[0].rank;
            if ((rulerRank === '2' || (rulerRank === 'K' && opponentRank === '2')) && isPair) {
              const draw2 = Math.min(2, game.deck.length);
              if (draw2 > 0) {
                game.players[opponentIdx].hand.push(...game.deck.splice(0, draw2));
                rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${draw2} (Ruler 2: Twice the Might)`;
              }
            }
            if ((rulerRank === '3' || (rulerRank === 'K' && opponentRank === '3')) && cardRank === '7') {
              const draw3 = Math.min(2, game.deck.length);
              if (draw3 > 0) {
                game.players[opponentIdx].hand.push(...game.deck.splice(0, draw3));
                rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${draw3} (Ruler 3: Lucky Clover)`;
              }
            }
            if ((rulerRank === '6' || (rulerRank === 'K' && opponentRank === '6')) && cardRank === '6') {
              const opponentHandSize = game.players[opponentIdx].hand.length;
              const drawTo7 = Math.max(0, 7 - opponentHandSize);
              const actualDraw = Math.min(drawTo7, game.deck.length);
              if (actualDraw > 0) {
                game.players[opponentIdx].hand.push(...game.deck.splice(0, actualDraw));
                rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${actualDraw} (Ruler 6: Nightmare)`;
              }
            }
            if ((rulerRank === '7' || (rulerRank === 'K' && opponentRank === '7')) && cardRank === '3') {
              const draw7 = Math.min(2, game.deck.length);
              if (draw7 > 0) {
                game.players[opponentIdx].hand.push(...game.deck.splice(0, draw7));
                rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${draw7} (Ruler 7: Lucky Spin)`;
              }
            }
            if ((rulerRank === '8' || (rulerRank === 'K' && opponentRank === '8')) && cardRank === '8' && game.players[opponentIdx].hand.length <= 3) {
              const draw8 = Math.min(2, game.deck.length);
              if (draw8 > 0) {
                game.players[opponentIdx].hand.push(...game.deck.splice(0, draw8));
                rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${draw8} (Ruler 8: Seeing Red)`;
              }
            }
            if ((rulerRank === '9' || (rulerRank === 'K' && opponentRank === '9')) && cardRank === '9' && game.players[game.turn].hand.length > 5) {
              const discardCount = game.players[game.turn].hand.length - 5;
              game.discardPile.push(...game.players[game.turn].hand.splice(0, discardCount));
              rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} discarded to 5 (Ruler 9: Reverse Nightmare)`;
            }
            if ((rulerRank === 'Q' || (rulerRank === 'K' && opponentRank === 'Q')) && cardRank === 'K') {
              const drawQ = Math.min(1, game.deck.length);
              if (drawQ > 0) {
                game.players[opponentIdx].hand.push(...game.deck.splice(0, drawQ));
                rulerEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${drawQ} (Ruler Q: Ruler’s Touch)`;
              }
            }
            if (rulerEffectMessage) game.moveHistory.unshift(rulerEffectMessage);
          }

          // Multi-card Ruler Abilities
          if (cards.length === 4 && cards.every(c => c.rank === cards[0].rank) && (rulerRank === '4' || (rulerRank === 'K' && opponentRank === '4'))) {
            game.deck.push(...game.discardPile, ...game.players[0].hand, ...game.players[1].hand);
            game.discardPile = [];
            game.players[0].hand = [];
            game.players[1].hand = [];
            shuffle(game.deck);
            const opponentDraw = Math.min(7, game.deck.length);
            game.players[opponentIdx].hand.push(...game.deck.splice(0, opponentDraw));
            const playerDraw = Math.min(3, game.deck.length);
            game.players[game.turn].hand.push(...game.deck.splice(0, playerDraw));
            rulerEffectMessage = `Ruler 4: Fourfold - Reshuffled, opponent drew ${opponentDraw}, player drew ${playerDraw}`;
            game.moveHistory.unshift(rulerEffectMessage);
          }

          // Pair Abilities
          let pairEffectMessage = null;
          let defaultDrawMessage = null;
          if (isPair) {
            const defaultDraw = Math.min(2, game.deck.length);
            if (defaultDraw > 0) {
              game.players[opponentIdx].hand.push(...game.deck.splice(0, defaultDraw));
              defaultDrawMessage = `Player ${game.turn ? 'B' : 'A'} drew ${defaultDraw} (Pair Default)`;
            }
            game.pairEffect = cards[0].rank;
            game.pairEffectOwner = game.turn;
            switch (cards[0].rank) {
              case 'A': pairEffectMessage = 'Pair A: Opponent must play 10+'; break;
              case '2':
                const draw2 = Math.min(2, game.deck.length);
                if (draw2 > 0) {
                  game.players[opponentIdx].hand.push(...game.deck.splice(0, draw2));
                  pairEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${draw2} (Pair 2: Pair Pair)`;
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
                }
                break;
              case '6':
                const draw6 = Math.min(1, game.deck.length);
                if (draw6 > 0) {
                  game.players[opponentIdx].hand.push(...game.deck.splice(0, draw6));
                  pairEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${draw6} (Pair 6: Devilish Stare)`;
                }
                break;
              case '7':
                if (game.deck.length > 0) {
                  const card1 = game.deck.shift();
                  const replaceIdx = Math.floor(Math.random() * game.players[game.turn].hand.length);
                  game.deck.push(game.players[game.turn].hand.splice(replaceIdx, 1)[0]);
                  game.players[game.turn].hand.push(card1);
                  shuffle(game.deck);
                  pairEffectMessage = 'Pair 7: Replaced a card';
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
                  pairEffectMessage = `Player ${game.turn ? 'B' : 'A'} drew ${qDraw} (Pair Q: Complaint)`;
                  game.extraTurn = true;
                }
                break;
              case 'K': pairEffectMessage = 'Pair K: Opponent alternates even/odd'; break;
            }
            if (defaultDrawMessage) game.moveHistory.unshift(defaultDrawMessage);
            if (pairEffectMessage) game.moveHistory.unshift(pairEffectMessage);
          }

          // ToaK
          if (isToaK) {
            if (cards[0].rank === 'A') {
              const aceDraw = Math.min(8, game.deck.length);
              game.players[opponentIdx].hand.push(...game.deck.splice(0, aceDraw));
              game.moveHistory.unshift(`Player ${game.turn ? 'B' : 'A'} drew ${aceDraw} (ToaK Aces)`);
            } else {
              game.fortActive = true;
              game.fortCard = cards[0];
              game.fortRank = cards[0].rank;
              game.moveHistory.unshift(`ToaK ${cards[0].rank}: Fort created`);
            }
          }

          // Fort Logic
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
          const playMessage = `Player ${game.turn ? 'B' : 'A'} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}${effectName ? ` (${effectName})` : ''}`;
          game.moveHistory.unshift(playMessage);
          if (game.moveHistory.length > 3) game.moveHistory.pop();

          if (game.players[game.turn].hand.length === 0) {
            game.wins[game.turn]++;
            if ((rulerRank === 'K' || (rulerRank === 'A' && rulerSuit === 'Clubs')) && game.wins[game.turn] === 1) {
              game.deck.push(...game.discardPile);
              game.discardPile = [];
              shuffle(game.deck);
              game.players[opponentIdx].hand = dealHand(7);
              game.players[game.turn].hand = dealHand(5);
              game.phase = 'play';
              game.status = `Player ${game.turn ? 'B' : 'A'} wins! Replay with ${rulerRank === 'K' ? 'Ruler K' : 'Ace-Clubs'}!`;
            } else {
              game.status = `Player ${game.turn ? 'B' : 'A'} wins! Reset to continue.`;
              game.phase = 'over';
            }
          } else if (game.extraTurn && (cards[0].rank === '8' || cards[0].rank === 'Q') && isPair) {
            game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn: ${cards[0].rank === '8' ? 'Play again and set discard!' : 'Pick a card to discard!'}`;
            game.extraTurn = false;
          } else {
            game.turn = 1 - game.turn;
            game.status = `Player ${game.turn ? 'B' : 'A'}\'s turn!`;
          }
        }
      }
    }
    game.canPlay = game.players[game.turn].hand.some(card => isValidPlay([card], game.discard));
  }

  gameStates[sessionId] = game;

  res.status(200).json({
    discard: game.discard ? `${game.discard.rank}${game.discard.suit[0]}` : 'None',
    playerAHand: game.players[0].hand,
    playerBHand: game.players[1].hand,
    playerARuler: game.players[0].ruler ? `${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}` : 'None',
    playerBRuler: game.players[1].ruler ? `${game.players[1].ruler.rank}${game.players[1].ruler.suit[0]}` : 'None',
    status: game.status,
    phase: game.phase,
    turn: game.turn ? 'B' : 'A',
    session: sessionId,
    moveHistory: game.moveHistory,
    canPlay: game.canPlay,
    pairEffect: game.pairEffect,
    fortActive: game.fortActive,
    fortRank: game.fortRank,
    deckSize: game.deck.length
  });
}

module.exports = handler;
