const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_MAP = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

class Card {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
    this.rank = VALUE_MAP[value];
  }
}

export class GameEngine {
  constructor(players) {
    // players is an array of exactly 4 player objects: { id, name }
    this.players = players.map((p, i) => ({
      ...p,
      index: i,
      team: i % 2, // 0 and 2 are team 0, 1 and 3 are team 1
      score: 0,
      hand: [],
      bid: null,
      tricksWon: 0
    }));
    
    this.teams = [
      { id: 0, score: 0 },
      { id: 1, score: 0 }
    ];

    this.phase = 'dealing'; // dealing, bidding, playing, game_over
    this.dealerIndex = 0;
    this.currentPlayerIndex = 1; // starts right of dealer
    this.currentTrick = [];
    this.trickLeaderIndex = null;
    this.tarneeb = 'hearts'; // Always hearts in 400
  }

  startNewRound() {
    this.phase = 'bidding';
    this.players.forEach(p => {
      p.bid = null;
      p.tricksWon = 0;
    });
    this.currentTrick = [];
    this.dealCards();
    this.currentPlayerIndex = (this.dealerIndex + 1) % 4;
  }

  dealCards() {
    let deck = [];
    for (let suit of SUITS) {
      for (let value of VALUES) {
        deck.push(new Card(suit, value));
      }
    }
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    // Deal
    for (let i = 0; i < 52; i++) {
      this.players[i % 4].hand.push(deck[i]);
    }
    
    // Sort hands
    this.players.forEach(p => {
      p.hand.sort((a, b) => {
        if (a.suit === b.suit) return a.rank - b.rank;
        return a.suit.localeCompare(b.suit);
      });
    });
  }

  getMinBid(score) {
    if (score >= 50) return 5;
    if (score >= 40) return 4;
    if (score >= 30) return 3;
    return 2;
  }

  getMinTotalBids(teamScore) {
    if (teamScore >= 50) return 14;
    if (teamScore >= 40) return 13;
    if (teamScore >= 30) return 12;
    return 11;
  }

  handleBid(playerId, bidValue) {
    if (this.phase !== 'bidding') return { error: 'Not bidding phase' };
    
    const player = this.players.find(p => p.id === playerId);
    if (player.index !== this.currentPlayerIndex) return { error: 'Not your turn to bid' };
    
    const minBid = this.getMinBid(player.score);
    if (bidValue < minBid) return { error: `Minimum bid is ${minBid} based on your score` };

    player.bid = bidValue;

    // Next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;

    // Check if bidding is done
    if (this.players.every(p => p.bid !== null)) {
      const totalBids = this.players.reduce((sum, p) => sum + p.bid, 0);
      
      // Determine if cards need to be redistributed
      const maxScore = Math.max(...this.players.map(p => p.score));
      const requiredTotal = this.getMinTotalBids(maxScore);

      if (totalBids < requiredTotal) {
        // Restart bidding without dealing new cards
        this.restartBidding();
        return { message: `Total bids too low (${totalBids} < ${requiredTotal}). Please bid again.` };
      } else {
        // Start playing
        this.phase = 'playing';
        this.currentPlayerIndex = (this.dealerIndex + 1) % 4;
        this.trickLeaderIndex = this.currentPlayerIndex;
      }
    }
    
    return { success: true };
  }

  restartBidding() {
    this.players.forEach(p => {
      p.bid = null;
    });
    this.currentPlayerIndex = (this.dealerIndex + 1) % 4;
  }

  playCard(playerId, cardData) {
    if (this.phase !== 'playing') return { error: 'Not playing phase' };
    
    const player = this.players.find(p => p.id === playerId);
    if (player.index !== this.currentPlayerIndex) return { error: 'Not your turn' };

    const cardIndex = player.hand.findIndex(c => c.suit === cardData.suit && c.value === cardData.value);
    if (cardIndex === -1) return { error: 'You do not have this card' };

    const card = player.hand[cardIndex];

    // Validate follow suit
    if (this.currentTrick.length > 0) {
      const ledSuit = this.currentTrick[0].card.suit;
      const hasLedSuit = player.hand.some(c => c.suit === ledSuit);
      if (hasLedSuit && card.suit !== ledSuit) {
        return { error: `You must follow suit (${ledSuit})` };
      }
    }

    // Play card
    player.hand.splice(cardIndex, 1);
    this.currentTrick.push({ playerId, card });

    if (this.currentTrick.length === 4) {
      this.resolveTrick();
    } else {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
    }
    return { success: true };
  }

