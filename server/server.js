/**
 * Main Server
 * Entry point for the multiplayer FPS game server
 * Handles Express setup, Socket.IO connections, and event routing
 */

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const RoomManager = require('./roomManager');
const PlayerManager = require('./playerManager');
const GameLogic = require('./gameLogic');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled for development
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Initialize managers
const roomManager = new RoomManager();
const playerManager = new PlayerManager();
const gameLogic = new GameLogic(roomManager, playerManager, io);

// Start game loop
gameLogic.startGameLoop();

/**
 * Socket.IO Connection Handler
 */
io.on('connection', (socket) => {
  console.log(`[Server] Client connected: ${socket.id}`);

  // Send current room list on connection
  socket.emit('roomList', { rooms: roomManager.getRoomList() });

  /**
   * Create Room Event
   * Client requests to create a new room
   */
  socket.on('createRoom', (data) => {
    const { username } = data;

    // Validate username
    if (!username || username.trim().length < 3 || username.trim().length > 15) {
      socket.emit('error', { message: 'Username must be 3-15 characters' });
      return;
    }

    const trimmedUsername = username.trim();

    try {
      // Create room
      const roomCode = roomManager.createRoom();

      // Join the socket to the room
      socket.join(roomCode);

      // Join room and add player
      const result = roomManager.joinRoom(roomCode, socket.id, trimmedUsername);

      if (result.success) {
        // Add player to player manager
        playerManager.addPlayer(socket.id, trimmedUsername, roomCode, result.playerColor);

        // Send success response
        socket.emit('roomCreated', { roomCode: roomCode });
        socket.emit('roomJoined', {
          roomCode: roomCode,
          players: result.players,
          yourColor: result.playerColor
        });

        // Broadcast updated room list to all clients
        io.emit('roomList', { rooms: roomManager.getRoomList() });

        console.log(`[Server] Room ${roomCode} created by ${trimmedUsername}`);
      }
    } catch (error) {
      console.error('[Server] Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  /**
   * Join Room Event
   * Client requests to join an existing room
   */
  socket.on('joinRoom', (data) => {
    const { username, roomCode } = data;

    // Validate username
    if (!username || username.trim().length < 3 || username.trim().length > 15) {
      socket.emit('error', { message: 'Username must be 3-15 characters' });
      return;
    }

    // Validate room code
    if (!roomCode || roomCode.length !== 6) {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }

    const trimmedUsername = username.trim();
    const upperRoomCode = roomCode.toUpperCase();

    // Join room
    const result = roomManager.joinRoom(upperRoomCode, socket.id, trimmedUsername);

    if (result.success) {
      // Join the socket to the room
      socket.join(upperRoomCode);

      // Add player to player manager
      playerManager.addPlayer(socket.id, trimmedUsername, upperRoomCode, result.playerColor);

      // Send success response to joiner
      socket.emit('roomJoined', {
        roomCode: upperRoomCode,
        players: result.players,
        yourColor: result.playerColor
      });

      // Broadcast to room that player joined
      socket.to(upperRoomCode).emit('playerJoined', {
        playerId: socket.id,
        username: trimmedUsername,
        color: result.playerColor
      });

      // Broadcast updated room list to all clients
      io.emit('roomList', { rooms: roomManager.getRoomList() });

      console.log(`[Server] ${trimmedUsername} joined room ${upperRoomCode}`);
    } else {
      socket.emit('error', { message: result.error });
    }
  });

  /**
   * Leave Room Event
   * Client requests to leave current room
   */
  socket.on('leaveRoom', () => {
    const roomCode = roomManager.findPlayerRoom(socket.id);

    if (roomCode) {
      handlePlayerLeaveRoom(socket, roomCode);
    }
  });

  /**
   * Player Ready Event
   * Player toggles ready status in waiting room
   */
  socket.on('playerReady', (data) => {
    const { ready } = data;
    const roomCode = roomManager.findPlayerRoom(socket.id);

    if (!roomCode) {
      return;
    }

    const player = roomManager.getPlayer(roomCode, socket.id);
    if (!player) {
      return;
    }

    // Set ready status
    const success = roomManager.setPlayerReady(roomCode, socket.id, ready, io);

    if (success) {
      // Broadcast ready status to room
      io.to(roomCode).emit('playerReadyStatus', {
        playerId: socket.id,
        username: player.username,
        ready: ready
      });
    }
  });

  /**
   * Request Room List Event
   * Client requests updated room list
   */
  socket.on('requestRoomList', () => {
    socket.emit('roomList', { rooms: roomManager.getRoomList() });
  });

  /**
   * Player Input Event
   * Client sends player input for server processing
   */
  socket.on('playerInput', (data) => {
    playerManager.updatePlayerInput(socket.id, data);
  });

  /**
   * Player Shoot Event
   * Client fires weapon
   */
  socket.on('playerShoot', (data) => {
    const player = playerManager.getPlayer(socket.id);

    if (!player || !player.isAlive) {
      return;
    }

    // Process shot on server
    const result = gameLogic.processShot(socket.id, data);

    if (result) {
      // Broadcast shot fired to all players in room
      io.to(player.roomCode).emit('shotFired', {
        shooterId: socket.id,
        weapon: player.weapon,
        direction: data.direction,
        hit: result.hit,
        hitPosition: result.hitPosition
      });
    }
  });

  /**
   * Weapon Switch Event
   * Client switches weapon
   */
  socket.on('weaponSwitch', (data) => {
    const { weapon } = data;
    playerManager.switchWeapon(socket.id, weapon);
  });

  /**
   * Game Start Event Handler
   * When room countdown completes and game starts
   */
  socket.on('gameStarted', (data) => {
    const { roomCode } = data;
    gameLogic.handleGameStart(roomCode);
  });

  /**
   * Disconnect Event
   * Client disconnects from server
   */
  socket.on('disconnect', () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);

    const roomCode = roomManager.findPlayerRoom(socket.id);

    if (roomCode) {
      handlePlayerLeaveRoom(socket, roomCode);
    }

    // Remove player from player manager
    playerManager.removePlayer(socket.id);
  });

  /**
   * Helper: Handle player leaving room
   * @param {object} socket - Socket object
   * @param {string} roomCode - Room code
   */
  function handlePlayerLeaveRoom(socket, roomCode) {
    const player = roomManager.getPlayer(roomCode, socket.id);

    if (player) {
      // Remove from room
      roomManager.leaveRoom(roomCode, socket.id);

      // Leave socket room
      socket.leave(roomCode);

      // Broadcast to room
      socket.to(roomCode).emit('playerLeft', {
        playerId: socket.id,
        username: player.username
      });

      // Broadcast updated room list
      io.emit('roomList', { rooms: roomManager.getRoomList() });

      // Cancel any pending respawns
      playerManager.cancelRespawn(socket.id);

      console.log(`[Server] ${player.username} left room ${roomCode}`);
    }
  }
});

// Broadcast room list every 5 seconds (keep lobby updated)
setInterval(() => {
  io.emit('roomList', { rooms: roomManager.getRoomList() });
}, 5000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║        Made By El4v.Dev - Multiplayer FPS             ║
║                                                       ║
║        Server running on http://localhost:${PORT}      ║
║                                                       ║
║        Open your browser and navigate to the URL      ║
║        to start playing!                              ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});
