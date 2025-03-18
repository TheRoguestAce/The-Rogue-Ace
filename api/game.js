const gameStates = {};

function handler(req, res) {
  try {
    const { method, query } = req;
    const playerCount = parseInt(query.players) || 2; // Default to 2 players, adjustable via query
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
        players: Array(playerCount).fill().map(() => ({ hand: [], ruler: null })),
        turn: 0,
        phase: 'setup',
        status: 'Developer Mode: Pick your ruler or add cards!',
        moveHistory: [],
        wins: Array(playerCount).fill(0),
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
        pair6Pending: false,
        pair6Target: null,
        pair7Pending: false,
        pair7DeckChoice: null,
        pair7HandChoice: null
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

    function rankValue(r) {
      return { A: 1, J: 11, Q: 12, K: 13, '10': 10 }[r] || parseInt(r);
    }

    function isEven(r) {
      const value = rankValue(r);
      return value % 2 === 0 || (r === 'Q');
    }

    function isValidPlay(cards, top) {
      if (!cards || cards.length === 0 || new Set(cards.map(c => `${c.rank}${c.suit}`)).size !== cards.length) return false;
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
        return true; // Pairs/ToaK can always play against fort
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
      if (cards.length >= 4) return (isStraight || isFlush || (allEven && cards.length >= 5) || (allOdd && cards.length >= 5)) && cards.some(c => isValidPlay([c], top));

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
        5: 'Medium Rare: Look through the top 5 cards of the discard pile and take one card from it',
        6: 'Devilish Stare: Pick one opponent to skip their next turn',
        7: 'Double Luck: Look at the next two cards in the deck. You can choose to replace one of your cards with one of those cards. Then, put the other cards on the top of the deck and shuffle the deck',
        8: 'Good Fortune: Put any one of your other cards onto the top of the discard pile. The next player will have to follow that card',
        9: 'Fort: Only pairs or better can play until destroyed, opponents draw 1 if no pair',
        10: 'Feeling Right: Opponents must play even numbers until your next play',
        J: 'High Card: Opponents must play 8+ until your next play',
        Q: 'Complaint: Opponents draw 1, you discard 1 and shuffle',
        K: 'I am your Father: Opponents alternate even/odd until your next play'
      },
      foaks: {
        A: 'Pure Destruction: Put 4 of your cards into the deck and shuffle it',
        2: 'Two’s Domain: Until you play again, everyone else has to play even numbers that are the suit of the number on top of the discard pile. If they do not have that kind of card, they have to draw 3 cards instead of 2',
        3: 'Feeling More Off: Until you play again, everyone else has to play odd numbers that are the suit of the number on top of the discard pile. If they do not have that kind of card, they have to draw 3 cards instead of 2',
        4: 'Four Fours: Everyone has to draw 5 cards instead of 4',
        5: 'A Bit Above: Until you play again, everyone else has to play numbers above 5 that are the suit of the number on top of the discard pile. If they do not have that kind of card, they have to draw 3 cards instead of 2',
        6: 'Satanic Bomb: Discard all of your cards except one',
        7: 'Crazy Luck: Look at all of the cards in the deck and trade any of your cards for any cards in the deck. After that put every card in the discard pile and the deck together, shuffle it and put the card on the top of the deck as the new discard pile',
        8: 'Crazy Fortune: Same effects as Crazy Luck',
        9: 'Feeling Weird: Until you play again, everyone else has to play perfect squares',
        10: 'Ultimate Perfection: Same effects as Feeling Weird',
        J: 'Master Servant: Until you play again, everyone has to play a queen or a king or else they have to draw 3 cards instead of 2',
        Q: 'Second to One: Until you play again, everyone has to play a king. If they don’t play a king, they don’t draw cards but you get to put one card back into the deck and shuffle the deck',
        K: 'King of All: Creates a fort that can only be destroyed by a three of a kind ace'
      }
    };

    if (method === 'GET') {
      if (!game.players[0].hand?.length) {
        game.players.forEach(player => player.hand = dealHand(8));
      }
      if (!game.discard && game.deck.length) game.discard = game.deck.shift();
    }

    if (method === 'POST') {
      const { move, reset, addCards, pair5DiscardChoice, pair5HandChoice, pair6Target, pair7DeckChoice, pair7HandChoice } = query;
      if (reset === 'true') {
        game = {
          deck: shuffle([...deck]),
          discard: null,
          discardPile: [],
          players: Array(playerCount).fill().map(() => ({ hand: dealHand(8), ruler: null })),
          turn: 0,
          phase: 'setup',
          status: 'Developer Mode: Pick your ruler or add cards!',
          moveHistory: [],
          wins: Array(playerCount).fill(0),
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
          pair6Pending: false,
          pair6Target: null,
          pair7Pending: false,
          pair7DeckChoice: null,
          pair7HandChoice: null
        };
      } else if (addCards) {
        const match = addCards.match(/^([A2-9JQK]|10)([DHSC])([A-Z])$/i);
        if (!match) {
          game.status = 'Invalid card code! Use e.g., "5D1" (Player 1), "KSD" (discard)';
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
              game.status = `Player ${game.turn + 1}'s turn: Set discard!`;
            } else {
              const playerIdx = target.charCodeAt(0) - 65;
              if (playerIdx >= 0 && playerIdx < playerCount) {
                game.players[playerIdx].hand.push(card);
                game.moveHistory.unshift(`Added ${card.rank}${suit[0]} to Player ${playerIdx + 1}`);
                game.status = `Player ${game.turn + 1}'s turn: Added card!`;
              } else {
                game.status = 'Invalid player target!';
              }
            }
            if (game.moveHistory.length > 5) game.moveHistory.pop();
          }
        }
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
          game.moveHistory.unshift(`Player ${game.turn + 1} drew ${actualDraw}${game.fortActive && game.turn !== game.fortOwner ? ' (fort)' : ''}`);
          game.status = `Player ${game.turn + 1}'s turn!`;
        } else if (game.deck.length === 0) {
          game.deck.push(...game.discardPile);
          game.discardPile = [];
          shuffle(game.deck);
          game.players[game.turn].hand.push(...game.deck.splice(0, drawCount));
          game.moveHistory.unshift(`Player ${game.turn + 1} reshuffled and drew ${drawCount}`);
          game.status = `Player ${game.turn + 1}'s turn!`;
        }
      } else if (pair5DiscardChoice && game.pair5Pending && game.turn === game.pairEffectOwner) {
        const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
        if (topFive.some(c => `${c.rank}${c.suit[0]}` === pair5DiscardChoice)) {
          game.pair5DiscardChoice = pair5DiscardChoice;
          game.status = `Player ${game.turn + 1}: Select a hand card to swap with ${pair5DiscardChoice} (?pair5HandChoice=card)`;
        }
      } else if (pair5HandChoice && game.pair5Pending && game.pair5DiscardChoice && game.turn === game.pairEffectOwner) {
        const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
        const discardIdx = topFive.findIndex(c => `${c.rank}${c.suit[0]}` === game.pair5DiscardChoice);
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair5HandChoice);
        if (discardIdx !== -1 && handIdx !== -1) {
          const discardCard = topFive[discardIdx];
          const handCard = game.players[game.turn].hand[handIdx];
          game.discardPile[game.discardPile.length - 5 + discardIdx] = handCard;
          game.players[game.turn].hand[handIdx] = discardCard;
          game.moveHistory.unshift(`Player ${game.turn + 1} swapped ${pair5HandChoice} with ${game.pair5DiscardChoice} (Pair 5)`);
          game.pair5Pending = false;
          game.pair5DiscardChoice = null;
          game.pair5HandChoice = null;
          game.status = `Player ${game.turn + 1}'s turn!`;
        }
      } else if (pair6Target && game.pair6Pending && game.turn === game.pairEffectOwner) {
        const targetIdx = parseInt(pair6Target);
        if (getOpponents(game.turn).includes(targetIdx)) {
          game.skipNext = targetIdx;
          game.moveHistory.unshift(`Player ${targetIdx + 1} will skip next turn (Pair 6)`);
          game.pair6Pending = false;
          game.pair6Target = null;
          game.status = `Player ${game.turn + 1}'s turn!`;
        }
      } else if (pair7DeckChoice && game.pair7Pending && game.turn === game.pairEffectOwner) {
        const topTwo = game.deck.slice(0, 2);
        if (topTwo.some(c => `${c.rank}${c.suit[0]}` === pair7DeckChoice)) {
          game.pair7DeckChoice = pair7DeckChoice;
          game.status = `Player ${game.turn + 1}: Select a hand card to swap with ${pair7DeckChoice} (?pair7HandChoice=card)`;
        }
      } else if (pair7HandChoice && game.pair7Pending && game.pair7DeckChoice && game.turn === game.pairEffectOwner) {
        const topTwo = game.deck.slice(0, 2);
        const deckIdx = topTwo.findIndex(c => `${c.rank}${c.suit[0]}` === game.pair7DeckChoice);
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair7HandChoice);
        if (deckIdx !== -1 && handIdx !== -1) {
          const deckCard = topTwo[deckIdx];
          const handCard = game.players[game.turn].hand[handIdx];
          game.deck[deckIdx] = handCard;
          game.players[game.turn].hand[handIdx] = deckCard;
          game.deck.push(...game.deck.splice(0, 2).filter(c => c !== deckCard));
          shuffle(game.deck);
          game.moveHistory.unshift(`Player ${game.turn + 1} swapped ${pair7HandChoice} with ${game.pair7DeckChoice} (Pair 7)`);
          game.pair7Pending = false;
          game.pair7DeckChoice = null;
          game.pair7HandChoice = null;
          game.status = `Player ${game.turn + 1}'s turn!`;
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
          const baseDraw = game.players[game.turn].ruler && game.players[game.turn].ruler.rank === '2' ? 4 : 2;
          const drawCount = game.pairEffect === '2' ? baseDraw + 1 : baseDraw;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (Pair)`);
          });
          if (rank === 'A') {
            game.pairEffect = 'A';
            game.pairEffectOwner = game.turn;
          } else if (rank === '2') {
            game.pairEffect = '2';
            game.pairEffectOwner = game.turn;
          } else if (rank === '3') {
            game.pairEffect = '3';
            game.pairEffectOwner = game.turn;
          } else if (rank === '4') {
            game.pairEffect = '4';
            game.pairEffectOwner = game.turn;
          } else if (rank === '5') {
            game.pair5Pending = true;
            game.status = `Player ${game.turn + 1}: Pick a discard pile card to swap (?pair5DiscardChoice=card)`;
          } else if (rank === '6') {
            game.pair6Pending = true;
            game.status = `Player ${game.turn + 1}: Pick an opponent to skip (?pair6Target=playerIndex)`;
          } else if (rank === '7') {
            game.pair7Pending = true;
            game.status = `Player ${game.turn + 1}: Pick a deck card to swap (?pair7DeckChoice=card)`;
          } else if (rank === '8') {
            game.extraTurn = true;
            game.moveHistory.unshift(`Player ${game.turn + 1} can set discard and play again (Pair 8)`);
          } else if (rank === '9') {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
            getOpponents(game.turn).forEach(idx => {
              if (!game.players[idx].hand.some(c => isPair || isToaK)) {
                const drawCount = Math.min(1, game.deck.length);
                game.players[idx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${idx + 1} drew ${drawCount} (Fort)`);
              }
            });
          } else if (rank === '10') {
            game.pairEffect = '10';
            game.pairEffectOwner = game.turn;
          } else if (rank === 'J') {
            game.pairEffect = 'J';
            game.pairEffectOwner = game.turn;
          } else if (rank === 'Q') {
            getOpponents(game.turn).forEach(idx => {
              const drawCount = Math.min(1, game.deck.length);
              game.players[idx].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${idx + 1} drew ${drawCount} (Pair Q)`);
            });
            game.players[game.turn].hand.pop(); // Discard one card
            if (game.deck.length > 0) game.deck.push(game.players[game.turn].hand.pop());
            shuffle(game.deck);
            game.extraTurn = true;
            game.moveHistory.unshift(`Player ${game.turn + 1} discarded 1 (Pair Q)`);
          } else if (rank === 'K') {
            game.pairEffect = 'K';
            game.pairEffectOwner = game.turn;
          }
        } else if (isToaK) {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = rank === 'A' ? 8 : 3;
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (ToaK)`);
          });
          if (rank !== 'A') {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
          }
        } else if (isFoAK) {
          getOpponents(game.turn).forEach(idx => {
            let drawCount = 4;
            if (rank === '4') drawCount = 5;
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (FoAK)`);
          });
          if (rank === 'A') {
            game.players[game.turn].hand.splice(0, 4);
            shuffle(game.deck);
            game.moveHistory.unshift(`Player ${game.turn + 1} discarded 4 cards (FoAK A)`);
          } else if (rank === '2') {
            game.pairEffect = '2';
            game.pairEffectOwner = game.turn;
          } else if (rank === '3') {
            game.pairEffect = '3';
            game.pairEffectOwner = game.turn;
          } else if (rank === '5') {
            game.pairEffect = '5';
            game.pairEffectOwner = game.turn;
          } else if (rank === '6') {
            game.players[game.turn].hand = game.players[game.turn].hand.slice(-1);
            game.moveHistory.unshift(`Player ${game.turn + 1} kept 1 card (FoAK 6)`);
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
            game.moveHistory.unshift(`Player ${game.turn + 1} swapped cards (FoAK ${rank})`);
          } else if (rank === '9') {
            game.pairEffect = '9';
            game.pairEffectOwner = game.turn;
          } else if (rank === '10') {
            game.pairEffect = '10';
            game.pairEffectOwner = game.turn;
          } else if (rank === 'J') {
            game.pairEffect = 'J';
            game.pairEffectOwner = game.turn;
          } else if (rank === 'Q') {
            game.pairEffect = 'Q';
            game.pairEffectOwner = game.turn;
            game.players[game.turn].hand.pop();
            if (game.deck.length > 0) game.deck.push(game.players[game.turn].hand.pop());
            shuffle(game.deck);
            game.moveHistory.unshift(`Player ${game.turn + 1} discarded 1 (FoAK Q)`);
          } else if (rank === 'K') {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
          }
        } else if (isStraight && cards.length >= 4) {
          const drawCount = straightLength - 2;
          getOpponents(game.turn).forEach(idx => {
            const mustPlay = values.join(',') === '1,2,3,4,5' ? ['A', '2', '3'] : (values.join(',') === '10,11,12,13' ? ['J', 'Q', 'K'] : []);
            const canPlay = game.players[idx].hand.some(c => mustPlay.includes(c.rank));
            const actualDraw = Math.min(drawCount + (values.join(',') === '1,2,3,4,5' ? 2 : values.join(',') === '10,11,12,13' ? 3 : 0), game.deck.length);
            if (!canPlay || values.join(',') === '1,2,3,4,5' || values.join(',') === '10,11,12,13') {
              game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
              game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (${values.join(',') === '1,2,3,4,5' ? 'Tiny' : values.join(',') === '10,11,12,13' ? 'Royal' : 'Straight'} Straight)`);
            }
          });
        } else if (isFlush && cards.length >= 4) {
          const drawCount = flushLength - 2;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            if (flushLength >= 5) {
              const finalDraw = Math.min(7, game.deck.length);
              game.players[idx].hand.push(...game.deck.splice(0, finalDraw));
              game.moveHistory.unshift(`Player ${idx + 1} drew ${finalDraw} (${flushLength >= 5 ? 'Tiny/Royal' : 'Flush'} Flush)`);
            } else {
              game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
              game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (Flush)`);
            }
          });
        } else if (allEven && cards.length >= 5) {
          const drawCount = cards.length - 3;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (Even Only)`);
          });
        } else if (allOdd && cards.length >= 5) {
          const drawCount = cards.length - 3;
          getOpponents(game.turn).forEach(idx => {
            const actualDraw = Math.min(drawCount, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, actualDraw));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${actualDraw} (Odd Only)`);
          });
        }

        if (rank === '6') {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = Math.max(0, 7 - game.players[idx].hand.length);
            game.players[idx].hand.push(...game.deck.splice(0, drawCount));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${drawCount} to 7 (Ruler 6)`);
          });
        } else if (rank === '8' && getOpponents(game.turn).some(idx => game.players[idx].hand.length <= 3)) {
          getOpponents(game.turn).forEach(idx => {
            const drawCount = Math.min(2, game.deck.length);
            game.players[idx].hand.push(...game.deck.splice(0, drawCount));
            game.moveHistory.unshift(`Player ${idx + 1} drew ${drawCount} (Ruler 8)`);
          });
        } else if (rank === '9') {
          getOpponents(game.turn).forEach(idx => {
            if (game.players[idx].ruler && game.players[idx].ruler.rank === '9') {
              while (game.players[game.turn].hand.length > 5 && game.deck.length > 0) {
                game.deck.push(game.players[game.turn].hand.pop());
                game.moveHistory.unshift(`Player ${game.turn + 1} discarded to 5 (Ruler 9)`);
              }
            }
          });
        } else if (rank === '3' || rank === '7') {
          if (game.players[game.turn].ruler && (game.players[game.turn].ruler.rank === '3' || game.players[game.turn].ruler.rank === '7')) {
            getOpponents(game.turn).forEach(idx => {
              const drawCount = Math.min(2, game.deck.length);
              game.players[idx].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${idx + 1} drew ${drawCount} (Ruler ${rank === '3' ? '3' : '7'})`);
            });
          }
        }

        game.moveHistory.unshift(`Player ${game.turn + 1} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
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
              game.moveHistory.unshift(`Player ${i + 1} drew ${drawCount} (Ace of Clubs)`);
            });
            const winnerDraw = Math.min(5, game.deck.length);
            game.players[game.turn].hand.push(...game.deck.splice(0, winnerDraw));
            game.moveHistory.unshift(`Player ${game.turn + 1} drew ${winnerDraw} (Ace of Clubs)`);
            game.resetTriggered = true;
            game.status = `Player ${game.turn + 1}'s turn: Ace of Clubs reset!`;
          } else if (game.players[game.turn].ruler && game.players[game.turn].ruler.rank === 'K') {
            game.players[game.turn].hand.push(...dealHand(5));
            game.status = `Player ${game.turn + 1} wins but must win again (Ruler K)!`;
          } else {
            game.status = `Player ${game.turn + 1} wins! Reset to continue.`;
          }
        } else if (game.fortActive && game.turn === game.fortOwner && !isPair && !isToaK && !isFoAK) {
          game.fortActive = false;
          game.fortCard = null;
          game.fortRank = null;
          game.fortOwner = null;
          game.moveHistory.unshift(`Fort destroyed by Player ${game.turn + 1}'s non-pair play`);
        } else {
          if (game.extraTurn) {
            game.extraTurn = false;
          } else {
            game.turn = (game.turn + 1) % playerCount; // Automatic clockwise turn advancement
            if (game.skipNext === game.turn) {
              game.moveHistory.unshift(`Player ${game.turn + 1} skipped (Pair 6)`);
              game.turn = (game.turn + 1) % playerCount;
              game.skipNext = null;
            }
          }
          game.status = `Player ${game.turn + 1}'s turn!`;
        }
      } else if (move && game.phase === 'setup' && cards.length === 1) {
        game.players[game.turn].ruler = cards[0];
        game.moveHistory.unshift(`Player ${game.turn + 1} set ruler ${cards[0].rank}${cards[0].suit[0]}`);
        game.players[game.turn].hand = game.players[game.turn].hand.filter(h => !(h.rank === cards[0].rank && h.suit === cards[0].suit));
        game.players[game.turn].hand.push(...dealHand(1));
        game.turn = (game.turn + 1) % playerCount;
        game.status = game.players.every(p => p.ruler) ? 'All rulers set! Game starts!' : `Player ${game.turn + 1}'s turn: Pick your ruler!`;
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