  resolveTrick() {
    const ledSuit = this.currentTrick[0].card.suit;
    let winningPlay = this.currentTrick[0];

    for (let i = 1; i < 4; i++) {
      const play = this.currentTrick[i];
      const isTrump = play.card.suit === this.tarneeb;
      const winningIsTrump = winningPlay.card.suit === this.tarneeb;

      if (isTrump && !winningIsTrump) {
        winningPlay = play;
      } else if (isTrump && winningIsTrump) {
        if (play.card.rank > winningPlay.card.rank) winningPlay = play;
      } else if (play.card.suit === ledSuit && !winningIsTrump) {
        if (play.card.rank > winningPlay.card.rank) winningPlay = play;
      }
    }

    const winner = this.players.find(p => p.id === winningPlay.playerId);
    winner.tricksWon++;

    this.currentTrick = [];
    this.currentPlayerIndex = winner.index;
    this.trickLeaderIndex = winner.index;

    // Check end of round
    if (this.players[0].hand.length === 0) {
      this.calculateScores();
    }
  }

  getBidScore(bid, won, currentScore) {
    const pointsMapNormal = { 2: 2, 3: 3, 4: 4, 5: 10, 6: 12, 7: 14, 8: 16, 9: 27, 10: 40, 11: 40, 12: 40, 13: 40 };
    const pointsMapHigh =   { 2: 2, 3: 3, 4: 4, 5: 5,  6: 6,  7: 14, 8: 16, 9: 27, 10: 40, 11: 40, 12: 40, 13: 40 };

    const mapToUse = currentScore >= 30 ? pointsMapHigh : pointsMapNormal;
    const points = mapToUse[bid];

    if (won >= bid) {
      return bid; // Based on rules, "only the number they bid is added to their score"
      // Wait, is it the actual bid number, or the value in points?
      // "If a player wins the number of Tricks they bid or more, only the number they bid is added to their score."
      // Let's use the points from the table, as the table "illustrates the points assigned for each bid".
      // E.g., bidding 5 and winning 5+ gives 10 points.
    } else {
      return -points;
    }
  }

  calculateScores() {
    for (let p of this.players) {
      const pointsMapNormal = { 2: 2, 3: 3, 4: 4, 5: 10, 6: 12, 7: 14, 8: 16, 9: 27, 10: 40, 11: 40, 12: 40, 13: 40 };
      const pointsMapHigh =   { 2: 2, 3: 3, 4: 4, 5: 5,  6: 6,  7: 14, 8: 16, 9: 27, 10: 40, 11: 40, 12: 40, 13: 40 };
      const mapToUse = p.score >= 30 ? pointsMapHigh : pointsMapNormal;
      const points = mapToUse[p.bid];

      if (p.tricksWon >= p.bid) {
        p.score += points;
      } else {
        p.score -= points;
      }
    }

    // Check win condition
    const t0p1 = this.players[0];
    const t0p2 = this.players[2];
    const t1p1 = this.players[1];
    const t1p2 = this.players[3];

    const team0Wins = (t0p1.score >= 41 && t0p2.score > 0) || (t0p2.score >= 41 && t0p1.score > 0);
    const team1Wins = (t1p1.score >= 41 && t1p2.score > 0) || (t1p2.score >= 41 && t1p1.score > 0);

    if (team0Wins || team1Wins) {
      this.phase = 'game_over';
      return;
    }

    this.dealerIndex = (this.dealerIndex + 1) % 4;
    this.startNewRound();
  }

  getPublicState() {
    return {
      phase: this.phase,
      dealerIndex: this.dealerIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      currentTrick: this.currentTrick,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        index: p.index,
        team: p.team,
        score: p.score,
        bid: p.bid,
        tricksWon: p.tricksWon,
        handCount: p.hand.length
      }))
    };
  }

  getPlayerState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    return {
      ...this.getPublicState(),
      myHand: player.hand
    };
  }
}
