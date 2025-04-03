import React, { useState, useEffect } from 'react';

const suits = ['D', 'H', 'S', 'C'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function App() {
  const [gameData, setGameData] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [effectsDisplay, setEffectsDisplay] = useState('');
  const [sessionId] = useState(new URLSearchParams(window.location.search).get('session') || 'default');

  useEffect(() => {
    fetchGameState();
  }, []);

  const fetchGameState = async () => {
    try {
      const response = await fetch(`/api/game?session=${sessionId}`);
      const data = await response.json();
      setGameData(data);
      setSelectedCards(prev => prev.filter(card => 
        data.players[data.currentPlayer].hand.includes(card)
      ));
      if (!selectedCards.length) setEffectsDisplay(''); // Clear effects if no cards selected
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  const isRed = (card) => ['D', 'H'].includes(card.slice(-1));
  const rankValue = (rank) => ({ A: 1, J: 11, Q: 12, K: 13 }[rank] || parseInt(rank));

  const toggleCardSelection = (card) => {
    if (gameData.currentPlayer !== gameData.turn) return;
    setSelectedCards(prev => {
      const newSelection = prev.includes(card)
        ? prev.filter(c => c !== card)
        : [...prev, card];
      if (newSelection.length > 0) {
        showCardEffects(newSelection); // Show effects immediately on selection
      } else {
        setEffectsDisplay(''); // Clear if nothing selected
      }
      return newSelection;
    });
  };

  const showRulerAbilities = (playerIdx) => {
    const ruler = gameData.players[playerIdx].ruler;
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
        '7': 'Swap a card with the deck.',
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
    setEffectsDisplay(`Selected Cards (${cardsToCheck.join(', ')}): ${effectText}`);
  };

  const playCards = async () => {
    if (!selectedCards.length) {
      alert('Select at least one card to play!');
      return;
    }
    try {
      const response = await fetch(`/api/game?session=${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move: selectedCards })
      });
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        const effectText = effectsDisplay.split(': ')[1] || 'Played cards.';
        setGameData(prev => ({
          ...prev,
          moveHistory: [`Player ${prev.turn + 1} played ${selectedCards.join(', ')}: ${effectText}`, ...(prev.moveHistory || [])].slice(0, 5)
        }));
        setSelectedCards([]);
        setEffectsDisplay('');
        await fetchGameState();
      }
    } catch (error) {
      console.error('Error playing cards:', error);
    }
  };

  const drawCard = async () => {
    await fetch(`/api/game?session=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move: 'draw' })
    });
    await fetchGameState();
  };

  const resetGame = async () => {
    await fetch(`/api/game?session=${sessionId}&reset=true`, { method: 'POST' });
    setSelectedCards([]);
    setEffectsDisplay('');
    await fetchGameState();
  };

  if (!gameData) return <div>Loading...</div>;

  return (
    <div className="game">
      <h1>The Rogue Ace</h1>
      <div>Status: <span>{gameData.status}</span></div>
      <div>Turn: <span>Player {gameData.turn + 1}</span></div>
      <div>Discard: <span>{gameData.discard || 'None'}</span></div>
      {gameData.players.map((player, idx) => (
        <div key={idx}>
          <div>Player {idx + 1} Hand:
            <div className="hand">
              {player.hand.map((card, i) => (
                <span
                  key={i}
                  className={`card ${isRed(card) ? 'red' : ''} ${selectedCards.includes(card) && gameData.turn === idx ? 'selected' : ''}`}
                  onClick={() => toggleCardSelection(card)}
                >
                  {card}
                </span>
              ))}
            </div>
          </div>
          <div>Player {idx + 1} Ruler: 
            <span className="ruler" onClick={() => showRulerAbilities(idx)}>{player.ruler || 'None'}</span>
          </div>
        </div>
      ))}
      <div>Deck Size: <span>{gameData.deck.length}</span></div>
      <div className="effects">{effectsDisplay}</div>
      <div>Move History:
        <div className="history">{(gameData.moveHistory || []).map((move, idx) => <div key={idx}>{move}</div>)}</div>
      </div>
      <div className="controls">
        <button onClick={drawCard} disabled={!gameData.deck.length}>Draw</button>
        <button onClick={playCards} disabled={!selectedCards.length || !gameData.canPlay}>Play</button>
        <button onClick={resetGame}>Reset</button>
      </div>
    </div>
  );
}

export default App;
