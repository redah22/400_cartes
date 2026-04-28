import { useEffect, useState } from 'react';
import { socket } from './socket';
import { Users, LogIn } from 'lucide-react';
import { GameTable } from './GameTable';
import './App.css';

interface Player {
  id: string;
  name: string;
}

function App() {
  const [inRoom, setInRoom] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState('');

  // Team selection state
  const [teamSelectionPlayers, setTeamSelectionPlayers] = useState<Player[]>([]);
  const [selectorId, setSelectorId] = useState<string | null>(null);

  useEffect(() => {
    function onDisconnect() {
      setInRoom(false);
      setGameStarted(false);
      setTeamSelectionPlayers([]);
      setSelectorId(null);
    }

    function onRoomUpdate({ players }: { players: Player[] }) {
      setPlayers(players);
    }

    function onRoomError(msg: string) {
      setError(msg);
      setInRoom(false);
    }

    function onGameStarted() {
      setTeamSelectionPlayers([]);
      setSelectorId(null);
      setGameStarted(true);
    }

    function onTeamSelection({ players, selectorId }: { players: Player[]; selectorId: string }) {
      setTeamSelectionPlayers(players);
      setSelectorId(selectorId);
    }

    socket.on('disconnect', onDisconnect);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_error', onRoomError);
    socket.on('game_started', onGameStarted);
    socket.on('team_selection', onTeamSelection);

    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('room_update', onRoomUpdate);
      socket.off('room_error', onRoomError);
      socket.off('game_started', onGameStarted);
      socket.off('team_selection', onTeamSelection);
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId.trim() || !playerName.trim()) {
      setError('Please enter both name and room code.');
      return;
    }
    setError('');
    socket.connect();
    socket.emit('join_room', { roomId, playerName });
    setInRoom(true);
  };

  const handleSelectTeammate = (teammateId: string) => {
    socket.emit('select_teammate', { roomId, selectorId, teammateId });
  };

  if (inRoom) {
    if (gameStarted) {
      return <GameTable roomId={roomId} playerName={playerName} />;
    }

    // ── Team selection phase ──
    if (teamSelectionPlayers.length === 4 && selectorId) {
      const amISelector = socket.id === selectorId;
      const selector = teamSelectionPlayers.find(p => p.id === selectorId);
      const candidates = teamSelectionPlayers.filter(p => p.id !== selectorId);

      return (
        <div className="login-container">
          <div className="login-box team-select-box">
            <h1>Choose Your Teammate</h1>
            {amISelector ? (
              <>
                <p className="team-select-subtitle">Pick the player you want on your team:</p>
                <div className="teammate-list">
                  {candidates.map(p => (
                    <button
                      key={p.id}
                      className="teammate-btn"
                      onClick={() => handleSelectTeammate(p.id)}
                    >
                      🤝 {p.name}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="team-select-subtitle">
                Waiting for <strong>{selector?.name}</strong> to choose their teammate...
              </p>
            )}
            <div className="player-chips">
              {teamSelectionPlayers.map(p => (
                <span key={p.id} className={`chip ${p.id === socket.id ? 'chip-me' : ''}`}>
                  {p.name} {p.id === socket.id ? '(You)' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ── Lobby waiting ──
    return (
      <div className="game-container">
        <header className="game-header">
          <h1>Room: {roomId}</h1>
          <div className="player-count">
            <Users size={20} />
            <span>{players.length} / 4 Players</span>
          </div>
        </header>
        <div className="lobby-wait">
          <h2>Waiting for players...</h2>
          <ul className="player-list">
            {players.map((p, idx) => (
              <li key={p.id}>
                Player {idx + 1}: {p.name} {p.id === socket.id ? '(You)' : ''}
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Tarneeb 400</h1>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleJoin}>
          <div className="input-group">
            <label htmlFor="playerName">Your Name</label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Tarek"
            />
          </div>
          <div className="input-group">
            <label htmlFor="roomId">Room Code</label>
            <input
              id="roomId"
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              placeholder="e.g. LEB400"
            />
          </div>
          <button type="submit" className="join-btn">
            <LogIn size={20} />
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
