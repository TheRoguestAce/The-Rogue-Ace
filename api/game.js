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
        { hand: [], ruler: null, wins: 0, aceOfClubsUsed: false, kingUsed: false }, // Player A
        { hand: [], ruler: null, wins: 0, aceOfClubsUsed: false, kingUsed: false }  // Player B
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
      fortOwner: null,
      extraTurn: false,
      pair5Pending: false,
      pair5Choice: null,
      pair6Pending: false,
      pair6Target: null,
      pair7Pending: false,
      pair7Choice: null,
      playerCount: 2,
      aceOfClubsTriggered: false // Track if Ace of Clubs has been used
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

  function getOpponents(currentTurn) {
    return Array.from({ length: game.playerCount }, (_, i) => i).filter(i => i !== currentTurn);
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

  function rankValue(r) {
    return { A: 1, J: 11, Q: 12, K: 13 }[r] || parseInt(r);
  }

  function isEven(r) {
    return rankValue(r) % 2 === 0;
  }

  function isRed(s) {
    return ['Diamonds', 'Hearts'].includes(s);
  }

  function isValidPlay(cards, top) {
    if (cards.length === 0) return false; // No cards selected is always invalid
  
    const playerRuler = game.players[game.turn].ruler;
    const rulerRank = playerRuler ? playerRuler.rank : null;
    const rulerSuit = playerRuler ? playerRuler.suit : null;
    const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
    const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
    const isFoaK = cards.length === 4 && cards.every(c => c.rank === cards[0].rank);
    const topValue = top ? rankValue(top.rank) : 0;
  
    // Step 1: Check fort restrictions (non-owners can only play pairs or better)
    if (game.fortActive && game.turn !== game.fortOwner) {
      if (!isPair && !isToaK && !isFoak) return false; // Only pairs or ToaK can challenge a fort for non-owners
      const fortValue = rankValue(game.fortRank);
      const playValue = rankValue(cards[0].rank);
      return playValue >= 2 && playValue <= 13; // Ensure the rank is within valid bounds
    }
  
    // Step 2: Check active pair effects from opponents
    if (game.pairEffect && game.turn !== game.pairEffectOwner) {
      const value = rankValue(cards[0].rank);
      if (game.pairEffect === 'A' && value < 10) return false; // Pocket Aces: Must play 10+
      if (game.pairEffect === '2') return true; // Pair Pair: No play restriction
      if (game.pairEffect === '3' && value % 2 === 0) return false; // Feeling Off: Must play odd
      if (game.pairEffect === '4' && value >= 8) return false; // Half the Cards: Cannot play 8+
      if (game.pairEffect === '5') return true; // Medium Rare: No play restriction
      if (game.pairEffect === '6') return true; // Devilish Stare: No play restriction
      if (game.pairEffect === '7') return true; // Double Luck: No play restriction
      if (game.pairEffect === '8') return true; // Good Fortune: No play restriction
      if (game.pairEffect === '9') return true; // Fort: Handled above
      if (game.pairEffect === '10' && value % 2 !== 0) return false; // Feeling Right: Must play even
      if (game.pairEffect === 'J' && value < 8) return false; // High Card: Must play 8+
      if (game.pairEffect === 'Q') return true; // Complaint: No play restriction
      if (game.pairEffect === 'K') {
        const lastWasEven = game.moveHistory.length > 0 && rankValue(game.discard.rank) % 2 === 0;
        return lastWasEven ? value % 2 !== 0 : value % 2 === 0; // I am your Father: Alternate even/odd
      }
    }
  
    // Step 3: Handle initial play (no top card)
    if (!top && game.phase === 'play') {
      // Ruler A of Diamonds: Odd non-face cards (A,3,5,7,9) playable anytime (no pairs)
      if (rulerRank === 'A' && rulerSuit === 'Diamonds') {
        return cards.every(c => !['J', 'Q', 'K'].includes(c.rank) && rankValue(c.rank) % 2 !== 0);
      }
      // Ruler 3 or 7: Play a 7 or 3 anytime
      if (rulerRank === '3' || rulerRank === '7') {
        return cards.length === 1 && (cards[0].rank === '7' || cards[0].rank === '3');
      }
      // Ruler 10: Play two even cards (no pairs)
      if (rulerRank === '10') {
        return cards.length === 2 && cards.every(c => isEven(c.rank)) && !isPair && cards.some(c => isValidPlay([c], null));
      }
      // Default: Can play sets of 2-4 cards of the same rank
      return cards.length >= 2 && cards.length <= 4 && cards.every(c => c.rank === cards[0].rank);
    }
  
    // Step 4: Handle single card plays (must match top card)
    if (cards.length === 1) {
      const card = cards[0];
      let effectiveRank = card.rank;
      let effectiveSuit = card.suit;
      let effectiveValue = rankValue(card.rank);
      let matches = false;
  
      // Apply Ruler Abilities to modify the card's effective rank, suit, or value
      if (top) {
        // A of Diamonds: Odd non-face cards (A,3,5,7,9) playable anytime
        if (rulerRank === 'A' && rulerSuit === 'Diamonds' && !['J', 'Q', 'K'].includes(card.rank) && effectiveValue % 2 !== 0) {
          return true; // Bypasses normal matching
        }
        // A of Hearts: Hearts are wild, other suits count as AH but not wild
        if (rulerRank === 'A' && rulerSuit === 'Hearts') {
          if (card.suit === 'Hearts') {
            return true; // Wild card, matches any top card
          }
          // Non-Hearts count as AH but aren't wild
          effectiveRank = 'A';
          effectiveSuit = 'Hearts';
          effectiveValue = 1;
        }
        // A of Spades: All cards count as both their rank and half rank (ceil(rank/2) - 1)
        if (rulerRank === 'A' && rulerSuit === 'Spades') {
          const halfValue = Math.ceil(effectiveValue / 2) - 1;
          effectiveValue = [effectiveValue, halfValue];
          effectiveRank = [effectiveRank, halfValue.toString()];
        }
        // A of Clubs: No play modification
        if (rulerRank === 'A' && rulerSuit === 'Clubs') {
          // No effect on play validity
        }
        // Ruler 5: Face cards (J,Q,K) count as 5
        if (rulerRank === '5' && ['J', 'Q', 'K'].includes(card.rank)) {
          effectiveValue = 5;
          effectiveRank = '5';
        }
        // Ruler J: J/Q/K/A count as each other
        if (rulerRank === 'J' && ['J', 'Q', 'K', 'A'].includes(card.rank)) {
          effectiveRank = ['J', 'Q', 'K', 'A'];
        }
        // Ruler Q: Kings are wild
        if (rulerRank === 'Q' && card.rank === 'K') {
          return true; // Wild card, matches any top card
        }
        // Suit Hearts: Cards count as both their rank and the ruler's rank
        if (rulerSuit === 'Hearts' && rulerRank !== 'A') {
          const rulerValue = rankValue(rulerRank);
          effectiveValue = [effectiveValue, rulerValue];
          effectiveRank = [effectiveRank, rulerRank];
        }
        // Suit Spades: Spades count as both their rank and rank ÷ 2 rounded up - 1
        if (rulerSuit === 'Spades' && rulerRank !== 'A' && card.suit === 'Spades') {
          const slicedValue = Math.ceil(effectiveValue / 2) - 1;
          effectiveValue = [effectiveValue, slicedValue];
          effectiveRank = [effectiveRank, slicedValue.toString()];
        }
        // Suit Clubs: Handled below in pair logic
        // Suit Diamonds: Handled below for Diamond Storm
  
        // Base Matching: Same rank, same suit, or same even/odd (after ruler abilities)
        const topEffectiveValue = rankValue(top.rank);
  
        // Handle cases where effectiveRank or effectiveValue is an array (multiple possible values)
        const ranksToCheck = Array.isArray(effectiveRank) ? effectiveRank : [effectiveRank];
        const valuesToCheck = Array.isArray(effectiveValue) ? effectiveValue : [effectiveValue];
  
        // Check rank match
        const rankMatches = ranksToCheck.some(r => r === top.rank);
        // Check suit match
        const suitMatches = effectiveSuit === top.suit;
        // Check even/odd match
        const evenOddMatches = valuesToCheck.some(v => (v % 2) === (topEffectiveValue % 2));
  
        matches = rankMatches || suitMatches || evenOddMatches;
      }
  
      return matches;
    }
  
    // Step 5: Suit Clubs - Play a pair if 5+ cards in hand, both cards must be individually valid
    if (rulerSuit === 'Clubs' && game.players[game.turn].hand.length >= 5 && cards.length === 2 && cards[0].rank === cards[1].rank) {
      const validSingle = cards.every(card => {
        if (!top) {
          return isValidPlay([card], null);
        }
        return isValidPlay([card], top);
      });
      return validSingle;
    }
  
    // Step 6: Suit Diamonds - Diamond Storm: Play a diamond card + another card (not a pair)
    if (rulerSuit === 'Diamonds' && cards.length === 2 && !isPair) {
      const diamondCard = cards.find(c => c.suit === 'Diamonds');
      if (diamondCard) {
        // The diamond card must be a valid play
        const diamondValid = top ? isValidPlay([diamondCard], top) : isValidPlay([diamondCard], null);
        return diamondValid;
      }
    }
  
    // Step 7: Handle pair plays (must match top card individually)
    if (isPair && top) {
      // Both cards must individually be valid plays against the top card
      const validSingle = cards.every(card => isValidPlay([card], top));
      if (!validSingle) return false;
      return true;
    }
  
    // Step 8: Handle three-of-a-kind (ToaK) plays (must match top card individually)
    if (isToaK && top) {
      const validSingle = cards.every(card => isValidPlay([card], top));
      if (!validSingle) return false;
      return true;
    }
  
    // Step 9: Ruler 10 - Play two even cards on an even top card, no pairs
    if (rulerRank === '10' && top && cards.length === 2 && cards.every(c => isEven(c.rank)) && isEven(top.rank)) {
      return !isPair && cards.some(card => isValidPlay([card], top));
    }
  
    // Step 10: Handle sets of 2-4 cards of the same rank
    if (cards.length >= 2 && cards.length <= 4) {
      const allSameRank = cards.every(c => c.rank === cards[0].rank);
      if (!allSameRank) return false;
      // Must match top card if it exists
      if (top) {
        return cards.every(card => isValidPlay([card], top));
      }
      return true; // Valid if no top card (already checked in Step 3)
    }
  
    // Step 11: Handle 5-card plays (straight, flush, all even, or all odd)
    if (cards.length >= 4) {
      const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
      const isStraight = (values.every((v, i) => i === 0 || v === values[i - 1] + 1) || values.join(',') === '1,10,11,12,13') && cards.length >= 4;
      const isFlush = cards.every(c => c.suit === cards[0].suit) && cards.length >= 4;
      const allEven = cards.every(c => isEven(c.rank)) && cards.length >= 5;
      const allOdd = cards.every(c => !isEven(c.rank)) && cards.length >= 5;
      if (!(isStraight || isFlush || allEven || allOdd)) return false;
      // Must match top card if it exists
      if (top) {
        return cards.some(card => isValidPlay([card], top));
      }
      return true; // Valid if no top card
    }
  
    return false; // Default to invalid if no conditions match
  }

  if (method === 'GET') {
    if (!game.players[0].hand || game.players[0].hand.length === 0) {
      console.log(`Dealing initial hands for ${sessionId}`);
      game.playerCount = parseInt(query.players) || 2;
      game.players = Array(game.playerCount).fill().map(() => ({ hand: dealHand(8), ruler: null, wins: 0, aceOfClubsUsed: false, kingUsed: false }));
      console.log(`Player hands dealt for ${game.playerCount} players`);
    }
    if (!game.discard && game.deck.length > 0) {
      game.discard = game.deck.shift();
      console.log(`Initial discard set: ${game.discard.rank}${game.discard.suit[0]}`);
    }
    game.canPlay = game.players[game.turn].hand.some(card => isValidPlay([card], game.discard));
  }

  if (method === 'POST') {
    const { move, reset, addCards, pair5Choice, pair6Target, pair7Choice } = query;
    if (reset === 'true') {
      console.log(`Resetting ${sessionId}`);
      game = {
        deck: shuffle([...deck]),
        discard: game.deck.length > 0 ? game.deck.shift() : null,
        players: Array(game.playerCount).fill().map(() => ({ hand: dealHand(8), ruler: null, wins: 0, aceOfClubsUsed: false, kingUsed: false })),
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
        pair5Pending: false,
        pair5Choice: null,
        pair6Pending: false,
        pair6Target: null,
        pair7Pending: false,
        pair7Choice: null,
        playerCount: game.playerCount,
        aceOfClubsTriggered: false
      };
    } else if (addCards) {
      const match = addCards.match(/^([A2-9JQK]|10)([DHSC])([A-Z])$/i);
      if (!match) {
        game.status = 'Invalid card code! Use e.g., "ACA" (Ace of Clubs to A) or "8SD" (8 of Spades to discard)';
      } else {
        const [_, rank, suitChar, targetChar] = match;
        const suit = suits.find(s => s[0].toUpperCase() === suitChar.toUpperCase());
        const validRank = rank === '10' ? '10' : ranks.find(r => r.toUpperCase() === rank.toUpperCase());
        const targetIdx = targetChar.charCodeAt(0) - 65;

        if (!validRank || !suit || (targetChar.toUpperCase() !== 'D' && (targetIdx < 0 || targetIdx >= game.playerCount))) {
          game.status = 'Invalid rank, suit, or player target!';
        } else {
          const card = { rank: validRank, suit };
          if (targetChar.toUpperCase() === 'D') {
            const deckIdx = game.deck.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (deckIdx !== -1) {
              game.discard = game.deck.splice(deckIdx, 1)[0];
            } else {
              game.discard = { rank: validRank, suit };
            }
            game.moveHistory.unshift(`Set ${card.rank}${suit[0]} as discard`);
            if (game.moveHistory.length > 3) game.moveHistory.pop();
            game.status = `Player ${game.turn === 0 ? 'A' : String.fromCharCode(65 + game.turn)}'s turn: Set discard!`;
          } else {
            const deckIdx = game.deck.findIndex(c => c.rank === card.rank && c.suit === card.suit);
            if (deckIdx !== -1) {
              game.players[targetIdx].hand.push(game.deck.splice(deckIdx, 1)[0]);
            } else {
              game.players[targetIdx].hand.push({ rank: validRank, suit });
            }
            game.moveHistory.unshift(`Added 1 ${card.rank}${suit[0]} to Player ${String.fromCharCode(65 + targetIdx)}`);
            if (game.moveHistory.length > 3) game.moveHistory.pop();
            game.status = `Player ${game.turn === 0 ? 'A' : String.fromCharCode(65 + game.turn)}'s turn: Added 1 card!`;
          }
        }
      }
    } else if (pair5Choice && game.pair5Pending && game.turn === game.pairEffectOwner) {
      const cardMatch = pair5Choice.match(/^([A2-9JQK]|10)([DHSC])$/i);
      if (cardMatch) {
        const [rank, suitChar] = cardMatch;
        const suit = suits.find(s => s[0].toUpperCase() === suitChar.toUpperCase());
        const validRank = rank === '10' ? '10' : ranks.find(r => r.toUpperCase() === rank.toUpperCase());
        const card = { rank: validRank, suit };
        const discardIdx = game.discard ? `${game.discard.rank}${game.discard.suit[0]}` === pair5Choice : false;
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair5Choice);
        if (discardIdx || handIdx !== -1) {
          const swapCard = discardIdx ? game.discard : game.players[game.turn].hand[handIdx];
          if (discardIdx) game.discard = game.players[game.turn].hand[handIdx];
          else game.players[game.turn].hand[handIdx] = swapCard;
          game.moveHistory.unshift(`Player ${String.fromCharCode(65 + game.turn)} swapped with ${pair5Choice} (Pair 5)`);
          game.pair5Pending = false;
          game.pair5Choice = null;
          game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn!`;
        }
      }
    } else if (pair6Target && game.pair6Pending && game.turn === game.pairEffectOwner) {
      const targetIdx = parseInt(pair6Target);
      if (getOpponents(game.turn).includes(targetIdx)) {
        game.turn = targetIdx; // Skip by setting turn to target, then advance
        game.moveHistory.unshift(`Player ${String.fromCharCode(65 + targetIdx)} skipped (Pair 6)`);
        game.pair6Pending = false;
        game.pair6Target = null;
        game.turn = (game.turn + 1) % game.playerCount;
        game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn!`;
      }
    } else if (pair7Choice && game.pair7Pending && game.turn === game.pairEffectOwner) {
      const cardMatch = pair7Choice.match(/^([A2-9JQK]|10)([DHSC])$/i);
      if (cardMatch) {
        const [rank, suitChar] = cardMatch;
        const suit = suits.find(s => s[0].toUpperCase() === suitChar.toUpperCase());
        const validRank = rank === '10' ? '10' : ranks.find(r => r.toUpperCase() === rank.toUpperCase());
        const card = { rank: validRank, suit };
        const deckIdx = game.deck.findIndex(c => `${c.rank}${c.suit[0]}` === pair7Choice);
        const handIdx = game.players[game.turn].hand.findIndex(c => `${c.rank}${c.suit[0]}` === pair7Choice);
        if (deckIdx !== -1 || handIdx !== -1) {
          const swapCard = deckIdx !== -1 ? game.deck[deckIdx] : game.players[game.turn].hand[handIdx];
          if (deckIdx !== -1) game.deck[deckIdx] = game.players[game.turn].hand[handIdx];
          else game.players[game.turn].hand[handIdx] = swapCard;
          game.deck.push(game.deck.shift());
          shuffle(game.deck);
          game.moveHistory.unshift(`Player ${String.fromCharCode(65 + game.turn)} swapped with ${pair7Choice} (Pair 7)`);
          game.pair7Pending = false;
          game.pair7Choice = null;
          game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn!`;
        }
      }
    } else if (move) {
      const cardStrings = move.split(',');
      const cards = cardStrings.map(cs => {
        const [rank, suitChar] = [cs.slice(0, -1), cs.slice(-1)];
        const suit = suits.find(s => s[0] === suitChar);
        return suit && ranks.includes(rank) ? { rank, suit } : null;
      }).filter(c => c);
      const isPair = cards.length === 2 && cards[0].rank === cards[1].rank;
      const isToaK = cards.length === 3 && cards.every(c => c.rank === cards[0].rank);
      const isFourOfAKind = cards.length === 4 && cards.every(c => c.rank === cards[0].rank);

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
            if (!game.players.every(p => p.ruler)) {
              game.turn = (game.turn + 1) % game.playerCount;
              game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn: Pick your ruler!`;
            } else {
              game.discard = game.deck.length > 0 ? game.deck.shift() : null;
              game.phase = 'play';
              game.turn = (game.turn + 1) % game.playerCount;
              game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn!`;
              game.moveHistory = [game.players.map((p, i) => `Player ${String.fromCharCode(65 + i)} set ruler ${p.ruler.rank}${p.ruler.suit[0]}`).join(' | ')];
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
          const playerRuler = game.players[game.turn].ruler;
          let rulerRank = playerRuler ? playerRuler.rank : null;
          const rulerSuit = playerRuler ? playerRuler.suit : null;
          // Check for multiple Kings
          const hasMultipleKings = game.players.filter(p => p.ruler?.rank === 'K').length >= 2;
          if (rulerRank === 'K' && hasMultipleKings) {
            rulerRank = null; // Disable Ruler K abilities
          }

          const values = cards.map(c => rankValue(c.rank)).sort((a, b) => a - b);
          const isStraight = (values.every((v, i) => i === 0 || v === values[i - 1] + 1) || (cards.length === 5 && values.join(',') === '1,10,11,12,13')) && cards.length >= 4;
          const isFlush = cards.every(c => c.suit === cards[0].suit) && cards.length >= 4;
          const allEven = cards.every(c => isEven(c.rank)) && cards.length >= 5;
          const allOdd = cards.every(c => !isEven(c.rank)) && cards.length >= 5;
          game.lastPlayType = cards.length === 1 ? 'single' :
                             (isPair ? 'pair' :
                             (isToaK ? 'three of a kind' :
                             (isFourOfAKind ? 'four of a kind' :
                             (isStraight ? 'straight' :
                             (isFlush ? 'flush' :
                             (allEven ? 'even only' :
                             (allOdd ? 'odd only' : 'multi')))))));
          game.lastPlayCount = cards.length;

          // Ruler Abilities for Single Card Plays
          if (cards.length === 1) {
            const cardRank = cards[0].rank;
            // Ruler 3: Lucky Clover - Play a 7, others draw 2
            if ((rulerRank === '3' || (rulerRank === 'K' && game.players.some((p, idx) => idx !== game.turn && p.ruler?.rank === '3'))) && cardRank === '7') {
              getOpponents(game.turn).forEach(opIdx => {
                const actualDraw = Math.min(2, game.deck.length);
                if (actualDraw > 0) {
                  game.players[opIdx].hand.push(...game.deck.splice(0, actualDraw));
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${actualDraw} (Ruler 3: Lucky Clover)`);
                }
              });
            }
            // Ruler 7: Lucky Spin - Play a 3, others draw 2
            if ((rulerRank === '7' || (rulerRank === 'K' && game.players.some((p, idx) => idx !== game.turn && p.ruler?.rank === '7'))) && cardRank === '3') {
              getOpponents(game.turn).forEach(opIdx => {
                const actualDraw = Math.min(2, game.deck.length);
                if (actualDraw > 0) {
                  game.players[opIdx].hand.push(...game.deck.splice(0, actualDraw));
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${actualDraw} (Ruler 7: Lucky Spin)`);
                }
              });
            }
            // Ruler 6: Nightmare - Play a 6, others draw to 7 cards
            if ((rulerRank === '6' || (rulerRank === 'K' && game.players.some((p, idx) => idx !== game.turn && p.ruler?.rank === '6'))) && cardRank === '6') {
              getOpponents(game.turn).forEach(opIdx => {
                const drawTo7 = Math.max(0, 7 - game.players[opIdx].hand.length);
                const actualDraw = Math.min(drawTo7, game.deck.length);
                if (actualDraw > 0) {
                  game.players[opIdx].hand.push(...game.deck.splice(0, actualDraw));
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${actualDraw} (Ruler 6: Nightmare)`);
                }
              });
            }
            // Ruler 8: Seeing Red - Play an 8, players with 3 or fewer cards draw 2
            if ((rulerRank === '8' || (rulerRank === 'K' && game.players.some((p, idx) => idx !== game.turn && p.ruler?.rank === '8'))) && cardRank === '8') {
              getOpponents(game.turn).forEach(opIdx => {
                if (game.players[opIdx].hand.length <= 3) {
                  const actualDraw = Math.min(2, game.deck.length);
                  if (actualDraw > 0) {
                    game.players[opIdx].hand.push(...game.deck.splice(0, actualDraw));
                    game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${actualDraw} (Ruler 8: Seeing Red)`);
                  }
                }
              });
            }
            // Ruler Q: Ruler's Touch - Play a K, others draw 1
            if ((rulerRank === 'Q' || (rulerRank === 'K' && game.players.some((p, idx) => idx !== game.turn && p.ruler?.rank === 'Q'))) && cardRank === 'K') {
              getOpponents(game.turn).forEach(opIdx => {
                const actualDraw = Math.min(1, game.deck.length);
                if (actualDraw > 0) {
                  game.players[opIdx].hand.push(...game.deck.splice(0, actualDraw));
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${actualDraw} (Ruler Q: Ruler’s Touch)`);
                }
              });
            }
          }

          // Handle Ruler 9: Reverse Nightmare (triggered by any player playing a 9)
          if (cards.length === 1 && cards[0].rank === '9') {
            game.players.forEach((player, idx) => {
              if (player.ruler?.rank === '9' && idx !== game.turn) {
                while (player.hand.length > 5 && game.deck.length > 0) {
                  game.deck.push(player.hand.pop());
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + idx)} discarded to 5 (Ruler 9: Reverse Nightmare)`);
                }
              }
            });
          }

          // Pair Abilities
          if (isPair) {
            game.pairEffect = cards[0].rank;
            game.pairEffectOwner = game.turn;
            let pairDrawAmount = 2; // Default for a normal pair
            if (rulerRank === '2') {
              pairDrawAmount += 2; // Twice the Might: +2 cards
              game.moveHistory.unshift(`Ruler 2: Twice the Might (+2 cards)`);
            }
            // Apply default pair effect (drawing cards) unless overridden
            if (!['5', '6', '7', '8', '9'].includes(cards[0].rank)) {
              getOpponents(game.turn).forEach(opIdx => {
                const drawCount = Math.min(pairDrawAmount, game.deck.length);
                game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Pair${rulerRank === '2' ? ' + Ruler 2' : ''})`);
              });
            }
            switch (cards[0].rank) {
              case 'A':
                game.moveHistory.unshift('Pair A: Opponent must play 10+');
                break;
              case '2':
                getOpponents(game.turn).forEach(opIdx => {
                  const drawCount = Math.min(3, game.deck.length);
                  game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Pair 2: Pair Pair)`);
                });
                break;
              case '3':
                game.moveHistory.unshift('Pair 3: Opponent must play odd');
                break;
              case '4':
                game.moveHistory.unshift('Pair 4: Opponent cannot play 8+');
                break;
              case '5':
                game.pair5Pending = true;
                game.status = `Player ${String.fromCharCode(65 + game.turn)}: Select card to swap with discard (?pair5Choice=card)`;
                break;
              case '6':
                game.pair6Pending = true;
                game.status = `Player ${String.fromCharCode(65 + game.turn)}: Select opponent to skip (?pair6Target=playerIndex)`;
                break;
              case '7':
                game.pair7Pending = true;
                game.status = `Player ${String.fromCharCode(65 + game.turn)}: Select card to swap with deck (?pair7Choice=card)`;
                break;
              case '8':
                game.extraTurn = true;
                game.moveHistory.unshift('Pair 8: Play again and set discard');
                break;
              case '9':
                game.fortActive = true;
                game.fortCard = cards[0];
                game.fortRank = cards[0].rank;
                game.fortOwner = game.turn;
                getOpponents(game.turn).forEach(opIdx => {
                  if (!game.players[opIdx].hand.some(c => game.players[opIdx].hand.some(c2 => c2.rank === c.rank && c !== c2))) {
                    const drawCount = Math.min(1, game.deck.length);
                    game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
                    game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Fort 9)`);
                  }
                });
                break;
              case '10':
                game.moveHistory.unshift('Pair 10: Opponent must play even');
                break;
              case 'J':
                game.moveHistory.unshift('Pair J: Opponent must play 8+');
                break;
              case 'Q':
                getOpponents(game.turn).forEach(opIdx => {
                  const drawCount = Math.min(1, game.deck.length);
                  game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
                  game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Pair Q)`);
                });
                const returnIdx = Math.floor(Math.random() * game.players[game.turn].hand.length);
                game.deck.push(game.players[game.turn].hand.splice(returnIdx, 1)[0]);
                shuffle(game.deck);
                game.moveHistory.unshift(`Player ${String.fromCharCode(65 + game.turn)} returned a card (Pair Q)`);
                break;
              case 'K':
                game.moveHistory.unshift('Pair K: Opponent alternates even/odd');
                break;
            }
          }

          // Three-of-a-Kind Abilities
          if (isToaK) {
            getOpponents(game.turn).forEach(opIdx => {
              const drawCount = Math.min(3, game.deck.length);
              game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Three of a Kind)`);
            });
            if (cards[0].rank === 'A') {
              getOpponents(game.turn).forEach(opIdx => {
                const aceDraw = Math.min(5, game.deck.length);
                game.players[opIdx].hand.push(...game.deck.splice(0, aceDraw));
                game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${aceDraw} (ToaK Aces)`);
              });
            } else {
              game.fortActive = true;
              game.fortCard = cards[0];
              game.fortRank = cards[0].rank;
              game.fortOwner = game.turn;
              game.moveHistory.unshift(`ToaK ${cards[0].rank}: Fort created`);
            }
          }

          // Four-of-a-Kind Abilities
          if (isFourOfAKind) {
            getOpponents(game.turn).forEach(opIdx => {
              const drawCount = Math.min(4, game.deck.length);
              game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
              game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Four of a Kind)`);
            });
            if (rulerRank === '4') {
              // Fourfold: Everyone returns cards to deck, shuffle, others draw 7, player draws 3
              game.players.forEach((player, idx) => {
                if (idx !== game.turn) {
                  game.deck.push(...player.hand);
                  player.hand = [];
                }
              });
              game.deck.push(...game.players[game.turn].hand);
              game.players[game.turn].hand = [];
              shuffle(game.deck);
              getOpponents(game.turn).forEach(opIdx => {
                const drawCount = Math.min(7, game.deck.length);
                game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Ruler 4: Fourfold)`);
              });
              const playerDraw = Math.min(3, game.deck.length);
              game.players[game.turn].hand.push(...game.deck.splice(0, playerDraw));
              game.moveHistory.unshift(`Player ${String.fromCharCode(65 + game.turn)} drew ${playerDraw} (Ruler 4: Fourfold)`);
            }
            // Additional Four of a Kind effects can be added here
          }

          // Fort Logic
          if (game.fortActive) {
            if (game.turn === game.fortOwner) {
              if (cards.length === 1) {
                game.fortActive = false;
                game.fortCard = null;
                game.fortRank = null;
                game.fortOwner = null;
                game.moveHistory.unshift('Fort destroyed by owner (single play)');
              } else if (isPair) {
                game.moveHistory.unshift('Fort maintained by owner (pair)');
              }
            } else if (isPair) {
              const fortValue = rankValue(game.fortRank);
              const pairValue = rankValue(cards[0].rank);
              if (pairValue > fortValue) {
                game.fortActive = false;
                game.fortCard = null;
                game.fortRank = null;
                game.fortOwner = null;
                game.moveHistory.unshift(`Fort destroyed (higher pair: ${cards[0].rank})`);
              } else if (game.fortRank === '9') {
                game.status = `Player ${String.fromCharCode(65 + game.turn)}: Choose to break or maintain fort (?move=break or ?move=maintain)`;
                game.moveHistory.unshift('Fort 9: Choice pending');
              } else {
                game.moveHistory.unshift(`Fort avoided (lower pair: ${cards[0].rank})`);
              }
            } else if (cards.length === 1 && game.fortRank === '9') {
              game.fortActive = false;
              game.fortCard = null;
              game.fortRank = null;
              game.fortOwner = null;
              game.moveHistory.unshift('Fort 9 destroyed (single play by opponent)');
            }
          } else if (game.pairEffectOwner === game.turn && !isPair) {
            game.pairEffect = null;
            game.pairEffectOwner = null;
          }

          const effectName = getActiveEffectName();
          const playMessage = `Player ${String.fromCharCode(65 + game.turn)} played ${cards.map(c => `${c.rank}${c.suit[0]}`).join(', ')}${effectName ? ` (${effectName})` : ''}`;
          game.moveHistory.unshift(playMessage);
          if (game.moveHistory.length > 3) game.moveHistory.pop();

          if (game.players[game.turn].hand.length === 0) {
            game.players[game.turn].wins++;
            const winnerRuler = game.players[game.turn].ruler;
            if (!game.aceOfClubsTriggered && game.players.some((p, idx) => idx !== game.turn && p.ruler?.rank === 'A' && p.ruler?.suit === 'Clubs') && !(winnerRuler?.rank === 'A' && winnerRuler?.suit === 'Clubs')) {
              game.deck.push(...[game.discard, ...game.deck]);
              game.discard = null;
              shuffle(game.deck);
              getOpponents(game.turn).forEach(opIdx => {
                const drawCount = Math.min(7, game.deck.length);
                game.players[opIdx].hand.push(...game.deck.splice(0, drawCount));
                game.moveHistory.unshift(`Player ${String.fromCharCode(65 + opIdx)} drew ${drawCount} (Ace of Clubs)`);
              });
              const winnerDraw = Math.min(5, game.deck.length);
              game.players[game.turn].hand.push(...game.deck.splice(0, winnerDraw));
              game.moveHistory.unshift(`Player ${String.fromCharCode(65 + game.turn)} drew ${winnerDraw} (Ace of Clubs)`);
              game.aceOfClubsTriggered = true;
              game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn: Ace of Clubs reset!`;
            } else if (!game.players[game.turn].kingUsed && rulerRank === 'K' && !hasMultipleKings) {
              game.players[game.turn].hand.push(...dealHand(5));
              game.players[game.turn].kingUsed = true;
              game.status = `Player ${String.fromCharCode(65 + game.turn)} wins but must win again (Ruler K)!`;
            } else {
              game.status = `Player ${String.fromCharCode(65 + game.turn)} wins! Reset to continue.`;
              game.phase = 'over';
            }
          } else if (game.extraTurn && cards[0].rank === '8' && isPair) {
            game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn: Play again and set discard!`;
            game.extraTurn = false;
          } else {
            game.turn = (game.turn + 1) % game.playerCount;
            game.status = `Player ${String.fromCharCode(65 + game.turn)}'s turn!`;
          }
        }
      }
    }
    game.canPlay = game.players[game.turn].hand.some(card => isValidPlay([card], game.discard));
  }

  gameStates[sessionId] = game;

  const response = {
    discard: game.discard && game.discard.rank ? `${game.discard.rank}${game.discard.suit[0]}` : 'None',
    playerAHand: game.players[0]?.hand || [],
    playerBHand: game.players[1]?.hand || [],
    playerARuler: game.players[0]?.ruler ? `${game.players[0].ruler.rank}${game.players[0].ruler.suit[0]}` : 'None',
    playerBRuler: game.players[1]?.ruler ? `${game.players[1].ruler.rank}${game.players[1].ruler.suit[0]}` : 'None',
    status: game.status || 'Error',
    phase: game.phase,
    turn: String.fromCharCode(65 + game.turn),
    session: sessionId,
    moveHistory: game.moveHistory,
    canPlay: game.canPlay,
    pairEffect: game.pairEffect,
    fortActive: game.fortActive,
    fortRank: game.fortRank,
    deckSize: game.deck.length,
    pair5Pending: game.pair5Pending,
    pair6Pending: game.pair6Pending,
    pair7Pending: game.pair7Pending
  };
  console.log('Sending response:', JSON.stringify(response));
  res.status(200).json(response);
}

module.exports = handler;
