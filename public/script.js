document.addEventListener('DOMContentLoaded', () => {
    const status = document.getElementById('status');
    const discardCard = document.getElementById('discard-card');
    const playerAHand = document.getElementById('player-a-hand');
    const playerBHand = document.getElementById('player-b-hand');
    const playerARuler = document.getElementById('player-a-ruler');
    const playerBRuler = document.getElementById('player-b-ruler');
    const playBtn = document.getElementById('play-btn');
    const drawBtn = document.getElementById('draw-btn');
    const resetBtn = document.getElementById('reset-btn');
    const addCardInput = document.getElementById('add-card-input');
    const addCardBtn = document.getElementById('add-card-btn');
    const historyList = document.getElementById('history-list');

    let selectedCards = [];
    let sessionId = 'default';

    function fetchGameState() {
        fetch(`/api/game?session=${sessionId}`)
            .then(res => res.json())
            .then(data => {
                status.textContent = data.status;
                discardCard.textContent = data.discard;
                playerARuler.textContent = data.playerARuler;
                playerBRuler.textContent = data.playerBRuler;

                playerAHand.innerHTML = '';
                data.playerAHand.forEach(card => {
                    const cardEl = document.createElement('span');
                    cardEl.textContent = `${card.rank}${card.suit[0]}`;
                    cardEl.classList.add('card');
                    cardEl.addEventListener('click', () => toggleCard(cardEl, `${card.rank}${card.suit[0]}`));
                    playerAHand.appendChild(cardEl);
                });

                playerBHand.innerHTML = '';
                data.playerBHand.forEach(card => {
                    const cardEl = document.createElement('span');
                    cardEl.textContent = `${card.rank}${card.suit[0]}`;
                    cardEl.classList.add('card');
                    cardEl.addEventListener('click', () => toggleCard(cardEl, `${card.rank}${card.suit[0]}`));
                    playerBHand.appendChild(cardEl);
                });

                historyList.innerHTML = '';
                data.moveHistory.forEach(move => {
                    const li = document.createElement('li');
                    li.textContent = move;
                    historyList.appendChild(li);
                });

                // Toggle Draw button visibility based on canPlay
                drawBtn.style.display = data.canPlay ? 'none' : 'inline-block';
            })
            .catch(err => console.error('Fetch error:', err));
    }

    function toggleCard(cardEl, card) {
        if (cardEl.classList.contains('selected')) {
            cardEl.classList.remove('selected');
            selectedCards = selectedCards.filter(c => c !== card);
        } else {
            cardEl.classList.add('selected');
            selectedCards.push(card);
        }
    }

    playBtn.addEventListener('click', () => {
        if (selectedCards.length > 0) {
            fetch(`/api/game?session=${sessionId}&move=${selectedCards.join(',')}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    selectedCards = [];
                    fetchGameState();
                })
                .catch(err => console.error('Play error:', err));
        }
    });

    drawBtn.addEventListener('click', () => {
        fetch(`/api/game?session=${sessionId}&move=draw`, { method: 'POST' })
            .then(res => res.json())
            .then(fetchGameState)
            .catch(err => console.error('Draw error:', err));
    });

    resetBtn.addEventListener('click', () => {
        fetch(`/api/game?session=${sessionId}&reset=true`, { method: 'POST' })
            .then(res => res.json())
            .then(fetchGameState)
            .catch(err => console.error('Reset error:', err));
    });

    addCardBtn.addEventListener('click', () => {
        const cardCode = addCardInput.value.trim();
        if (cardCode) {
            fetch(`/api/game?session=${sessionId}&addCards=${cardCode}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    addCardInput.value = '';
                    fetchGameState();
                })
                .catch(err => console.error('Add card error:', err));
        }
    });

    // Initial fetch
    fetchGameState();
    setInterval(fetchGameState, 5000); // Auto-refresh every 5 seconds
});
