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
    const pair5Options = document.getElementById('pair-5-options');
    const pair7Options = document.getElementById('pair-7-options');
    const pair6Options = document.getElementById('pair-6-options');
    const discardPileTop = document.getElementById('discard-pile-top');
    const deckTopTwo = document.getElementById('deck-top-two');
    const opponentsList = document.getElementById('opponents-list');
    const confirmSwapBtn = document.getElementById('confirm-swap-btn');
    const confirmSkipBtn = document.getElementById('confirm-skip-btn');
    const pair5Swap = document.getElementById('pair-5-swap');
    const pair5SwapCards = document.getElementById('pair-5-swap-cards');
    const pair7Swap = document.getElementById('pair-7-swap');
    const pair7SwapCards = document.getElementById('pair-7-swap-cards');

    let selectedCards = [];
    let selectedDiscard = null;
    let selectedDeck = null;
    let selectedHandForSwap = null;
    let selectedOpponent = null;
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
                    cardEl.addEventListener('click', () => toggleCard(cardEl, `${card.rank}${card.suit[0]}`, 'hand'));
                    playerAHand.appendChild(cardEl);
                });

                playerBHand.innerHTML = '';
                data.playerBHand.forEach(card => {
                    const cardEl = document.createElement('span');
                    cardEl.textContent = `${card.rank}${card.suit[0]}`;
                    cardEl.classList.add('card');
                    cardEl.addEventListener('click', () => toggleCard(cardEl, `${card.rank}${card.suit[0]}`, 'hand'));
                    playerBHand.appendChild(cardEl);
                });

                historyList.innerHTML = '';
                data.moveHistory.forEach(move => {
                    const li = document.createElement('li');
                    li.textContent = move;
                    historyList.appendChild(li);
                });

                drawBtn.style.display = data.phase === 'play' && !data.canPlay ? 'inline-block' : 'none';

                pair5Options.style.display = data.pair5Pending ? 'block' : 'none';
                pair7Options.style.display = data.pair7Pending ? 'block' : 'none';
                pair6Options.style.display = data.pair6Pending ? 'block' : 'none';
                confirmSwapBtn.style.display = (data.pair5Pending && data.pair5DiscardChoice) || (data.pair7Pending && data.pair7DeckChoice) ? 'inline-block' : 'none';
                confirmSkipBtn.style.display = data.pair6Pending ? 'inline-block' : 'none';

                if (data.pair5Pending && !data.pair5DiscardChoice) {
                    discardPileTop.innerHTML = '';
                    data.discardPileTop.forEach(card => {
                        const cardEl = document.createElement('span');
                        cardEl.textContent = card;
                        cardEl.classList.add('card');
                        cardEl.addEventListener('click', () => toggleCard(cardEl, card, 'discard'));
                        discardPileTop.appendChild(cardEl);
                    });
                    pair5Swap.style.display = 'block';
                    pair5SwapCards.innerHTML = '';
                    data.discardPileTop.forEach(card => {
                        const cardEl = document.createElement('span');
                        cardEl.textContent = card;
                        cardEl.classList.add('card');
                        cardEl.addEventListener('click', () => toggleCard(cardEl, card, 'discard'));
                        pair5SwapCards.appendChild(cardEl);
                    });
                } else {
                    pair5Swap.style.display = 'none';
                }

                if (data.pair7Pending && !data.pair7DeckChoice) {
                    deckTopTwo.innerHTML = '';
                    data.deckTopTwo.forEach(card => {
                        const cardEl = document.createElement('span');
                        cardEl.textContent = card;
                        cardEl.classList.add('card');
                        cardEl.addEventListener('click', () => toggleCard(cardEl, card, 'deck'));
                        deckTopTwo.appendChild(cardEl);
                    });
                    pair7Swap.style.display = 'block';
                    pair7SwapCards.innerHTML = '';
                    data.deckTopTwo.forEach(card => {
                        const cardEl = document.createElement('span');
                        cardEl.textContent = card;
                        cardEl.classList.add('card');
                        cardEl.addEventListener('click', () => toggleCard(cardEl, card, 'deck'));
                        pair7SwapCards.appendChild(cardEl);
                    });
                } else {
                    pair7Swap.style.display = 'none';
                }

                if (data.pair6Pending) {
                    opponentsList.innerHTML = '';
                    data.opponents.forEach(opponent => {
                        const opEl = document.createElement('span');
                        opEl.textContent = opponent;
                        opEl.classList.add('card');
                        opEl.addEventListener('click', () => toggleOpponent(opEl, opponent));
                        opponentsList.appendChild(opEl);
                    });
                }
            })
            .catch(err => console.error('Fetch error:', err));
    }

    function toggleCard(cardEl, card, type) {
        if (cardEl.classList.contains('selected')) {
            cardEl.classList.remove('selected');
            if (type === 'hand' && !selectedHandForSwap) selectedCards = selectedCards.filter(c => c !== card);
            else if (type === 'discard') selectedDiscard = null;
            else if (type === 'deck') selectedDeck = null;
            else if (type === 'hand' && selectedHandForSwap === card) selectedHandForSwap = null;
        } else {
            document.querySelectorAll('.card.selected').forEach(el => {
                if (el !== cardEl && (
                    (type === 'discard' && el.parentElement.id === 'discard-pile-top') ||
                    (type === 'deck' && el.parentElement.id === 'deck-top-two') ||
                    (type === 'hand' && !selectedHandForSwap && el.parentElement.id.includes('hand')) ||
                    (type === 'hand' && selectedHandForSwap && el.parentElement.id.includes('hand'))
                )) el.classList.remove('selected');
            });
            cardEl.classList.add('selected');
            if (type === 'hand' && !selectedDiscard && !selectedDeck) selectedCards.push(card);
            else if (type === 'discard') selectedDiscard = card;
            else if (type === 'deck') selectedDeck = card;
            else if (type === 'hand' && (selectedDiscard || selectedDeck)) selectedHandForSwap = card;
        }
    }

    function toggleOpponent(opEl, opponent) {
        if (opEl.classList.contains('selected')) {
            opEl.classList.remove('selected');
            selectedOpponent = null;
        } else {
            document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));
            opEl.classList.add('selected');
            selectedOpponent = opponent;
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

    confirmSwapBtn.addEventListener('click', () => {
        if (selectedDiscard && selectedHandForSwap) {
            fetch(`/api/game?session=${sessionId}&pair5DiscardChoice=${selectedDiscard}&pair5HandChoice=${selectedHandForSwap}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    selectedDiscard = null;
                    selectedHandForSwap = null;
                    fetchGameState();
                })
                .catch(err => console.error('Pair 5 swap error:', err));
        } else if (selectedDeck && selectedHandForSwap) {
            fetch(`/api/game?session=${sessionId}&pair7DeckChoice=${selectedDeck}&pair7HandChoice=${selectedHandForSwap}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    selectedDeck = null;
                    selectedHandForSwap = null;
                    fetchGameState();
                })
                .catch(err => console.error('Pair 7 swap error:', err));
        }
    });

    confirmSkipBtn.addEventListener('click', () => {
        if (selectedOpponent) {
            const targetIdx = selectedOpponent.charCodeAt(0) - 65;
            fetch(`/api/game?session=${sessionId}&pair6Target=${targetIdx}`, { method: 'POST' })
                .then(res => res.json())
                .then(data => {
                    selectedOpponent = null;
                    fetchGameState();
                })
                .catch(err => console.error('Pair 6 skip error:', err));
        }
    });

    fetchGameState();
    setInterval(fetchGameState, 5000);
});
