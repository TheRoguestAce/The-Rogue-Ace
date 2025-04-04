// Ruler abilities
const showRulerAbilities = (playerIdx) => {
  const ruler = gameData.players[playerIdx].ruler;
  console.log('Ruler clicked:', ruler, 'for Player', playerIdx + 1); // Debug
  if (!ruler) {
    setEffectsDisplay(`Player ${playerIdx + 1} has no ruler selected.`);
    return;
  }
  const effects = {
    'A': 'Ace: Play any odd card anytime.',
    '2': 'Two: Pairs make opponents draw 2 extra cards.',
    '3': 'Three: Play a 7 anytime, opponents draw 2.',
    'K': 'King: Win twice to end game.'
  };
  const rulerRank = ruler.slice(0, -1);
  setEffectsDisplay(`Player ${playerIdx + 1} Ruler (${ruler}): ${effects[rulerRank] || 'No special effect.'}`);
};

// Card effects with pair 5/7
const showCardEffects = (cardsToCheck) => {
  if (!cardsToCheck.length) {
    setEffectsDisplay('');
    return;
  }
  const ranks = cardsToCheck.map(c => c.slice(0, -1));
  const isPair = cardsToCheck.length === 2 && ranks[0] === ranks[1];
  const isToaK = cardsToCheck.length === 3 && ranks.every(r => r === ranks[0]);

  let effectText = '';
  if (isPair) {
    const pairEffects = {
      '2': 'Opponents draw 3 cards.',
      '3': 'Opponents must play odd cards next turn.',
      '5': `Swap a card with the discard pile (${gameData.discard || 'None'}).`,
      '7': `Swap a card with the deck (top: ${gameData.deck[0] || 'None'}).`,
      'K': 'Opponents alternate even/odd next turn.'
    };
    effectText = pairEffects[ranks[0]] || 'Opponents draw 2 cards.';
  } else if (isToaK) {
    effectText = ranks[0] === 'A' ? 'Opponents draw 8 cards.' : 'Opponents draw 3 cards.';
  } else if (cardsToCheck.length === 1) {
    const cardRank = ranks[0];
    const rulerRank = gameData.players[gameData.turn].ruler?.slice(0, -1);
    if (rulerRank === '3' && cardRank === '7') effectText = 'Ruler 3: Opponents draw 2 cards.';
    else if (cardRank === gameData.discard?.slice(0, -1)) effectText = 'Matches discard rank.';
    else effectText = 'No special effect.';
  } else {
    effectText = 'No special effect for this combination.';
  }
  console.log('Setting effect:', effectText); // Debug
  setEffectsDisplay(`Selected Cards (${cardsToCheck.join(', ')}): ${effectText}`);
};

// Render fixes for Turn/Discard
if (!gameData) return <div>Loading...</div>;

return (
  <div className="game">
    <h1>The Rogue Ace</h1>
    <div>Status: <span>{gameData.status}</span></div>
    <div>Turn: <span>Player {gameData.turn + 1}</span></div>
    <div>Discard: <span>{gameData.discard || 'None'}</span></div>
    {/* Rest of the render */}
  </div>
);
