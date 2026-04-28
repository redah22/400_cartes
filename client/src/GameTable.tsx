import { useEffect, useState } from 'react';
import { socket } from './socket';
import { motion, AnimatePresence } from 'framer-motion';

interface Card {
  suit: string;
  value: string;
  rank: number;
}

interface PlayerState {
  id: string;
  name: string;
  index: number;
  team: number;
  score: number;
  bid: number | null;
  tricksWon: number;
  handCount: number;
}

interface GameState {
  phase: string;
  dealerIndex: number;
  currentPlayerIndex: number;
  currentTrick: { playerId: string; card: Card }[];
  lastTrick: { playerId: string; card: Card }[];
  lastTrickWinnerId: string | null;
  players: PlayerState[];
  myHand?: Card[];
}

export function GameTable({ roomId }: { roomId: string }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bidValue, setBidValue] = useState<number>(2);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastTricksWon, setLastTricksWon] = useState<Record<string, number>>({});
  const [trickWinnerId, setTrickWinnerId] = useState<string | null>(null);

  useEffect(() => {
    if (gameState) {
      const currentTricks = gameState.players.reduce((acc, p) => {
        acc[p.id] = p.tricksWon;
        return acc;
      }, {} as Record<string, number>);

      // Check if someone's tricks won increased
      const winner = gameState.players.find(p => p.tricksWon > (lastTricksWon[p.id] || 0));
      if (winner && Object.keys(lastTricksWon).length > 0) {
        setTrickWinnerId(winner.id);
        setTimeout(() => setTrickWinnerId(null), 2000); // hide after 2s
      }
      setLastTricksWon(currentTricks);
    }
  }, [gameState]);

  useEffect(() => {
    socket.emit('request_state', { roomId });

    socket.on('game_update', (state: GameState) => {
      setGameState(state);
      setErrorMsg('');
    });

    socket.on('game_error', (msg: string) => {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(''), 3000);
    });
    
    socket.on('game_message', (msg: string) => {
      console.log(msg);
    });

    return () => {
      socket.off('game_update');
      socket.off('game_error');
      socket.off('game_message');
    };
  }, []);

  if (!gameState) return (
    <div className="game-board loading">
      <motion.div 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="loader-spinner"
      />
      <p>Loading game state...</p>
    </div>
  );

  const me = gameState.players.find(p => p.id === socket.id);
  const myTurn = me?.index === gameState.currentPlayerIndex;

  const handleBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    socket.emit('submit_bid', { roomId, bid: bidValue });
  };

  const handlePlayCard = (card: Card) => {
    if (!myTurn || gameState.phase !== 'playing') return;
    socket.emit('play_card', { roomId, card });
  };

  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };

  const getSuitColor = (suit: string) => {
    return suit === 'hearts' || suit === 'diamonds' ? '#ef4444' : '#2f3640';
  };

  const getPlayableCards = () => {
    if (!myTurn || gameState.phase !== 'playing' || !gameState.myHand) return [];
    if (gameState.currentTrick.length === 0) return gameState.myHand;
    
    const ledSuit = gameState.currentTrick[0].card.suit;
    const hasLedSuit = gameState.myHand.some(c => c.suit === ledSuit);
    
    if (hasLedSuit) {
      return gameState.myHand.filter(c => c.suit === ledSuit);
    }
    return gameState.myHand;
  };

  const playableCards = getPlayableCards();
  const isCardPlayable = (card: Card) => playableCards.some(c => c.suit === card.suit && c.value === card.value);

  const renderCard = (card: Card, playable = false, onClick?: () => void) => {
    return (
      <motion.div
        layoutId={`card-${card.suit}-${card.value}`}
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        whileHover={playable ? { y: -15, scale: 1.05 } : {}}
        whileTap={playable ? { scale: 0.95 } : {}}
        className={`playing-card ${playable ? 'playable' : ''}`}
        onClick={playable ? onClick : undefined}
      >
        <div className="card-inner" style={{ color: getSuitColor(card.suit) }}>
          <span className="card-value top-left">{card.value}{getSuitSymbol(card.suit)}</span>
          <span className="card-center-suit">{getSuitSymbol(card.suit)}</span>
          <span className="card-value bottom-right">{card.value}{getSuitSymbol(card.suit)}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="game-board">
      <AnimatePresence>
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="game-toast-error"
          >
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="scoreboard glass-panel">
        <h3>Tarneeb 400</h3>
        <div className="teams">
          <div className="team">
            <span>Team 0 (P1 & P3)</span>
            <span className="score-value">{gameState.players.filter(p => p.team === 0).reduce((acc, p) => acc + p.score, 0)}</span>
          </div>
          <div className="team">
            <span>Team 1 (P2 & P4)</span>
            <span className="score-value">{gameState.players.filter(p => p.team === 1).reduce((acc, p) => acc + p.score, 0)}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {gameState.phase === 'bidding' && myTurn && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="bidding-modal glass-panel"
          >
            <h2>Your Turn to Bid</h2>
            <p>Your current score: <span className="highlight">{me?.score}</span></p>
            <form onSubmit={handleBidSubmit}>
              <input 
                type="number" 
                min="2" max="13" 
                value={bidValue} 
                onChange={e => setBidValue(parseInt(e.target.value))} 
              />
              <button type="submit" className="primary-btn">Place Bid</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="table-area">
        {/* Top Player */}
        <div className="player-top opponent">
          <div className="glass-panel stat-box">
            <AnimatePresence>
              {trickWinnerId === gameState.players[(me!.index + 2) % 4].id && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -20 }} exit={{ opacity: 0 }} className="trick-won-badge">
                  +1 Trick!
                </motion.div>
              )}
            </AnimatePresence>
            <span className="player-name">{gameState.players[(me!.index + 2) % 4].name}</span>
            <span className="player-role">Team {(me!.index + 2) % 4 % 2}</span>
            <div className="card-back-count">Cards: {gameState.players[(me!.index + 2) % 4].handCount}</div>
            {gameState.phase === 'playing' && (
              <div className="bid-info">Bid: {gameState.players[(me!.index + 2) % 4].bid} | Won: {gameState.players[(me!.index + 2) % 4].tricksWon}</div>
            )}
          </div>
        </div>

        <div className="middle-row">
          {/* Left Player */}
          <div className="player-left opponent">
            <div className="glass-panel stat-box">
              <span className="player-name">{gameState.players[(me!.index + 1) % 4].name}</span>
              <span className="player-role">Team {(me!.index + 1) % 4 % 2}</span>
              <div className="card-back-count">Cards: {gameState.players[(me!.index + 1) % 4].handCount}</div>
              {gameState.phase === 'playing' && (
                <div className="bid-info">Bid: {gameState.players[(me!.index + 1) % 4].bid} | Won: {gameState.players[(me!.index + 1) % 4].tricksWon}</div>
              )}
            </div>
          </div>

          {/* Current Trick / Center */}
          <div className="trick-center">
            {(gameState.currentTrick.length > 0 ? gameState.currentTrick : (gameState.lastTrick || [])).map((play, idx) => {
              const p = gameState.players.find(p => p.id === play.playerId);
              const diff = (p!.index - me!.index + 4) % 4;
              const isLastTrick = gameState.currentTrick.length === 0;
              const isWinner = isLastTrick && play.playerId === gameState.lastTrickWinnerId;
              return (
                <div key={idx} className={`trick-slot trick-pos-${diff} ${isLastTrick ? 'last-trick' : ''} ${isWinner ? 'trick-winner' : ''}`}>
                  {renderCard(play.card, false)}
                </div>
              );
            })}
          </div>

          {/* Right Player */}
          <div className="player-right opponent">
            <div className="glass-panel stat-box">
              <AnimatePresence>
                {trickWinnerId === gameState.players[(me!.index + 3) % 4].id && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -20 }} exit={{ opacity: 0 }} className="trick-won-badge">
                    +1 Trick!
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="player-name">{gameState.players[(me!.index + 3) % 4].name}</span>
              <span className="player-role">Team {(me!.index + 3) % 4 % 2}</span>
              <div className="card-back-count">Cards: {gameState.players[(me!.index + 3) % 4].handCount}</div>
              {gameState.phase === 'playing' && (
                <div className="bid-info">Bid: {gameState.players[(me!.index + 3) % 4].bid} | Won: {gameState.players[(me!.index + 3) % 4].tricksWon}</div>
              )}
            </div>
          </div>
        </div>

        {/* My Player */}
        <div className="player-bottom">
          <div className="my-info glass-panel">
            <AnimatePresence>
              {trickWinnerId === me?.id && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -20 }} exit={{ opacity: 0 }} className="trick-won-badge">
                  +1 Trick!
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <span className="player-name">{me?.name}</span>
              <span className="player-role"> (Team {me?.team})</span>
            </div>
            <div className="status-badge">
              {myTurn ? (
                <motion.span 
                  animate={{ opacity: [1, 0.5, 1] }} 
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="turn-indicator"
                >
                  ★ Your Turn!
                </motion.span>
              ) : "Waiting for others..."} 
            </div>
            {gameState.phase === 'playing' && (
              <div className="bid-info">My Bid: {me?.bid} | Tricks Won: {me?.tricksWon}</div>
            )}
          </div>
          
          <div className="my-hand">
            <AnimatePresence>
              {gameState.myHand?.map((card) => {
                const playable = isCardPlayable(card);
                return (
                  <div key={`${card.suit}-${card.value}`} className="hand-slot">
                    {renderCard(
                      card, 
                      playable, 
                      playable ? () => handlePlayCard(card) : undefined
                    )}
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}