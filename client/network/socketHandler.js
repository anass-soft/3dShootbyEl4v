/**
 * Socket Handler
 * Manages Socket.IO connection and all client-server communication
 */

class SocketHandler {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentRoom = null;
    this.localPlayerId = null;

    // Event callbacks
    this.callbacks = {
      roomCreated: [],
      roomJoined: [],
      roomList: [],
      playerJoined: [],
      playerLeft: [],
      playerReadyStatus: [],
      countdown: [],
      countdownCancelled: [],
      gameStart: [],
      gameState: [],
      shotFired: [],
      playerHit: [],
      playerDied: [],
      playerRespawned: [],
      error: [],
      connectionLost: [],
      reconnected: []
    };
  }

  /**
   * Initialize Socket.IO connection
   */
  connect() {
    // Connect to server (automatically detects host)
    this.socket = io();

    this.localPlayerId = this.socket.id;

    // Connection events
    this.socket.on('connect', () => {
      console.log('[Socket] Connected to server');
      this.connected = true;
      this.localPlayerId = this.socket.id;
      this.triggerCallbacks('reconnected');
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected from server');
      this.connected = false;
      this.triggerCallbacks('connectionLost');
    });

    this.socket.on('reconnect', () => {
      console.log('[Socket] Reconnected to server');
      this.connected = true;
      this.localPlayerId = this.socket.id;
      this.triggerCallbacks('reconnected');
    });

    // Register all event listeners
    this.registerEventListeners();
  }

  /**
   * Register all Socket.IO event listeners
   */
  registerEventListeners() {
    // Room events
    this.socket.on('roomCreated', (data) => {
      console.log('[Socket] Room created:', data.roomCode);
      this.currentRoom = data.roomCode;
      this.triggerCallbacks('roomCreated', data);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('[Socket] Joined room:', data.roomCode);
      this.currentRoom = data.roomCode;
      this.triggerCallbacks('roomJoined', data);
    });

    this.socket.on('roomList', (data) => {
      this.triggerCallbacks('roomList', data);
    });

    this.socket.on('playerJoined', (data) => {
      console.log('[Socket] Player joined:', data.username);
      this.triggerCallbacks('playerJoined', data);
    });

    this.socket.on('playerLeft', (data) => {
      console.log('[Socket] Player left:', data.username);
      this.triggerCallbacks('playerLeft', data);
    });

    this.socket.on('playerReadyStatus', (data) => {
      console.log('[Socket] Player ready status:', data);
      this.triggerCallbacks('playerReadyStatus', data);
    });

    // Countdown events
    this.socket.on('countdown', (data) => {
      console.log('[Socket] Countdown:', data.seconds);
      this.triggerCallbacks('countdown', data);
    });

    this.socket.on('countdownCancelled', () => {
      console.log('[Socket] Countdown cancelled');
      this.triggerCallbacks('countdownCancelled');
    });

    // Game events
    this.socket.on('gameStart', (data) => {
      console.log('[Socket] Game starting!');
      this.triggerCallbacks('gameStart', data);
    });

    this.socket.on('gameState', (data) => {
      this.triggerCallbacks('gameState', data);
    });

    this.socket.on('shotFired', (data) => {
      this.triggerCallbacks('shotFired', data);
    });

    this.socket.on('playerHit', (data) => {
      console.log('[Socket] Player hit:', data);
      this.triggerCallbacks('playerHit', data);
    });

    this.socket.on('playerDied', (data) => {
      console.log('[Socket] Player died:', data);
      this.triggerCallbacks('playerDied', data);
    });

    this.socket.on('playerRespawned', (data) => {
      console.log('[Socket] Player respawned:', data);
      this.triggerCallbacks('playerRespawned', data);
    });

    // Error events
    this.socket.on('error', (data) => {
      console.error('[Socket] Error:', data.message);
      this.triggerCallbacks('error', data);
    });
  }

  /**
   * Create a new room
   * @param {string} username - Player username
   */
  createRoom(username) {
    if (!this.connected) {
      console.error('[Socket] Not connected to server');
      return;
    }

    this.socket.emit('createRoom', { username: username });
  }

  /**
   * Join an existing room
   * @param {string} username - Player username
   * @param {string} roomCode - Room code to join
   */
  joinRoom(username, roomCode) {
    if (!this.connected) {
      console.error('[Socket] Not connected to server');
      return;
    }

    this.socket.emit('joinRoom', {
      username: username,
      roomCode: roomCode
    });
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    if (!this.connected) {
      return;
    }

    this.socket.emit('leaveRoom');
    this.currentRoom = null;
  }

  /**
   * Set player ready status
   * @param {boolean} ready - Ready status
   */
  setReady(ready) {
    if (!this.connected || !this.currentRoom) {
      return;
    }

    this.socket.emit('playerReady', { ready: ready });
  }

  /**
   * Request room list update
   */
  requestRoomList() {
    if (!this.connected) {
      return;
    }

    this.socket.emit('requestRoomList');
  }

  /**
   * Send player input to server
   * @param {object} inputData - Input data
   */
  sendPlayerInput(inputData) {
    if (!this.connected || !this.currentRoom) {
      return;
    }

    this.socket.emit('playerInput', inputData);
  }

  /**
   * Send shoot event to server
   * @param {object} shotData - Shot data (direction, weapon, etc.)
   */
  sendShot(shotData) {
    if (!this.connected || !this.currentRoom) {
      return;
    }

    this.socket.emit('playerShoot', shotData);
  }

  /**
   * Send weapon switch to server
   * @param {string} weapon - Weapon name ('ak47' or 'sniper')
   */
  switchWeapon(weapon) {
    if (!this.connected || !this.currentRoom) {
      return;
    }

    this.socket.emit('weaponSwitch', { weapon: weapon });
  }

  /**
   * Notify server that game has started on client
   * @param {string} roomCode - Room code
   */
  notifyGameStarted(roomCode) {
    if (!this.connected) {
      return;
    }

    this.socket.emit('gameStarted', { roomCode: roomCode });
  }

  /**
   * Register a callback for an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
  }

  /**
   * Unregister a callback for an event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Trigger all callbacks for an event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  triggerCallbacks(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        callback(data);
      });
    }
  }

  /**
   * Get local player ID
   * @returns {string} Socket ID
   */
  getLocalPlayerId() {
    return this.localPlayerId;
  }

  /**
   * Get current room code
   * @returns {string|null} Room code
   */
  getCurrentRoom() {
    return this.currentRoom;
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }
}

// Export singleton instance
const socketHandler = new SocketHandler();
export default socketHandler;
