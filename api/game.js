const gameStates = {};

function handler(req, res) {
  try {
    const { method, query } = req;
    const sessionId = query.session || 'default';
    const playerCount = parseInt(query.players) || 2;
    console.log(`[${method}] Session: ${sessionId}, Players: ${playerCount}`);

    const suits = ['Diamonds', 'Hearts', 'Spades', 'Clubs'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const deck = suits.flatMap(suit => ranks.map(rank => ({ suit, rank })));

    let game = gameStates[sessionId];
    if (!game) {
      console.log(`Creating new game state for session ${sessionId}`);
      game = {
        deck: shuffle([...deck]),
        discard: null,
        discardPile: [],
        players: Array(playerCount).fill().map(() => ({ hand: [], ruler: null })),
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
        fortOwner: null,
        extraTurn: false,
        skipNext: null,
        wins: Array(playerCount).fill(0),
        fortChoicePending: false,
        fortChoicePlayer: null,
        pair5Pending: false,
        pair5DiscardChoice: null,
        pair5HandChoice: null,
        pair7Pending: false,
        pair7DeckChoice: null,
        pair7HandChoice: null,
        pair6Pending: false,
        resetTriggered: false,
        kingAlternation: null
      };
      gameStates[sessionId] = game;
    } else {
      console.log(`Using existing game state for session ${sessionId}: Phase=${game.phase}, Turn=${game.turn}`);
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

    function getActiveEffectName() {
      if (!game.pairEffect || game.turn === game.pairEffectOwner) return '';
      return rulerAbilities.pairs[game.pairEffect].split(':')[0];
    }

    function getOpponents(currentPlayer) {
      return game.players.map((_, idx) => idx).filter(idx => idx !== currentPlayer);
    }

    function getPlayerLabel(index) {
      return String.fromCharCode(65 + index);
    }

    function hasDuplicateCards(cards) {
      const seen = new Set();
      for (const card of cards) {
        const cardStr = `${card.rank}${card.suit}`;
        if (seen.has(cardStr)) return true;
        seen.add(cardStr);
      }
      return false;
    }

    function hasDuplicateRanks(cards) {
      const ranks = cards.map(c => c.rank);
      const rankSet = new Set(ranks);
      return rankSet.size !== ranks.length;
    }

    function isValidPlay(cards, top) {
      if (cards.length === 0 || hasDuplicateCards(cards)) {
        console.log('Invalid play: Empty or duplicate cards');
        return false;
      }
      console.log('isValidPlay called with cards:', cards, 'top:', top);

      const rankValue = r => ({ A: 1, J: 11, Q: 12, K: 13, '0': 13 }[r] || parseInt(r));
      const isEven = r => rankValue(r) % 2 === 0;
      const playerRuler = game.players[game.turn].ruler;
      const rulerRank = playerRuler ? playerRuler.rank : null;
      const rulerSuit = playerRuler ? playerRuler.suit : null;
      const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
      const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
      const topValue = top ? rankValue(top.rank) : 0;
      const kingRuler = game.players[game.turn].ruler && game.players[game.turn].ruler.rank === 'K';

      const baseMatch = (card, top) => {
        if (!top) return false;
        const value = rankValue(card.rank);
        const topVal = rankValue(top.rank);
        let slicedValue = null;
        if ((rulerSuit === 'Spades' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Spades'))) && card.suit === 'Spades') {
          slicedValue = Math.ceil(value / 2) - 1;
          slicedValue = slicedValue === 0 ? 13 : slicedValue;
        }
        const matches = (
          card.suit === top.suit ||
          card.rank === top.rank ||
          (value % 2 === topVal % 2) ||
          (slicedValue !== null && (slicedValue === topVal || slicedValue % 2 === topVal % 2))
        );
        console.log(`BaseMatch: ${card.rank}${card.suit} on ${top.rank}${top.suit} - Suit=${card.suit === top.suit}, Rank=${card.rank === top.rank}, Even/Odd=${value % 2 === topVal % 2}, Sliced=${slicedValue !== null ? slicedValue : 'N/A'}, Matches=${matches}`);
        return matches;
      };

      if (!top && game.phase === 'play') {
        console.log('Empty pile check');
        if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'A' && p.ruler.suit === 'Diamonds'))) {
          if (cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0 && !isPair)) {
            console.log('Valid: Ace of Diamonds allows odd non-face cards');
            return true;
          }
        }
        if ((rulerSuit === 'Diamonds' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Diamonds'))) && cards.length === 2 && cards.some(c => c.suit === 'Diamonds') && !isPair) {
          console.log('Valid: Diamond Storm allows diamond + another card');
          return true;
        }
        if ((rulerRank === '3' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === '3'))) && cards.length === 1 && cards[0].rank === '7') {
          console.log('Valid: Ruler 3 allows playing a 7');
          return true;
        }
        if ((rulerRank === '7' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === '7'))) && cards.length === 1 && cards[0].rank === '3') {
          console.log('Valid: Ruler 7 allows playing a 3');
          return true;
        }
        if ((rulerRank === '10' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === '10'))) && cards.length >= 2 && cards.every(c => isEven(c.rank))) {
          console.log('Valid: Ruler 10 allows multiple even cards');
          return !isPair;
        }
        if (cards.length >= 2 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank)) {
          console.log('Valid: Pair/ToaK/Four of a kind on empty pile');
          return true;
        }
        console.log('Invalid: No special rule applies for empty pile');
        return false;
      }

      if (game.fortActive && game.turn !== game.fortOwner) {
        if (!isPair && !isToaK) {
          console.log('Invalid: Fort requires pairs or ToaK');
          return false;
        }
        if (isPair && game.fortRank) {
          const fortValue = rankValue(game.fortRank);
          const pairValue = rankValue(cards[0].rank);
          console.log(`Fort check: Pair ${pairValue} vs Fort ${fortValue}`);
          if (pairValue > fortValue && game.turn !== game.fortOwner) {
            game.fortChoicePending = true;
            game.fortChoicePlayer = game.turn;
            game.status = `Player ${getPlayerLabel(game.turn)}: Fort pair ${cards[0].rank} > ${game.fortRank}. ?fortChoice=continue or ?fortChoice=destroy`;
            return true;
          }
          return pairValue >= 2 && pairValue <= 13;
        }
        return false;
      }

      if (game.pairEffect && game.turn !== game.pairEffectOwner) {
        const checkValue = c => {
          let value = rankValue(c.rank);
          if (((rulerSuit === 'Hearts' && c.suit === 'Hearts') || (rulerRank === 'A' && rulerSuit === 'Hearts')) && rulerRank !== 'A') value = rankValue(rulerRank);
          if ((rulerRank === 'Q' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'Q'))) && c.rank === 'K') value = topValue;
          if ((rulerSuit === 'Spades' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Spades'))) && c.suit === 'Spades') {
            const sliced = Math.ceil(value / 2) - 1;
            value = sliced === 0 ? 13 : sliced;
          }
          return value;
        };
        const values = cards.map(checkValue);
        if (game.pairEffect === 'A' && values.some(v => v < 10)) {
          console.log('Invalid: Pair A requires 10 or above');
          return false;
        }
        if (game.pairEffect === '3' && values.some(v => v % 2 === 0)) {
          console.log('Invalid: Pair 3 requires odd numbers');
          return false;
        }
        if (game.pairEffect === '4' && values.some(v => v >= 8)) {
          console.log('Invalid: Pair 4 prohibits 8 or above');
          return false;
        }
        if (game.pairEffect === '10' && values.some(v => v % 2 !== 0)) {
          console.log('Invalid: Pair 10 requires even numbers');
          return false;
        }
        if (game.pairEffect === 'J' && values.some(v => v < 8)) {
          console.log('Invalid: Pair J requires 8 or above');
          return false;
        }
        if (game.pairEffect === 'K') {
          const expectedEven = game.kingAlternation === null ? true : game.kingAlternation;
          const isValid = expectedEven ? values.every(v => v % 2 === 0) : values.every(v => v % 2 !== 0);
          console.log(`Pair K check: Expected ${expectedEven ? 'even' : 'odd'}, Got ${values}`);
          return isValid;
        }
      }

      if (cards.length === 1) {
        const card = cards[0];
        const value = rankValue(card.rank);
        const rulerValue = ((rulerSuit === 'Hearts' && card.suit === 'Hearts') || (rulerRank === 'A' && rulerSuit === 'Hearts')) && rulerRank !== 'A' ? rankValue(rulerRank) : null;
        const slicedValue = (rulerSuit === 'Spades' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Spades'))) && card.suit === 'Spades' ? Math.ceil(value / 2) - 1 : null;
        const slicedAdjusted = slicedValue === 0 ? 13 : slicedValue;
        const pocketValue = (rulerRank === 'A' && rulerSuit === 'Spades') || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'A' && p.ruler.suit === 'Spades')) ? Math.floor(value / 2) : null;
        let matches = baseMatch(card, top);

        if ((rulerRank === 'A' && rulerSuit === 'Diamonds') || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'A' && p.ruler.suit === 'Diamonds'))) {
          matches = !['J', 'Q', 'K'].includes(card.rank) && value % 2 !== 0;
        }
        if ((rulerRank === 'A' && rulerSuit === 'Hearts') || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'A' && p.ruler.suit === 'Hearts'))) {
          matches = true;
        }
        if ((rulerRank === 'A' && rulerSuit === 'Spades') || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'A' && p.ruler.suit === 'Spades'))) {
          matches = matches || (top && top.rank && pocketValue === topValue);
        }
        if ((rulerRank === 'A' && rulerSuit === 'Clubs') || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'A' && p.ruler.suit === 'Clubs'))) {
          matches = matches || (top && top.rank && Math.floor(value / 2) === topValue);
        }
        if ((rulerRank === '5' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === '5'))) && ['J', 'Q', 'K'].includes(card.rank)) {
          matches = top && top.rank && topValue === 5;
        }
        if ((rulerRank === '10' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === '10'))) && isEven(card.rank) && top && top.rank && isEven(top.rank)) {
          matches = true;
        }
        if ((rulerRank === 'J' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'J'))) && ['J', 'Q', 'K', 'A'].includes(card.rank)) {
          matches = top && top.rank && ['J', 'Q', 'K', 'A'].includes(top.rank);
        }
        if ((rulerRank === 'Q' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === 'Q'))) && card.rank === 'K') {
          matches = true;
        }
        if ((rulerSuit === 'Hearts' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Hearts'))) && rulerRank !== 'A') {
          matches = matches || (top && top.rank && (rulerValue === topValue || rulerValue % 2 === topValue % 2));
        }
        if ((rulerSuit === 'Spades' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Spades'))) && card.suit === 'Spades') {
          matches = matches || (top && top.rank && (slicedAdjusted === topValue || slicedAdjusted % 2 === topValue % 2));
        }
        console.log(`Single card play: ${card.rank}${card.suit}, Matches: ${matches}`);
        return !!matches;
      }

      if (cards.length === 2) {
        if (isPair) {
          const validSingle = cards.every(card => isValidPlay([card], top));
          console.log(`Pair play: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}, Valid as singles: ${validSingle}`);
          return validSingle;
        }
        if ((rulerSuit === 'Clubs' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Clubs'))) && game.players[game.turn].hand.length >= 5) {
          const validStrike = cards.every(card => isValidPlay([card], top));
          console.log(`Strike play: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}, Valid: ${validStrike}`);
          return validStrike;
        }
        if ((rulerSuit === 'Diamonds' || (kingRuler && game.players.some(p => p.ruler && p.ruler.suit === 'Diamonds'))) && cards.some(c => c.suit === 'Diamonds') && !isPair) {
          console.log('Valid: Diamond Storm allows diamond + another card');
          return true;
        }
        console.log('Invalid: Two cards must be a pair or special ruler play');
        return false;
      }

      if (isToaK) {
        const validToaK = cards.every(card => isValidPlay([card], top));
        console.log(`ToaK play: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}, Valid: ${validToaK}`);
        return validToaK;
      }

      if ((rulerRank === '10' || (kingRuler && game.players.some(p => p.ruler && p.ruler.rank === '10'))) && cards.length >= 2 && cards.every(c => isEven(c.rank)) && top && top.rank && isEven(top.rank)) {
        console.log('Valid: Ruler 10 allows even stack');
        return !isPair;
      }

      if (cards.length >= 2 && cards.length <= 4) {
        const validMulti = cards.every(c => c.rank === cards[0].rank && isValidPlay([c], top));
        console.log(`Multi play: ${cards.map(c => `${c.rank}${c.suit}`).join(', ')}, Valid: ${validMulti}`);
        return validMulti;
      }

      if (cards.length === 5) {
        const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
        const isStraight = values.every((v, i) => i === 0 || v === values[i - 1] + 1) || (values.join(',') === '1,10,11,12,13');
        const isFlush = cards.every(c => c.suit === cards[0].suit);
        const allEven = cards.every(c => isEven(c.rank));
        const allOdd = cards.every(c => !isEven(c.rank));
        const validFive = (isStraight || isFlush || allEven || allOdd) && cards.some(c => baseMatch(c, top));
        console.log(`Five-card play: Straight=${isStraight}, Flush=${isFlush}, AllEven=${allEven}, AllOdd=${allOdd}, Matches Top=${cards.some(c => baseMatch(c, top))}, Valid: ${validFive}`);
        return validFive;
      }

      if (cards.length > 5) {
        const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
        const isStraight = !hasDuplicateRanks(cards) && values.every((v, i) => i === 0 || v === values[i - 1] + 1);
        const isFlush = cards.every(c => c.suit === cards[0].suit);
        const validLarge = (isStraight || isFlush) && cards.some(c => baseMatch(c, top));
        console.log(`Large play: Straight=${isStraight}, Flush=${isFlush}, Matches Top=${cards.some(c => baseMatch(c, top))}, Valid: ${validLarge}`);
        return validLarge;
      }

      console.log('Invalid play: No matching rule');
      return false;
    }

    const rulerAbilities = {
      suits: {
        Diamonds: 'Diamond Storm: Play a diamond card + another card (not a pair)',
        Hearts: 'Campfire: Cards count as both their rank and this heart’s rank (no pairs)',
        Spades: 'Sliced: Spades count as both their rank and rank ÷ 2 rounded up - 1 (2 = King)',
        Clubs: 'Strike: Play two valid cards as a pair if 5+ cards in hand (3+ remain after play)'
      },
      ranks: {
        2: 'Twice the Might: Pairs make all opponents draw 2 extra cards',
        3: 'Lucky Clover: Play a 7 anytime, all opponents draw 2',
        4: 'Fourfold: Four of a kind reshuffles all cards, all opponents draw 7, player draws 3',
        5: 'High Five: Face cards count as 5 (pairs OK)',
        6: 'Nightmare: Playing a 6 makes all opponents draw to 7 cards',
        7: 'Lucky Spin: Play a 3 anytime, all opponents draw 2',
        8: 'Seeing Red: If any opponent has ≤3 cards, 8 makes all opponents draw 2',
        9: 'Reverse Nightmare: Any opponent’s 9s make the player discard to 5 cards',
        10: 'Perfection: Play multiple even cards on an even card or empty pile (no pairs)',
        J: 'Servant: J/Q/K/A count as each other (pairs OK)',
        Q: 'Ruler’s Touch: Kings are wild cards, counting as every rank, all opponents draw 1 (pairs OK)',
        K: 'Ruler of Rulers: Gain abilities of all other rulers on field',
        'A-Diamonds': 'Perfect Card: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)',
        'A-Hearts': 'Otherworldly Touch: Hearts are wild cards, counting as every rank (no pairs)',
        'A-Spades': 'Pocket Knife: All cards count as both their rank and half rank rounded down (pairs OK)',
        'A-Clubs': 'Nuclear Bomb: If another player wins without this ruler, reshuffle deck once, opponents draw 7, winner draws 5'
      },
      pairs: {
        A: 'Pocket Aces: Until you play again, all opponents must play 10 or above',
        2: 'Pair Pair: Opponent draws 1 extra card on top of the normal 2',
        3: 'Feeling Off: Until you play again, all opponents must play odd numbers',
        4: 'Half the Cards: Until you play again, all opponents cannot play 8 or above',
        5: 'Medium Rare: See last 5 unique discard pile cards, swap one with a hand card',
        6: 'Devilish Stare: Pick one opponent, they skip their next turn once',
        7: 'Double Luck: See top 2 deck cards, swap one with a hand card',
        8: 'Good Fortune: Play again and set discard (choose either card)',
        9: 'Fort: Only pairs or better can play until destroyed or your next turn; all opponents draw 1 if no pair',
        10: 'Feeling Right: Until you play again, all opponents must play even numbers',
        J: 'High Card: Until you play again, all opponents must play 8 or above',
        Q: 'Complaint: All opponents draw 1, play again and set any discard (choose either card)',
        K: 'I am your Father: Until you play again, all opponents alternate even/odd (start even, end on your turn)'
      }
    };

    if (method === 'GET') {
      if (!game.players[0].hand.length) {
        game.players.forEach(player => player.hand = dealHand(8));
      }
      if (!game.discard && game.deck.length) game.discard = game.deck.shift();
      game.canPlay = game.phase === 'play' ? game.players[game.turn].hand.some(card => isValidPlay([card], game.discard)) : true;
      if (!game.canPlay && game.phase === 'play' && !game.pair5Pending && !game.pair7Pending && !game.pair6Pending) {
        const drawCount = Math.min(2, game.deck.length);
        if (drawCount > 0) {
          game.players[game.turn].hand.push(...game.deck.splice(0, drawCount));
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} auto-drew ${drawCount} (no valid plays)`);
          console.log(`Turn advancing due to auto-draw: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
          game.turn = (game.turn + 1) % game.players.length;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          gameStates[sessionId] = game;
        }
      }
    }

    if (method === 'POST') {
      const { move, reset, addCards, fortChoice, pair5DiscardChoice, pair5HandChoice, pair7DeckChoice, pair7HandChoice, pair6Target } = query;
      if (reset === 'true') {
        console.log(`Resetting game state for session ${sessionId}`);
        game = {
          deck: shuffle([...deck]),
          discard: null,
          discardPile: [],
          players: Array(playerCount).fill().map(() => ({ hand: dealHand(8), ruler: null })),
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
          fortOwner: null,
          extraTurn: false,
          skipNext: null,
          wins: Array(playerCount).fill(0),
          fortChoicePending: false,
          fortChoicePlayer: null,
          pair5Pending: false,
          pair5DiscardChoice: null,
          pair5HandChoice: null,
          pair7Pending: false,
          pair7DeckChoice: null,
          pair7HandChoice: null,
          pair6Pending: false,
          resetTriggered: false,
          kingAlternation: null
        };
        gameStates[sessionId] = game;
      } else if (addCards) {
        const match = addCards.match(/^([A2-9JQK]|10)([DHSC])([A-Z])$/i);
        if (!match) {
          game.status = 'Invalid card code! Use e.g., "8DA" (A), "KSD" (discard)';
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
            if (game.moveHistory.length > 3) game.moveHistory.pop();
          }
        }
      } else if (move === 'draw' && game.phase === 'play') {
        const drawCount = game.fortActive && game.turn !== game.fortOwner ? 1 : 2;
        const actualDraw = Math.min(drawCount, game.deck.length);
        if (actualDraw > 0) {
          game.players[game.turn].hand.push(...game.deck.splice(0, actualDraw));
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} drew ${actualDraw}${game.fortActive && game.turn !== game.fortOwner ? ' (fort)' : ''}`);
          console.log(`Turn advancing after draw: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
          game.turn = (game.turn + 1) % game.players.length;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          gameStates[sessionId] = game;
        }
      } else if (pair5DiscardChoice && game.pair5Pending) {
        const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
        if (topFive.some(c => `${c.rank}${c.suit[0]}` === pair5DiscardChoice)) {
          game.pair5DiscardChoice = pair5DiscardChoice;
          game.status = `Player ${getPlayerLabel(game.turn)}: Select a hand card to swap with ${pair5DiscardChoice}`;
          gameStates[sessionId] = game;
        }
      } else if (pair5HandChoice && game.pair5Pending && game.pair5DiscardChoice) {
        const topFive = [...new Map(game.discardPile.slice(-5).map(c => [`${c.rank}${c.suit[0]}`, c])).values()].reverse();
        const discardIdx = topFive.findIndex(c => `${c.rank}${c.suit[0]}` === game.pair5DiscardChoice);
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair5HandChoice);
        if (discardIdx !== -1 && handIdx !== -1) {
          const discardCard = topFive[discardIdx];
          const handCard = game.players[game.turn].hand[handIdx];
          const pileIdx = game.discardPile.length - 5 + discardIdx;
          if (pileIdx >= 0) game.discardPile[pileIdx] = handCard;
          game.players[game.turn].hand[handIdx] = discardCard;
          game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} swapped ${pair5HandChoice} with ${game.pair5DiscardChoice} (Pair 5)`);
          game.pair5Pending = false;
          game.pair5DiscardChoice = null;
          game.pair5HandChoice = null;
          console.log(`Turn advancing after pair5 swap: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
          game.turn = (game.turn + 1) % game.players.length;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          gameStates[sessionId] = game;
        }
      } else if (pair7DeckChoice && game.pair7Pending) {
        const topTwo = game.deck.slice(0, 2);
        if (topTwo.some(c => `${c.rank}${c.suit[0]}` === pair7DeckChoice)) {
          game.pair7DeckChoice = pair7DeckChoice;
          game.status = `Player ${getPlayerLabel(game.turn)}: Select a hand card to swap with ${pair7DeckChoice}`;
          gameStates[sessionId] = game;
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
          console.log(`Turn advancing after pair7 swap: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
          game.turn = (game.turn + 1) % game.players.length;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          gameStates[sessionId] = game;
        }
      } else if (pair6Target && game.pair6Pending) {
        const targetIdx = parseInt(pair6Target);
        if (getOpponents(game.turn).includes(targetIdx)) {
          game.skipNext = targetIdx;
          game.moveHistory.unshift(`Player ${getPlayerLabel(targetIdx)} will skip next turn (Pair 6)`);
          game.pair6Pending = false;
          game.extraTurn = false;
          console.log(`Turn advancing after pair6 target: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
          game.turn = (game.turn + 1) % game.players.length;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          gameStates[sessionId] = game;
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
          console.log(`Turn advancing after fort choice: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
          game.turn = (game.turn + 1) % game.players.length;
          if (game.skipNext === game.turn) {
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
            console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.skipNext = null;
          }
          game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          gameStates[sessionId] = game;
        }
      } else if (move) {
        const cards = move.split(',').map(c => {
          const rank = c.length === 3 ? c.slice(0, 2) : c[0];
          const suitChar = c.length === 3 ? c[2] : c[1];
          const suit = suits.find(s => s[0] === suitChar.toUpperCase());
          return { rank: rank === '10' ? '10' : ranks.find(r => r === rank.toUpperCase()), suit };
        });
        if (cards.some(c => !c.rank || !c.suit)) {
          game.status = 'Invalid card format in move!';
        } else if (!game.players[game.turn].hand.some(h => cards.some(c => c.rank === h.rank && c.suit === h.suit)) || hasDuplicateCards(cards)) {
          game.status = 'Cards not in hand or duplicates in play!';
        } else if (game.phase === 'setup') {
          if (cards.length !== 1) {
            game.status = 'Pick exactly one card as ruler!';
          } else {
            game.players[game.turn].ruler = cards[0];
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} set ruler ${cards[0].rank}${cards[0].suit[0]}`);
            game.players[game.turn].hand = game.players[game.turn].hand.filter(h => !(h.rank === cards[0].rank && h.suit === cards[0].suit));
            game.players[game.turn].hand.push(...dealHand(1));
            console.log(`Turn advancing after ruler selection: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
            game.turn = (game.turn + 1) % game.players.length;
            game.status = game.players.every(p => p.ruler) ? 'All rulers set! Game starts!' : `Player ${getPlayerLabel(game.turn)}\'s turn: Pick your ruler!`;
            if (game.players.every(p => p.ruler)) game.phase = 'play';
            gameStates[sessionId] = game;
          }
        } else if (game.phase === 'play' && isValidPlay(cards, game.discard)) {
          game.players[game.turn].hand = game.players[game.turn].hand.filter(h => !cards.some(c => c.rank === h.rank && c.suit === h.suit));
          game.discardPile.push(game.discard);
          game.discard = cards[0];
          game.lastPlayCount = cards.length;
          game.lastPlayType = cards.length === 1 ? 'single' : cards.every(c => c.rank === cards[0].rank) ? (cards.length === 2 ? 'pair' : 'multi') : 'stack';
          const rank = cards[0].rank;

          if (game.lastPlayType === 'pair') {
            game.pairEffect = rank;
            game.pairEffectOwner = game.turn;
            if (rank === '2') {
              getOpponents(game.turn).forEach(idx => {
                const drawCount = Math.min(3, game.deck.length);
                game.players[idx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} (Pair 2)`);
              });
            } else if (rank === '5') {
              game.pair5Pending = true;
              game.status = `Player ${getPlayerLabel(game.turn)}: Pick a discard pile card to swap (?pair5DiscardChoice=card)`;
              game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
            } else if (rank === '6') {
              game.pair6Pending = true;
              game.status = `Player ${getPlayerLabel(game.turn)}: Pick an opponent to skip (?pair6Target=playerIndex)`;
              game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
            } else if (rank === '7') {
              game.pair7Pending = true;
              game.status = `Player ${getPlayerLabel(game.turn)}: Pick a deck card to swap (?pair7DeckChoice=card)`;
              game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}`);
            } else if (rank === '8') {
              game.extraTurn = true;
              game.status = `Player ${getPlayerLabel(game.turn)}: Play again (Pair 8)`;
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
            } else if (rank === 'K') {
              game.kingAlternation = true;
            }
          } else if (game.lastPlayType === 'multi' && cards.length === 3) {
            game.fortActive = true;
            game.fortCard = cards[0];
            game.fortRank = rank;
            game.fortOwner = game.turn;
            getOpponents(game.turn).forEach(idx => {
              if (!game.players[idx].hand.some(c => isValidPlay([c], game.discard))) {
                const drawCount = Math.min(1, game.deck.length);
                game.players[idx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} (ToaK Fort)`);
              }
            });
          } else if (game.lastPlayType === 'multi' && cards.length === 4) {
            game.deck.push(...game.discardPile, game.discard);
            game.discardPile = [];
            game.discard = null;
            getOpponents(game.turn).forEach(idx => {
              const drawCount = Math.min(7, game.deck.length);
              game.players[idx].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${getPlayerLabel(idx)} drew ${drawCount} (Four of a Kind)`);
            });
            const playerDraw = Math.min(3, game.deck.length);
            game.players[game.turn].hand.push(...game.deck.splice(0, playerDraw));
            game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} drew ${playerDraw} (Four of a Kind)`);
            shuffle(game.deck);
          } else if (rank === '6') {
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
            getOpponents(game.turn).forEach(idx => {
              if (game.players[idx].ruler && game.players[idx].ruler.rank === 'A' && game.players[idx].ruler.suit === 'Clubs' && !game.resetTriggered) {
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
              }
            });
            game.status = `Player ${getPlayerLabel(game.turn)} wins! Reset to continue.`;
          } else if (game.fortActive && game.turn === game.fortOwner && game.lastPlayType !== 'pair' && game.lastPlayType !== 'multi') {
            game.fortActive = false;
            game.fortCard = null;
            game.fortRank = null;
            game.fortOwner = null;
            game.moveHistory.unshift(`Fort destroyed by ${getPlayerLabel(game.turn)}'s non-pair play`);
            console.log(`Turn advancing after fort destroy: ${game.turn} -> ${game.extraTurn ? game.turn : (game.turn + 1) % game.players.length}`);
            game.turn = game.extraTurn ? game.turn : (game.turn + 1) % game.players.length;
            if (game.skipNext === game.turn) {
              game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
              console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
              game.turn = (game.turn + 1) % game.players.length;
              game.skipNext = null;
            }
            game.extraTurn = false;
            game.status = `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          } else {
            if (game.pairEffect === 'K' && game.turn === game.pairEffectOwner) {
              game.pairEffect = null;
              game.pairEffectOwner = null;
              game.kingAlternation = null;
            } else if (game.pairEffect === 'K') {
              game.kingAlternation = !game.kingAlternation;
            }
            console.log(`Turn advancing after play: ${game.turn} -> ${game.extraTurn ? game.turn : (game.turn + 1) % game.players.length}`);
            game.turn = game.extraTurn ? game.turn : (game.turn + 1) % game.players.length;
            if (game.skipNext === game.turn) {
              game.moveHistory.unshift(`Player ${getPlayerLabel(game.turn)} skipped (Pair 6)`);
              console.log(`Turn advancing due to skip: ${game.turn} -> ${(game.turn + 1) % game.players.length}`);
              game.turn = (game.turn + 1) % game.players.length;
              game.skipNext = null;
            }
            game.extraTurn = false;
            game.status = game.pairEffect && game.turn !== game.pairEffectOwner ? `Player ${getPlayerLabel(game.turn)}\'s turn! (${getActiveEffectName()})` : `Player ${getPlayerLabel(game.turn)}\'s turn!`;
          }
          if (game.moveHistory.length > 3) game.moveHistory.pop();
          gameStates[sessionId] = game;
        } else {
          game.status = 'Invalid play!';
        }
      }
    }

    res.status(200).json({ ...game, opponents: getOpponents(game.turn) });
  } catch (error) {
    console.error('Error in handler:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

module.exports = handler;
