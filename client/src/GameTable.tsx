import { useEffect, useState, useRef } from 'react';
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

interface ChatMsg {
  playerName: string;
  text: string;
  timestamp: number;
}

export function GameTable({ roomId, playerName }: { roomId: string; playerName: string }) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bidValue, setBidValue] = useState<number>(2);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastTricksWon, setLastTricksWon] = useState<Record<string, number>>({});
  const [trickWinnerId, setTrickWinnerId] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (gameState) {
      const currentTricks = gameState.players.reduce((acc, p) => {
        acc[p.id] = p.tricksWon;
        return acc;
      }, {} as Record<string, number>);
      const winner = gameState.players.find(p => p.tricksWon > (lastTricksWon[p.id] || 0));
      if (winner && Object.keys(lastTricksWon).length > 0) {
        setTrickWinnerId(winner.id);
        setTimeout(() => setTrickWinnerId(null), 2000);
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

    socket.on('chat_message', (msg: ChatMsg) => {
      setChatMessages(prev => [...prev, msg]);
      setUnread(prev => chatOpen ? 0 : prev + 1);
    });

    return () => {
      socket.off('game_update');
      socket.off('game_error');
      socket.off('game_message');
      socket.off('chat_message');
    };
  }, []);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnread(0);
    }
  }, [chatMessages, chatOpen]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socket.emit('chat_message', { roomId, playerName, text: chatInput });
    setChatInput('');
  };

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
    if (hasLedSuit) return gameState.myHand.filter(c => c.suit === ledSuit);
    return gameState.myHand;
  };

  const playableCards = getPlayableCards();
  const isCardPlayable = (card: Card) => playableCards.some(c => c.suit === card.suit && c.value === card.value);

  const renderCard = (card: Card, playable = false, onClick?: () => void) => (
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

  const displayTrick = gameState.currentTrick.length > 0 ? gameState.currentTrick : (gameState.lastTrick || []);
  const isShowingLastTrick = gameState.currentTrick.length === 0;

  return (
    <div className="game-board">
      {/* Error toast */}
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

      {/* Scoreboard */}
      <div className="scoreboard glass-panel">
        <h3>400</h3>
        <div className="teams">
          {gameState.players.map(p => (
            <div key={p.id} className={`score-row ${p.id === socket.id ? 'score-me' : ''}`}>
              <span className="score-name">{p.name}</span>
              <span className="score-value">{p.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat toggle button */}
      <button
        className="chat-toggle-btn glass-panel"
        onClick={() => { setChatOpen(o => !o); setUnread(0); }}
        aria-label="Toggle chat"
      >
        💬 {unread > 0 && <span className="chat-badge">{unread}</span>}
      </button>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
            className="chat-panel glass-panel"
          >
            <div className="chat-header">
              <span>Chat</span>
              <button className="chat-close" onClick={() => setChatOpen(false)}>✕</button>
            </div>
            <div className="chat-messages">
              {chatMessages.length === 0 && (
                <p className="chat-empty">No messages yet...</p>
              )}
              {chatMessages.map((msg, i) => (
                <div key={i} className={`chat-msg ${msg.playerName === playerName ? 'chat-mine' : ''}`}>
                  <span className="chat-author">{msg.playerName === playerName ? 'You' : msg.playerName}</span>
                  <span className="chat-text">{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-form" onSubmit={handleSendChat}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Message..."
                maxLength={200}
                className="chat-input"
              />
              <button type="submit" className="chat-send-btn">➤</button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bidding modal */}
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

      {/* Game table */}
      <div className="table-area">
        {/* Top opponent */}
        <div className="player-top opponent">
          <div className="glass-panel stat-box">
            <AnimatePresence>
              {trickWinnerId === gameState.players[(me!.index + 2) % 4].id && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -20 }} exit={{ opacity: 0 }} className="trick-won-badge">+1 Trick!</motion.div>
              )}
            </AnimatePresence>
            <span className="player-name">{gameState.players[(me!.index + 2) % 4].name}</span>
            <span className="player-role">Team {(me!.index + 2) % 2}</span>
            <div className="card-back-count">🃏 {gameState.players[(me!.index + 2) % 4].handCount}</div>
            {gameState.phase === 'playing' && (
              <div className="bid-info">Bid {gameState.players[(me!.index + 2) % 4].bid} | ✓{gameState.players[(me!.index + 2) % 4].tricksWon}</div>
            )}
          </div>
        </div>

        <div className="middle-row">
          {/* Left opponent */}
          <div className="player-left opponent">
            <div className="glass-panel stat-box">
              <span className="player-name">{gameState.players[(me!.index + 1) % 4].name}</span>
              <span className="player-role">Team {(me!.index + 1) % 2}</span>
              <div className="card-back-count">🃏 {gameState.players[(me!.index + 1) % 4].handCount}</div>
              {gameState.phase === 'playing' && (
                <div className="bid-info">Bid {gameState.players[(me!.index + 1) % 4].bid} | ✓{gameState.players[(me!.index + 1) % 4].tricksWon}</div>
              )}
            </div>
          </div>

          {/* Center trick area */}
          <div className="trick-center">
            {displayTrick.map((play, idx) => {
              const p = gameState.players.find(p => p.id === play.playerId);
              const diff = (p!.index - me!.index + 4) % 4;
              const isWinner = isShowingLastTrick && play.playerId === gameState.lastTrickWinnerId;
              return (
                <div key={idx} className={`trick-slot trick-pos-${diff} ${isShowingLastTrick ? 'last-trick' : ''} ${isWinner ? 'trick-winner' : ''}`}>
                  {renderCard(play.card, false)}
                </div>
              );
            })}
          </div>

          {/* Right opponent */}
          <div className="player-right opponent">
            <div className="glass-panel stat-box">
              <AnimatePresence>
                {trickWinnerId === gameState.players[(me!.index + 3) % 4].id && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -20 }} exit={{ opacity: 0 }} className="trick-won-badge">+1 Trick!</motion.div>
                )}
              </AnimatePresence>
              <span className="player-name">{gameState.players[(me!.index + 3) % 4].name}</span>
              <span className="player-role">Team {(me!.index + 3) % 2}</span>
              <div className="card-back-count">🃏 {gameState.players[(me!.index + 3) % 4].handCount}</div>
              {gameState.phase === 'playing' && (
                <div className="bid-info">Bid {gameState.players[(me!.index + 3) % 4].bid} | ✓{gameState.players[(me!.index + 3) % 4].tricksWon}</div>
              )}
            </div>
          </div>
        </div>

        {/* My area */}
        <div className="player-bottom">
          <div className="my-info glass-panel">
            <AnimatePresence>
              {trickWinnerId === me?.id && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: -20 }} exit={{ opacity: 0 }} className="trick-won-badge">+1 Trick!</motion.div>
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
              ) : 'Waiting...'}
            </div>
            {gameState.phase === 'playing' && (
              <div className="bid-info">Bid: {me?.bid} | ✓{me?.tricksWon}</div>
            )}
          </div>

          <div className="my-hand">
            <AnimatePresence>
              {gameState.myHand?.map((card) => {
                const playable = isCardPlayable(card);
                return (
                  <div key={`${card.suit}-${card.value}`} className="hand-slot">
                    {renderCard(card, playable, playable ? () => handlePlayCard(card) : undefined)}
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