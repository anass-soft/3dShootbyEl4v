/**
 * Room Manager
 * Handles room creation, joining, leaving, ready states, and countdown logic
 */

class RoomManager {
  constructor() {
    // Map of room codes to room objects
    this.rooms = new Map();

    // Player color assignments
    this.playerColors = [
      '#FF0000', // Red
      '#0000FF', // Blue
      '#00FF00', // Green
      '#FFFF00', // Yellow
      '#00FFFF', // Cyan
      '#FF00FF', // Magenta
      '#FFA500', // Orange
      '#800080', // Purple
      '#FFC0CB', // Pink
      '#00FF00'  // Lime
    ];
  }

  /**
   * Generate a unique 6-character room code
   * @returns {string} Room code (uppercase alphanumeric)
   */
  generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique room code');
      }
    } while (this.rooms.has(code));

    return code;
  }

  /**
   * Create a new room
   * @returns {string} Room code
   */
  createRoom() {
    const code = this.generateRoomCode();

    const room = {
      code: code,
      players: [], // Array of player IDs
      readyPlayers: new Set(), // Set of ready player IDs
      countdownTimer: null, // Timeout reference for countdown
      countdownSeconds: 0, // Current countdown value
      gameState: 'waiting', // 'waiting', 'countdown', 'active'
      createdAt: Date.now()
    };

    this.rooms.set(code, room);
    console.log(`[Room Manager] Room created: ${code}`);

    return code;
  }

  /**
   * Add a player to a room
   * @param {string} roomCode - Room code to join
   * @param {string} playerId - Socket ID of player
   * @param {string} username - Player username
   * @returns {object} Success object or error
   */
  joinRoom(roomCode, playerId, username) {
    const room = this.rooms.get(roomCode);

    // Validate room exists
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Validate room not full (max 10 players)
    if (room.players.length >= 10) {
      return { success: false, error: 'Room is full (10/10 players)' };
    }

    // Check if player already in room
    if (room.players.find(p => p.id === playerId)) {
      return { success: false, error: 'Already in this room' };
    }

    // Assign player color based on position in array
    const playerColor = this.playerColors[room.players.length % this.playerColors.length];

    // Add player to room
    const player = {
      id: playerId,
      username: username,
      color: playerColor,
      ready: false
    };

    room.players.push(player);

    console.log(`[Room Manager] Player ${username} (${playerId}) joined room ${roomCode}`);

    return {
      success: true,
      room: room,
      playerColor: playerColor,
      players: room.players
    };
  }

  /**
   * Remove a player from a room
   * @param {string} roomCode - Room code
   * @param {string} playerId - Socket ID of player
   */
  leaveRoom(roomCode, playerId) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return;
    }

    // Remove player from players array
    room.players = room.players.filter(p => p.id !== playerId);

    // Remove from ready players
    room.readyPlayers.delete(playerId);

    // If countdown active and ready count drops below 2, cancel countdown
    if (room.gameState === 'countdown' && room.readyPlayers.size < 2) {
      this.cancelCountdown(roomCode);
    }

    // If room is empty, delete it
    if (room.players.length === 0) {
      if (room.countdownTimer) {
        clearInterval(room.countdownTimer);
      }
      this.rooms.delete(roomCode);
      console.log(`[Room Manager] Room ${roomCode} deleted (empty)`);
    } else {
      console.log(`[Room Manager] Player ${playerId} left room ${roomCode}`);
    }
  }

  /**
   * Set player ready status
   * @param {string} roomCode - Room code
   * @param {string} playerId - Socket ID of player
   * @param {boolean} ready - Ready status
   * @param {object} io - Socket.IO server instance for countdown broadcasts
   * @returns {boolean} Success
   */
  setPlayerReady(roomCode, playerId, ready, io) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return false;
    }

    // Find player in room
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return false;
    }

    player.ready = ready;

    // Update ready players set
    if (ready) {
      room.readyPlayers.add(playerId);
    } else {
      room.readyPlayers.delete(playerId);
    }

    console.log(`[Room Manager] Player ${playerId} ready status: ${ready} in room ${roomCode}`);

    // Check if should start countdown (2+ ready players)
    if (room.gameState === 'waiting' && room.readyPlayers.size >= 2) {
      this.startCountdown(roomCode, io);
    }

    // Check if should cancel countdown (less than 2 ready)
    if (room.gameState === 'countdown' && room.readyPlayers.size < 2) {
      this.cancelCountdown(roomCode);
      io.to(roomCode).emit('countdownCancelled');
    }

    return true;
  }

  /**
   * Start 10-second countdown for game start
   * @param {string} roomCode - Room code
   * @param {object} io - Socket.IO server instance
   */
  startCountdown(roomCode, io) {
    const room = this.rooms.get(roomCode);

    if (!room || room.gameState !== 'waiting') {
      return;
    }

    room.gameState = 'countdown';
    room.countdownSeconds = 10;

    console.log(`[Room Manager] Countdown started for room ${roomCode}`);

    // Broadcast initial countdown
    io.to(roomCode).emit('countdown', { seconds: room.countdownSeconds });

    // Set interval for countdown
    room.countdownTimer = setInterval(() => {
      room.countdownSeconds--;

      if (room.countdownSeconds > 0) {
        // Continue countdown
        io.to(roomCode).emit('countdown', { seconds: room.countdownSeconds });
      } else {
        // Countdown complete, start game
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        this.startGame(roomCode, io);
      }
    }, 1000);
  }

  /**
   * Cancel ongoing countdown
   * @param {string} roomCode - Room code
   */
  cancelCountdown(roomCode) {
    const room = this.rooms.get(roomCode);

    if (!room || room.gameState !== 'countdown') {
      return;
    }

    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
    room.gameState = 'waiting';
    room.countdownSeconds = 0;

    console.log(`[Room Manager] Countdown cancelled for room ${roomCode}`);
  }

  /**
   * Start the game for a room
   * @param {string} roomCode - Room code
   * @param {object} io - Socket.IO server instance
   */
  startGame(roomCode, io) {
    const room = this.rooms.get(roomCode);

    if (!room) {
      return;
    }

    room.gameState = 'active';

    console.log(`[Room Manager] Game starting for room ${roomCode} with ${room.players.length} players`);

    // Broadcast game start to all players in room
    io.to(roomCode).emit('gameStart', {
      roomCode: roomCode,
      players: room.players
    });
  }

  /**
   * Get list of all rooms for lobby browser
   * @returns {Array} Array of room info objects
   */
  getRoomList() {
    const roomList = [];

    this.rooms.forEach((room, code) => {
      roomList.push({
        code: code,
        playerCount: room.players.length,
        maxPlayers: 10,
        gameState: room.gameState
      });
    });

    return roomList;
  }

  /**
   * Get room by code
   * @param {string} roomCode - Room code
   * @returns {object|null} Room object or null
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode) || null;
  }

  /**
   * Find which room a player is in
   * @param {string} playerId - Socket ID
   * @returns {string|null} Room code or null
   */
  findPlayerRoom(playerId) {
    for (const [code, room] of this.rooms) {
      if (room.players.find(p => p.id === playerId)) {
        return code;
      }
    }
    return null;
  }

  /**
   * Get player by ID in a specific room
   * @param {string} roomCode - Room code
   * @param {string} playerId - Socket ID
   * @returns {object|null} Player object or null
   */
  getPlayer(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return room.players.find(p => p.id === playerId) || null;
  }
}

module.exports = RoomManager;
