import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameEngine } from './GameEngine.js';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Rooms storage
const rooms = new Map();

function broadcastGameState(roomId) {
  const room = rooms.get(roomId);
  if (!room || !room.gameState) return;

  room.players.forEach(player => {
    io.to(player.id).emit('game_update', room.gameState.getPlayerState(player.id));
  });
}

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join_room', ({ roomId, playerName }) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, {
        id: roomId,
        players: [],
        gameState: null
      });
    }

    const room = rooms.get(roomId);
    
    if (room.gameState) {
      // Reconnection logic when game has already started
      const gamePlayer = room.gameState.players.find(p => p.name === playerName);
      if (gamePlayer) {
        // Update socket ID in game state
        gamePlayer.id = socket.id;
        
        // Also update or add to room.players
        const roomPlayer = room.players.find(p => p.name === playerName);
        if (roomPlayer) {
          roomPlayer.id = socket.id;
        } else {
          room.players.push({ id: socket.id, name: playerName });
        }
        
        io.to(roomId).emit('room_update', { players: room.players });
        console.log(`${playerName} (${socket.id}) reconnected to room ${roomId}`);
        
        socket.emit('game_started');
        socket.emit('game_update', room.gameState.getPlayerState(socket.id));
        return;
      } else {
        socket.emit('room_error', 'Game already in progress');
        return;
      }
    }

    if (room.players.length >= 4 && !room.players.find(p => p.name === playerName)) {
      socket.emit('room_error', 'Room is full');
      return;
    }

    const existingRoomPlayer = room.players.find(p => p.name === playerName);
    if (existingRoomPlayer) {
      existingRoomPlayer.id = socket.id;
    } else {
      room.players.push({ id: socket.id, name: playerName });
    }

    io.to(roomId).emit('room_update', { players: room.players });
    console.log(`${playerName} (${socket.id}) joined room ${roomId}`);

    if (room.players.length === 4 && !room.gameState) {
      // Instead of starting immediately, ask the first player to pick their teammate
      io.to(roomId).emit('team_selection', { players: room.players, selectorId: room.players[0].id });
    }
  });

  socket.on('select_teammate', ({ roomId, selectorId, teammateId }) => {
    const room = rooms.get(roomId);
    if (!room || room.gameState) return;
    if (room.players.length !== 4) return;

    // Rearrange players: selector at 0, teammate at 2, others at 1 and 3
    const selector = room.players.find(p => p.id === selectorId);
    const teammate = room.players.find(p => p.id === teammateId);
    const others = room.players.filter(p => p.id !== selectorId && p.id !== teammateId);

    if (!selector || !teammate || others.length !== 2) return;

    room.players = [selector, others[0], teammate, others[1]];

    room.gameState = new GameEngine(room.players);
    room.gameState.startNewRound();
    io.to(roomId).emit('game_started');
    broadcastGameState(roomId);
  });

  socket.on('request_state', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room && room.gameState) {
      socket.emit('game_update', room.gameState.getPlayerState(socket.id));
    }
  });

  socket.on('submit_bid', ({ roomId, bid }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) return;

    const result = room.gameState.handleBid(socket.id, bid);
    if (result.error) {
      socket.emit('game_error', result.error);
    } else {
      if (result.message) {
        io.to(roomId).emit('game_message', result.message);
      }
      broadcastGameState(roomId);
    }
  });

  socket.on('play_card', ({ roomId, card }) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) return;

    const result = room.gameState.playCard(socket.id, card);
    if (result.error) {
      socket.emit('game_error', result.error);
    } else {
      broadcastGameState(roomId);
    }
  });

  socket.on('chat_message', ({ roomId, playerName, text }) => {
    if (!text || !text.trim()) return;
    io.to(roomId).emit('chat_message', {
      playerName,
      text: text.trim(),
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    for (const [roomId, room] of rooms.entries()) {
      const index = room.players.findIndex(p => p.id === socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomId).emit('room_update', { players: room.players });
        if (room.players.length === 0) {
          rooms.delete(roomId);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
