const gameStates = {};

function handler(req, res) {
  try {
    const { method, query } = req;
    const playerCount = parseInt(query.players) || 2;
    const sessionId = query.session || 'default';
    console.log(`[${method}] Session: ${sessionId}, Players: ${playerCount}`);

    const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

    let game = gameStates[sessionId];
    if (!game) {
      game = {
        deck: shuffle([...deck]),
        discard: null,
        discardPile: [],
        players: Array(playerCount).fill().map(() => ({ hand: [], ruler: null, enemyAbilities: [] })),
        turn: 0,
        phase: 'setup',
        status: 'Developer Mode: Pick your ruler or add cards!',
        moveHistory: [],
        wins: Array(playerCount).fill(0),
        direction: 1, // 1 for clockwise, -1 for counterclockwise
        fortActive: false,
        fortCard: null,
        fortRank: null,
        fortOwner: null,
        pairEffect: null,
        pairEffectOwner: null,
        extraTurn: false,
        skipNext: null,
        pair5Pending: false,
        pair5DiscardChoice: null,
        pair5HandChoice: null,
        pair7Pending: false,
        pair7DeckChoice: null,
        pair7HandChoice: null,
        pair6Pending: false,
        fortChoicePending: false,
        fortChoicePlayer: null,
        resetTriggered: false,
        kingAlternation: null
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
        hand.push(...game.deck.splice(0, extraAces.length));
      }
      return hand;
    }

    function getOpponents(currentPlayer) {
      return game.players.map((_, idx) => idx).filter(idx => idx !== currentPlayer);
    }

    function getPlayerLabel(index) {
      return String.fromCharCode(65 + index);
    }

    function rankValue(r) {
      return { A: 1, J: 11, Q: 12, K: 13, '10': 10 }[r] || parseInt(r);
    }

    function isEven(r) {
      const value = rankValue(r);
      return value % 2 === 0 || (r === 'Q');
    }

    function isValidPlay(cards, top) {
      if (cards.length === 0 || new Set(cards.map(c => `${c.rank}${c.suit}`)).size !== cards.length) return false;
      const playerRuler = game.players[game.turn].ruler;
      const rulerRank = playerRuler ? playerRuler.rank : null;
      const rulerSuit = playerRuler ? playerRuler.suit : null;
      const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
      const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
      const isFoAK = cards.length === 4 && cards.every(c => c.rank === cards[0].rank);
      const topValue = top ? rankValue(top.rank) : null;

      if (!top && game.phase === 'play') {
        if ((rulerRank === 'A' && rulerSuit === 'Diamonds') && cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0 && !isPair)) return true;
        if ((rulerSuit === 'Diamonds') && cards.length === 2 && cards.some(c => c.suit === 'Diamonds') && !isPair) return true;
        if ((rulerRank === '3' || rulerRank === '7') && cards.length === 1 && (cards[0].rank === '7' || cards[0].rank === '3')) return true;
        if ((rulerRank === '10' || (rulerRank === 'A' && rulerSuit === 'Diamonds')) && cards.length >= 2 && cards.every(c => isEven(c.rank)) && !isPair) return true;
        if (cards.length >= 2 && (isPair || isToaK || isFoAK)) return true;
        return false;
      }

      if (game.fortActive && game.turn !== game.fortOwner) {
        if (!isPair && !isToaK) return false;
        if (isPair && game.fortRank) {
          const pairValue = rankValue(cards[0].rank);
          const fortValue = rankValue(game.fortRank);
          if (isToaK && pairValue <= fortValue) return false;
          return pairValue >= 2 && pairValue <= 13;
        }
        return false;
      }

      if (cards.length === 1) {
        const card = cards[0];
        const value = rankValue(card.rank);
        let matches = (card.suit[0] === top.suit[0] || card.rank === top.rank || (isEven(card.rank) === isEven(top.rank)));
        if ((rulerSuit === 'Hearts' || (rulerRank === 'A' && rulerSuit === 'Hearts')) && card.suit === 'Hearts') matches = true;
        if ((rulerSuit === 'Spades' || (rulerRank === 'A' && rulerSuit === 'Spades')) && card.suit === 'Spades') {
          const sliced = Math.floor(value / 2) || 5;
          matches = matches || (sliced === rankValue(top.rank) || (isEven(sliced) === isEven(top.rank)));
        }
        if ((rulerRank === '5' || (rulerRank === 'J')) && ['J', 'Q', 'K'].includes(card.rank)) matches = matches || rankValue(top.rank) === 5;
        if ((rulerRank === '10' || (rulerRank === 'A' && rulerSuit === 'Diamonds')) && isEven(card.rank) && isEven(top.rank)) matches = true;
        if ((rulerRank === 'J') && ['J', 'Q', 'K', 'A'].includes(card.rank)) matches = matches || ['J', 'Q', 'K', 'A'].includes(top.rank);
        if ((rulerRank === 'Q') && card.rank === 'K') matches = true;
        return matches;
      }

      if (cards.length === 2) {
        if (isPair) return cards.every(card => isValidPlay([card], top));
        if ((rulerSuit === 'Clubs') && game.players[game.turn].hand.length >= 5) return cards.every(card => isValidPlay([card], top));
        if ((rulerSuit === 'Diamonds') && cards.some(c => c.suit === 'Diamonds') && !isPair) return true;
        return false;
      }

      if (isToaK || isFoAK) return cards.every(card => isValidPlay([card], top));

      if ((rulerRank === '10' || (rulerRank === 'A' && rulerSuit === 'Diamonds')) && cards.length >= 2 && cards.every(c => isEven(c.rank)) && isEven(top.rank)) return !isPair;

      const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
      const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || values.join(',') === '1,10,11,12,13';
      const isFlush = cards.every(c => c.suit === cards[0].suit);
      const allEven = cards.every(c => isEven(c.rank));
      const allOdd = cards.every(c => !isEven(c.rank));
      if (cards.length === 5) return (isStraight || isFlush || allEven || allOdd) && cards.some(c => isValidPlay([c], top));
      if (cards.length > 5) return (isStraight || isFlush) && cards.some(c => isValidPlay([c], top));

      return false;
    }

    const rulerAbilities = {
      suits: {
        Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
        Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
        Spades: 'Sliced: Spades count as half their rank rounded down (pairs OK)',
        Clubs: 'Strike: Play two valid cards as a pair if 5+ cards in hand (3+ remain)'
      },
      ranks: {
        2: 'Twice the Might: Pairs make all opponents draw 2 extra cards',
        3: 'Lucky Clover: Play a 7 anytime, all opponents draw 2',
        4: 'Fourfold: Four of a kind reshuffles all cards, opponents draw 7, player draws 3',
        5: 'High Five: Face cards count as 5 (pairs OK)',
        6: 'Nightmare: Playing a 6 makes all opponents draw to 7 cards',
        7: 'Lucky Spin: Play a 3 anytime, all opponents draw 2',
        8: 'Seeing Red: If any opponent has ≤3 cards, 8 makes them draw 2',
        9: 'Reverse Nightmare: Any opponent’s 9s make you discard to 5 cards',
        10: 'Perfection: Play multiple even cards on an even card (no pairs)',
        J: 'Servant: J/Q/K/A count as each other (pairs OK)',
        Q: 'Ruler’s Touch: Kings are wild, opponents draw 1 (pairs OK)',
        K: 'Ruler of Rulers: Gain all other rulers’ abilities, win again if you win'
      },
      aces: {
        'A-Diamonds': 'Perfect Card: Odd non-face cards playable anytime (no pairs)',
        'A-Hearts': 'Otherworldly Touch: Hearts are wild (no pairs)',
        'A-Spades': 'Pocket Knife: All cards count as half rank rounded down (pairs OK)',
        'A-Clubs': 'Nuclear Bomb: On first win, reshuffle, opponents draw 7, winner draws 5'
      },
      pairs: {
        A: 'Pocket Aces: Opponents must play 10+ until your next play',
        2: 'Pair Pair: Opponents draw 3 instead of 2',
        3: 'Feeling Off: Opponents must play odd numbers until your next play',
        4: 'Half the Cards: Opponents cannot play 8+ until your next play',
        5: 'Medium Rare: Swap one of your cards with top 5 discard pile cards',
        6: 'Devilish Stare: Pick an opponent to skip their next turn',
        7: 'Double Luck: Swap one of your cards with top 2 deck cards',
        8: 'Good Fortune: Set discard to any of your cards, play again',
        9: 'Fort: Only pairs or better can play until destroyed, opponents draw 1 if no pair',
        10: 'Feeling Right: Opponents must play even numbers until your next play',
        J: 'High Card: Opponents must play 8+ until your next play',
        Q: 'Complaint: Opponents draw 1, you discard 1 and shuffle',
        K: 'I am your Father: Opponents alternate even/odd until your next play'
      },
      toaks: {
        A: 'Three Aces: Opponents draw 8 cards, no fort',
        'default': 'Fort: Destroy with higher pair, lower pair avoids draw, opponents draw 2 if no pair'
      },
      foaks: {
        A: 'Pure Destruction: Put 4 cards into deck and shuffle',
        2: 'Two’s Domain: Opponents must play even cards of discard suit or draw 3',
        3: 'Feeling More Off: Opponents must play odd cards of discard suit or draw 3',
        4: 'Four Fours: Opponents draw 5 instead of 4',
        5: 'A Bit Above: Opponents must play >5 cards of discard suit or draw 3',
        6: 'Satanic Bomb: Discard all but 1 card',
        7: 'Crazy Luck: Swap any card with any deck card, reshuffle all',
        8: 'Crazy Fortune: Same as Crazy Luck',
        9: 'Feeling Weird: Opponents must play perfect squares until your next play',
        10: 'Ultimate Perfection: Same as Feeling Weird',
        J: 'Master Servant: Opponents must play Q/K or draw 3',
        Q: 'Second to One: Opponents must play K or you discard 1',
        K: 'King of All: Fort destroyed only by ToaK Aces, creator discards 1'
      },
      straights: {
        tiny: 'Tiny Straight: Opponents must play A/2/3 or draw length + 2',
        royal: 'Royal Straight: Opponents must play face cards or draw length + 3'
      },
      flushes: {
        tinyRoyal: 'Tiny/Royal Flush: Opponents draw 7 (5+ cards)'
      }
    };

    if (method === 'GET') {
      if (!game.players[0].hand.length) {
        game.players.forEach(player => player.hand = dealHand(8));
      }
      if (!game.discard && game.deck.length) game.discard = game.deck.shift();
    }

    if (method === 'POST') {
      const { move, reset, addCards, enemyAbility, fortChoice, pair5DiscardChoice, pair5HandChoice, pair7DeckChoice, pair7HandChoice, pair6Target } = query;
      if (reset === 'true') {
        game = {
          deck: shuffle([...deck]),
          discard: null,
          discardPile: [],
          players: Array(playerCount).fill().map(() => ({ hand: dealHand(8), ruler: null, enemyAbilities: [] })),
          turn: 0,
          phase: 'setup',
          status: 'Developer Mode: Pick your ruler or add cards!',
          moveHistory: [],
          wins: Array(playerCount).fill(0),
          direction: 1,
          fortActive: false,
          fortCard: null,
          fortRank: null,
          fortOwner: null,
          pairEffect: null,
          pairEffectOwner: null,
          extraTurn: false,
          skipNext: null,
          pair5Pending: false,
          pair5DiscardChoice: null,
          pair5HandChoice: null,
          pair7Pending: false,
          pair7DeckChoice: null,
          pair7HandChoice: null,
          pair6Pending: false,
          fortChoicePending: false,
          fortChoicePlayer: null,
          resetTriggered: false,
          kingAlternation: null
        };
      } else if (addCards) {
        const match = addCards.match(/^([A2-9JQK]|10)([DHSC])([A-Z])$/i);
        if (!match) {
          game.status = 'Invalid card code! Use e.g., "5DA" (A), "KSD" (discard)';
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
              game.discardPile.push(game.discard);
              game.discard = card;
              game.moveHistory.unshift(`Set ${card.rank}${suit[0]} as discard`);
              game.status = `Player ${getPlayerLabel(game.turn)}\'s turn: Set discard!`;
            } else {
              const playerIdx = target.charCodeAt(0) - 65;
              if (playerIdx >= 0 && playerIdx < playerCount) {
                game.players[playerIdx].hand.push(card);
                game.moveHistory.unshift(`Added ${card.rank}${suit[0]} to Player ${target}`);
                game.status = `Player ${getPlayerLabel(game.turn)}\'s turn: Added card!`;
              } else {
                game.status = 'Invalid player target!';
              }
            }
            if (game.moveHistory.length > 5) game.moveHistory.pop();
          }
        }
      } else if (enemyAbility) {
        game.players[game.turn].enemyAbilities.push(enemyAbility);
        game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} added enemy ability: ${enemyAbility}`);
        game.status = `Player ${getPlayerLabel(game.turn)}\'s turn: Added enemy ability!`;
        if (game.moveHistory.length > 5) game.moveHistory.pop();
      } else if (move === 'draw' && game.phase === 'play') {
        const drawCount = game.fortActive && game.turn !== game.fortOwner ? 1 : 2;
        if (game.deck.length === 0 && game.discardPile.length === 0) {
          game.players.forEach((_, idx) => {
            if (idx !== game.turn) {
              const card = game.players[idx].hand.pop();
              if (card) game.deck.push(card);
            }
          });
          shuffle(game.deck);
        }
        const actualDraw = Math.min(drawCount, game.deck.length);
        if (actualDraw > 0) {
          game.players[game.turn].hand.push(...game.deck.splice(0, actualDraw));
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} drew ${actualDraw}${game.fortActive && game.turn !== game.fortOwner ? ' (fort)' : ''}`);
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        } else if (game.deck.length === 0) {
          game.deck.push(...game.discardPile);
          game.discardPile = [];
          shuffle(game.deck);
          game.players[game.turn].hand.push(...game.deck.splice(0, drawCount));
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} reshuffled and drew ${drawCount}`);
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        }
      } else if (pair5DiscardChoice && game.pair5Pending) {
        const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
        if (topFive.some(c => `${c.rank}${c.suit[0]}` === pair5DiscardChoice)) {
          game.pair5DiscardChoice = pair5DiscardChoice;
          game.status = `Player ${getPlayerLabel(game.turn)}: Select a hand card to swap with ${pair5DiscardChoice}`;
        }
      } else if (pair5HandChoice && game.pair5Pending && game.pair5DiscardChoice) {
        const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
        const discardIdx = topFive.findIndex(c => `${c.rank}${c.suit[0]}` === game.pair5DiscardChoice);
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair5HandChoice);
        if (discardIdx !== -1 && handIdx !== -1) {
          const discardCard = topFive[discardIdx];
          const handCard = game.players[game.turn].hand[handIdx];
          game.discardPile[game.discardPile.length - 5 + discardIdx] = handCard;
          game.players[game.turn].hand[handIdx] = discardCard;
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} swapped ${pair5HandChoice} with ${game.pair5DiscardChoice} (Pair 5)`);
          game.pair5Pending = false;
          game.pair5DiscardChoice = null;
          game.pair5HandChoice = null;
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        }
      } else if (pair7DeckChoice && game.pair7Pending) {
        const topTwo = game.deck.slice(0, 2);
        if (topTwo.some(c => `${c.rank}${c.suit[0]}` === pair7DeckChoice)) {
          game.pair7DeckChoice = pair7DeckChoice;
          game.status = `Player ${getPlayerLabel(game.turn)}: Select a hand card to swap with ${pair7DeckChoice}`;
        }
      } else if (pair7HandChoice && game.pair7Pending && game.pair7DeckChoice) {
        const topTwo = game.deck.slice(0, 2);
        const deckIdx = topTwo.findIndex(c => `${c.rank}${c.suit[0]}` === game.pair7DeckChoice);
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair7HandChoice);
        if (deckIdx !== -1 && handIdx !== -1) {
          const deckCard = topTwo[deckIdx];
          const handCard = game.players[game.turn].hand[handIdx];
          game.deck[deckIdx] = handCard;
          game.players[game.turn].hand[handIdx] = deckCard;
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} swapped ${pair7HandChoice} with ${game.pair7DeckChoice} (Pair 7)`);
          game.pair7Pending = false;
          game.pair7DeckChoice = null;
          game.pair7HandChoice = null;
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        }
      } else if (pair6Target && game.pair6Pending) {
        const targetIdx = parseInt(pair6Target);
        if (getOpponents(game.turn).includes(targetIdx)) {
          game.skipNext = targetIdx;
          game.moveHistory.unshift(`Player ${getPlayerLabel(targetIdx)} will skip next turn (Pair 6)`);
          game.pair6Pending = false;
          game.extraTurn = false;
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        }
      } else if (fortChoice) {
        if (game.fortChoicePending && game.turn === game.fortChoicePlayer) {
          if (fortChoice === 'continue') {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} chose to continue fort`);
          } else if (fortChoice === 'destroy') {
            game.fortActive = false;
            game.fortCard = null;
            game.fortRank = null;
            game.fortOwner = null;
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} destroyed fort`);
          }
          game.fortChoicePending = false;
          game.fortChoicePlayer = null;
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        }
      } else if (move && game.phase === 'play' && isValidPlay(move.split(',').map(c => {
        const rank = c.length === 3 ? c.slice(0, 2) : c[0];
        const suitChar = c.length === 3 ? c[2] : c[1];
        return { rank: rank === '10' ? '10' : ranks.find(r => r === rank.toUpperCase()), suit: suits.find(s => s[0] === suitChar.toUpperCase()) };
      }), game.discard)) {
        const cards = move.split(',').map(c => {
          const rank = c.length === 3 ? c.slice(0, 2) : c[0];
          const suitChar = c.length === 3 ? c[2] : c[1];
          return { rank: rank === '10' ? '10' : ranks.find(r => r === rank.toUpperCase()), suit: suits.find(s => s[0] === suitChar.toUpperCase()) };
        });
        game.players[game.turn].hand = game.players[game.turn].hand.filter(h => !cards.some(c => c.rank === h.rank && c.suit === h.suit));
        game.discardPile.push(game.discard);
        game.discard = cards[0];
        const rank = cards[0].rank;
        const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
        const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
        const isFoAK = cards.length === 4 && cards.every(c => c.rank === cards[0].rank);
        const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
        const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || values.join(',') === '1,10,11,12,13';
        const isFlush = cards.every(c => c.suit === cards[0].suit);
        const allEven = cards.every(c => isEven(c.rank));
        const allOdd = cards.every(c => !isEven(c.rank));
        const straightLength = values.length;
        const flushLength = cards.length;

        if (isPair) {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = game.pairEffect === '2' ? 3 : 2;
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (Pair)`);
          });
          if (rank === '5') {
            game.pair5Pending = true;
            game.status = `Player ${getPlayerLabel(game.turn)}: Pick a discard pile card to swap (?pair5DiscardChoice=card)`;
          } else if (rank === '6') {
            game.pair6Pending = true;
            game.status = `Player ${getPlayerLabel(game.turn)}: Pick an opponent to skip (?pair6Target=playerIndex)`;
          } else if (rank === '7') {
            game.pair7Pending = true;
            game.status = `Player ${getPlayerLabel(game.turn)}: Pick a deck card to swap (?pair7DeckChoice=card)`;
          } else if (rank === '8') {
            game.extraTurn = true;
            game.status = `Player ${getPlayerLabel(game.turn)}: Play again and set discard (Pair 8)`;
          } else if (rank === '9') {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
            getOpponents(game.turn).forEach(idx => {
              if (!game.players[idx].hand.some(c => isValidPlay([c], game.discard))) {
                const drawCount = Math.min(1, game.deck.length);
                game.players[idx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} (Fort)`);
              }
            });
          } else if (rank === 'Q') {
            getOpponents(game.turn).forEach(idx => {
              const drawCount = Math.min(1, game.deck.length);
              game.players[idx].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} (Pair Q)`);
            });
            game.extraTurn = true;
            game.status = `Player ${getPlayerLabel(game.turn)}: Play again and set discard (Pair Q)`;
          }
          game.pairEffect = rank;
          game.pairEffectOwner = game.turn;
        } else if (isToaK) {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = rank === 'A' ? 8 : 3;
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (ToaK)`);
          });
          if (rank !== 'A') {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
          }
        } else if (isFoAK) {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = rank === '4' ? 5 : 4;
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, drawCount));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (FoAK)`);
          });
          if (rank === 'A') {
            game.players[game.turn].hand.splice(0, 4);
            shuffle(game.deck);
          } else if (rank === '6') {
            game.players[game.turn].hand = game.players[game.turn].hand.slice(-1);
          } else if (rank === '7' || rank === '8') {
            const deckCards = [...game.deck];
            game.players[game.turn].hand = game.players[game.turn].hand.filter(c => {
              const idx = Math.floor(Math.random() * deckCards.length);
              [deckCards[idx], c] = [c, deckCards[idx]];
              return false;
            });
            game.deck = deckCards;
            game.discardPile.push(...game.deck);
            game.deck = [];
            game.discard = game.players[game.turn].hand.pop() || game.discard;
            shuffle(game.deck);
          } else if (rank === 'Q') {
            game.players[game.turn].hand.pop();
            shuffle(game.deck);
          } else if (rank === 'K') {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
          }
          game.pairEffect = rank;
          game.pairEffectOwner = game.turn;
        } else if (isStraight && cards.length >= 5) {
          const drawCount = (values[values.length - 1] - values[0] + 1) - 2;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount + (values.join(',') === '1,10,11,12,13' ? 3 : 2), game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (${values.join(',') === '1,10,11,12,13' ? 'Royal' : 'Tiny'} Straight)`);
          });
        } else if (isFlush && cards.length >= 5) {
          const drawCount = cards.length === 5 ? 7 : cards.length - 2;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (${cards.length >= 5 ? 'Tiny/Royal Flush' : 'Flush'})`);
          });
        } else if (allEven && cards.length >= 5) {
          const drawCount = cards.length - 3;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (Even Only)`);
          });
        } else if (allOdd && cards.length >= 5) {
          const drawCount = cards.length - 3;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, drawCount));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${actualDraw} (Odd Only)`);
          });
        }

        if (rank === '6') {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = Math.max(0, 7 - game.players[idx].hand.length);
            game.players[idx].hand.push(...game.deck.splice(0, drawCount));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} to 7 (Ruler 6)`);
          });
        } else if (rank === '8' && getOpponents(game.turn).some(idx => game.players[idx].hand.length <= 3)) {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = Math.min(2, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, drawCount));
            game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} (Ruler 8)`);
          });
        } else if (rank === '9') {
          getOpponents(game.turn).forEach(idx => {
            if (game.players[idx].ruler && game.players[idx].ruler.rank === '9') {
              while (game.players[game.turn].hand.length > 5 && game.deck.length > 0) {
                game.deck.push(game.players[game.turn].hand.pop());
                game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} discarded to 5 (Ruler 9)`);
              }
            }
          });
        }

        game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
        if (game.players[game.turn].hand.length === 0) {
          game.wins[game.turn]++;
          if (!game.resetTriggered && game.players[game.turn].ruler && game.players[game.turn].ruler.rank === 'A' && game.players[game.turn].ruler.suit === 'Clubs') {
            game.deck.push(...game.discardPile, game.discard);
            game.discardPile = [];
            game.discard = null;
            shuffle(game.deck);
            getOpponents(game.turn).forEach(i => {
              const drawCount = Math.min(7, game.deck.length);
              game.players[i].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${getPlayerLabel(i)} drew ${drawCount} (Ace of Clubs)`);
            });
            const winnerDraw = Math.min(5, game.deck.length);
            game.players[game.turn].hand.push(...game.deck.splice(0, winnerDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} drew ${winnerDraw} (Ace of Clubs)`);
            game.resetTriggered = true;
            game.status = `Player ${getPlayerLabel(game.turn)}\'s turn: Ace of Clubs reset!`;
          } else if (game.players[game.turn].ruler && game.players[game.turn].ruler.rank === 'K') {
            game.players[game.turn].hand.push(...dealHand(5));
            game.status = `Player ${getPlayerLabel(game.turn)} wins but must win again (Ruler K)!`;
          } else {
            game.status = `Player ${getPlayerLabel(game.turn)} wins! Reset to continue.`;
          }
        } else if (game.fortActive && game.turn === game.fortOwner && !isPair && !isToaK && !isFoAK) {
          game.fortActive = false;
          game.fortCard = null;
          game.fortRank = null;
          game.fortOwner = null;
          game.moveHistory.unshift(`Fort destroyed by ${getPlayerLabel(game.turn)}'s non-pair play`);
        } else {
          game.turn = (game.turn + game.direction + playerCount) % playerCount;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            game.turn = (game.turn + game.direction + playerCount) % playerCount;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
        }
      } else if (move && game.phase === 'setup' && cards.length === 1) {
        game.players[game.turn].ruler = cards[0];
        game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} set ruler ${cards[0].rank}${cards[0].suit[0]}`);
        game.players[game.turn].hand = game.players[game.turn].hand.filter(h => !(h.rank === cards[0].rank && h.suit === cards[0].suit));
        game.players[game.turn].hand.push(...dealHand(1));
        game.turn = (game.turn + game.direction + playerCount) % playerCount;
        game.status = game.players.every(p => p.ruler) ? 'All rulers set! Game starts!' : `Player ${getPlayerLabel(game.turn)}\'s turn: Pick your ruler!`;
        if (game.players.every(p => p.ruler)) game.phase = 'play';
      } else {
        game.status = 'Invalid play!';
      }
    }

    res.status(200).json({ ...game, opponents: getOpponents(game.turn) });
  } catch (error) {
    console.error('Error in handler:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

module.exports = handler;
