/**
 * Main Game File
 * Entry point for the client-side game
 * Handles initialization, game loop, and all UI interactions
 */

import socketHandler from './network/socketHandler.js';
import { generateMap, setupLighting, setupEnvironment } from './game/map.js';
import { LocalPlayer, OtherPlayersManager } from './game/player.js';
import { WeaponManager, HitMarker } from './game/weapon.js';
import { UIManager } from './game/ui.js';
import { MobileControlsManager } from './game/mobileControls.js';

/**
 * Game Manager Class
 * Main game controller
 */
class GameManager {
  constructor() {
    // Game state
    this.currentScreen = 'lobby'; // 'lobby', 'waiting', 'game'
    this.isGameActive = false;
    this.currentRoomCode = null;
    this.playerList = [];
    this.isReady = false;

    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // Game components
    this.localPlayer = null;
    this.otherPlayers = null;
    this.weaponManager = null;
    this.uiManager = null;
    this.mobileControls = null;
    this.mobileControlsManager = null;
    this.hitMarker = null;

    // Input state
    this.keys = {};
    this.pointerLocked = false;

    // Game loop
    this.lastFrameTime = 0;
    this.lastInputSend = 0;
    this.inputSendRate = 50; // Send input every 50ms (20Hz)
  }

  /**
   * Initialize the game
   */
  init() {
    console.log('[Game] Initializing...');

    // Initialize Socket.IO connection
    socketHandler.connect();

    // Setup lobby UI
    this.setupLobbyUI();

    // Initialize Three.js (but don't show yet)
    this.initThreeJS();

    // Setup UI handlers (settings, etc)
    this.setupUIHandlers();

    // Setup socket event handlers
    this.setupSocketHandlers();

    console.log('[Game] Initialization complete');
  }

  /**
   * Setup lobby UI event listeners
   */
  setupLobbyUI() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active from all tabs
        tabButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });

        // Add active to clicked tab
        button.classList.add('active');
        const tabName = button.dataset.tab;
        const tabContent = document.getElementById(tabName + 'Tab');
        if (tabContent) {
          tabContent.classList.add('active');
        }

        // Request room list when switching to browse tab
        if (tabName === 'browse') {
          socketHandler.requestRoomList();
        }
      });
    });

    // Create room button
    document.getElementById('createRoomBtn').addEventListener('click', () => {
      this.createRoom();
    });

    // Request room list periodically
    setInterval(() => {
      if (this.currentScreen === 'lobby') {
        socketHandler.requestRoomList();
      }
    }, 3000);
  }

  /**
   * Create a new room
   */
  createRoom() {
    const username = document.getElementById('usernameInput').value.trim();
    const errorElement = document.getElementById('usernameError');

    // Validate username
    if (username.length < 3 || username.length > 15) {
      errorElement.textContent = 'Username must be 3-15 characters';
      return;
    }

    errorElement.textContent = '';
    socketHandler.createRoom(username);
  }

  /**
   * Join an existing room
   * @param {string} roomCode - Room code to join
   */
  joinRoom(roomCode) {
    const username = document.getElementById('usernameInput').value.trim();
    const errorElement = document.getElementById('usernameError');

    // Validate username
    if (username.length < 3 || username.length > 15) {
      errorElement.textContent = 'Username must be 3-15 characters';
      return;
    }

    errorElement.textContent = '';
    socketHandler.joinRoom(username, roomCode);
  }

  /**
   * Setup waiting room UI
   */
  setupWaitingRoom() {
    // Ready button
    document.getElementById('readyBtn').addEventListener('click', () => {
      this.toggleReady();
    });

    // Leave room button
    document.getElementById('leaveRoomBtn').addEventListener('click', () => {
      this.leaveRoom();
    });
  }

  /**
   * Toggle ready status
   */
  toggleReady() {
    this.isReady = !this.isReady;
    socketHandler.setReady(this.isReady);

    const readyBtn = document.getElementById('readyBtn');
    if (this.isReady) {
      readyBtn.textContent = 'UNREADY';
      readyBtn.classList.add('active');
    } else {
      readyBtn.textContent = 'READY UP';
      readyBtn.classList.remove('active');
    }
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    socketHandler.leaveRoom();
    this.currentRoomCode = null;
    this.isReady = false;
    this.playerList = [];
    this.showScreen('lobby');
  }

  /**
   * Initialize Three.js scene
   */
  initThreeJS() {
    console.log('[Game] Initializing Three.js...');

    // Create scene
    this.scene = new THREE.Scene();

    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Setup environment
    setupEnvironment(this.scene);
    setupLighting(this.scene);

    // Generate map
    generateMap(this.scene);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    console.log('[Game] Three.js initialization complete');
  }

  /**
   * Start the game
   */
  startGame() {
    console.log('[Game] Starting game...');

    this.isGameActive = true;
    this.showScreen('game');

    // Initialize game components
    this.localPlayer = new LocalPlayer(this.camera, socketHandler.getLocalPlayerId());
    console.log('[Game] Local player created:', this.localPlayer);

    this.otherPlayers = new OtherPlayersManager(this.scene);
    this.weaponManager = new WeaponManager(this.scene, this.camera, socketHandler, this.localPlayer);
    this.uiManager = new UIManager(this.localPlayer);
    this.hitMarker = new HitMarker();

    // Initialize mobile controls manager
    this.mobileControlsManager = new MobileControlsManager(this.localPlayer, this.weaponManager, socketHandler);

    // Setup input handlers
    this.setupInputHandlers();
    console.log('[Game] Input handlers set up');

    // Request pointer lock
    this.requestPointerLock();

    // Start game loop
    this.lastFrameTime = performance.now();
    this.gameLoop();
    console.log('[Game] Game loop started');

    // Notify server that game started
    socketHandler.notifyGameStarted(this.currentRoomCode);

    console.log('[Game] Game started, waiting for spawn...');
  }

  /**
   * Setup input handlers (keyboard, mouse)
   */
  setupInputHandlers() {
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    document.addEventListener('keyup', (e) => {
      this.handleKeyUp(e);
    });

    // Mouse events
    document.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.pointerLocked) { // Left click
        this.weaponManager.startFiring();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) { // Left click
        this.weaponManager.stopFiring();
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked && this.localPlayer) {
        this.localPlayer.handleMouseMove(e.movementX, e.movementY);
      }
    });

    // Pointer lock events
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
      console.log('[Input] Pointer lock changed:', this.pointerLocked);
      this.updatePointerLockOverlay();
    });
  }

  /**
   * Handle key down
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyDown(e) {
    console.log('[Input] Key pressed:', e.code, 'isGameActive:', this.isGameActive, 'hasLocalPlayer:', !!this.localPlayer);

    if (!this.localPlayer || !this.isGameActive) {
      console.log('[Input] Key pressed but game not active or no local player');
      return;
    }

    this.keys[e.code] = true;

    // Movement keys
    if (e.code === 'KeyW') {
      this.localPlayer.inputState.forward = true;
      console.log('[Input] W pressed - forward = true');
    }
    if (e.code === 'KeyS') {
      this.localPlayer.inputState.backward = true;
      console.log('[Input] S pressed - backward = true');
    }
    if (e.code === 'KeyA') {
      this.localPlayer.inputState.left = true;
      console.log('[Input] A pressed - left = true');
    }
    if (e.code === 'KeyD') {
      this.localPlayer.inputState.right = true;
      console.log('[Input] D pressed - right = true');
    }

    // Jump
    if (e.code === 'Space') {
      this.localPlayer.jump();
      this.weaponManager.tryFire(); // Space can also fire
    }

    // Crouch toggle
    if (e.code === 'KeyC') {
      this.localPlayer.inputState.crouch = true;
    }

    // Weapon switching
    if (e.code === 'Digit1') {
      this.weaponManager.switchWeapon('ak47');
      this.uiManager.updateWeapon(this.weaponManager.getCurrentWeaponName());
    }
    if (e.code === 'Digit2') {
      this.weaponManager.switchWeapon('sniper');
      this.uiManager.updateWeapon(this.weaponManager.getCurrentWeaponName());
    }
  }

  /**
   * Handle key up
   * @param {KeyboardEvent} e - Keyboard event
   */
  handleKeyUp(e) {
    if (!this.localPlayer || !this.isGameActive) return;

    this.keys[e.code] = false;

    // Movement keys
    if (e.code === 'KeyW') this.localPlayer.inputState.forward = false;
    if (e.code === 'KeyS') this.localPlayer.inputState.backward = false;
    if (e.code === 'KeyA') this.localPlayer.inputState.left = false;
    if (e.code === 'KeyD') this.localPlayer.inputState.right = false;

    // Crouch
    if (e.code === 'KeyC') {
      this.localPlayer.inputState.crouch = false;
    }
  }

  /**
   * Request pointer lock
   */
  requestPointerLock() {
    const canvas = this.renderer.domElement;
    canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) {
        canvas.requestPointerLock();
      }
    });
  }

  /**
   * Update pointer lock overlay visibility
   */
  updatePointerLockOverlay() {
    const overlay = document.getElementById('pointerLockOverlay');
    if (this.pointerLocked) {
      overlay.classList.add('hidden');
    } else {
      overlay.classList.remove('hidden');
    }
  }

  /**
   * Main game loop
   */
  gameLoop() {
    if (!this.isGameActive) return;

    // Calculate delta time
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
    this.lastFrameTime = currentTime;

    // Update local player
    if (this.localPlayer) {
      if (this.localPlayer.isAlive) {
        this.localPlayer.update(deltaTime);
      }
    } else {
      console.warn('[Game Loop] No local player!');
    }

    // Update weapon manager
    if (this.weaponManager) {
      this.weaponManager.update(deltaTime);
    }

    // Update mobile controls
    if (this.mobileControlsManager && this.mobileControlsManager.isEnabled()) {
      this.mobileControlsManager.update(deltaTime);
    }

    // Interpolate other players
    if (this.otherPlayers) {
      this.otherPlayers.interpolate(deltaTime);
    }

    // Send input to server (throttled to 20Hz)
    if (currentTime - this.lastInputSend >= this.inputSendRate) {
      this.sendInputToServer();
      this.lastInputSend = currentTime;
    }

    // Update UI
    if (this.uiManager) {
      this.uiManager.updateHUD();
    }

    // Render scene
    this.renderer.render(this.scene, this.camera);

    // Continue loop
    requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * Send input to server
   */
  sendInputToServer() {
    if (!this.localPlayer) return;

    socketHandler.sendPlayerInput(this.localPlayer.getInputState());
  }

  /**
   * Setup UI event handlers for settings
   */
  setupUIHandlers() {
    // Settings button
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');

    if (settingsButton && settingsModal) {
      // Open settings modal
      settingsButton.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
      });

      // Close settings modal
      if (closeSettings) {
        closeSettings.addEventListener('click', () => {
          settingsModal.classList.add('hidden');
        });
      }

      // Close on background click
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.classList.add('hidden');
        }
      });
    }

    console.log('[Game] UI handlers set up');
  }

  /**
   * Setup socket event handlers
   */
  setupSocketHandlers() {
    // Room created
    socketHandler.on('roomCreated', (data) => {
      console.log('[Game] Room created:', data.roomCode);
      this.currentRoomCode = data.roomCode;
    });

    // Room joined
    socketHandler.on('roomJoined', (data) => {
      console.log('[Game] Joined room:', data.roomCode);
      this.currentRoomCode = data.roomCode;
      this.playerList = data.players;
      this.showScreen('waiting');
      this.updatePlayerList();
      this.setupWaitingRoom();

      // Display room code
      document.getElementById('roomCodeDisplay').textContent = `Room Code: ${data.roomCode} • `;
    });

    // Room list update
    socketHandler.on('roomList', (data) => {
      this.updateRoomList(data.rooms);
    });

    // Player joined room
    socketHandler.on('playerJoined', (data) => {
      console.log('[Game] Player joined:', data.username);
      this.playerList.push(data);
      this.updatePlayerList();
    });

    // Player left room
    socketHandler.on('playerLeft', (data) => {
      console.log('[Game] Player left:', data.username);
      this.playerList = this.playerList.filter(p => p.id !== data.playerId);
      this.updatePlayerList();
    });

    // Player ready status
    socketHandler.on('playerReadyStatus', (data) => {
      const player = this.playerList.find(p => p.id === data.playerId);
      if (player) {
        player.ready = data.ready;
        this.updatePlayerList();
      }
    });

    // Countdown
    socketHandler.on('countdown', (data) => {
      const statusText = document.getElementById('statusText');
      statusText.textContent = `Game starting in ${data.seconds} seconds...`;
    });

    // Countdown cancelled
    socketHandler.on('countdownCancelled', () => {
      const statusText = document.getElementById('statusText');
      statusText.textContent = 'Waiting for players to ready up...';
    });

    // Game start
    socketHandler.on('gameStart', (data) => {
      console.log('[Game] Game starting!');
      this.startGame();
    });

    // Game state update
    socketHandler.on('gameState', (data) => {
      this.handleGameState(data);
    });

    // Shot fired
    socketHandler.on('shotFired', (data) => {
      if (this.weaponManager) {
        this.weaponManager.createTracer(data);
      }
    });

    // Player hit
    socketHandler.on('playerHit', (data) => {
      // Show hit marker if local player hit someone
      if (data.shooterId === socketHandler.getLocalPlayerId() && this.hitMarker) {
        this.hitMarker.show();
      }

      // Update local player HP if hit
      if (data.targetId === socketHandler.getLocalPlayerId() && this.localPlayer) {
        this.localPlayer.hp = data.newHP;
      }
    });

    // Player died
    socketHandler.on('playerDied', (data) => {
      // Check if local player died
      if (data.victim.id === socketHandler.getLocalPlayerId() && this.localPlayer) {
        this.localPlayer.die();
        const killerName = data.killer ? data.killer.username : null;
        this.uiManager.showDeathScreen(killerName);
      }

      // Update kills if local player got the kill
      if (data.killer && data.killer.id === socketHandler.getLocalPlayerId() && this.localPlayer) {
        this.localPlayer.kills++;
      }

      // Add to kill feed
      if (this.uiManager && data.killer) {
        const isLocalPlayerInvolved =
          data.killer.id === socketHandler.getLocalPlayerId() ||
          data.victim.id === socketHandler.getLocalPlayerId();

        this.uiManager.addKillFeed(data.killer.username, data.victim.username, isLocalPlayerInvolved);
      }
    });

    // Player respawned
    socketHandler.on('playerRespawned', (data) => {
      console.log('[Game] Player respawned event received:', data);
      // Check if local player respawned
      if (data.playerId === socketHandler.getLocalPlayerId() && this.localPlayer) {
        console.log('[Game] Spawning local player at:', data.position);

        // CRITICAL: Set alive FIRST before calling spawn()
        this.localPlayer.isAlive = true;
        this.localPlayer.spawn(data.position);

        // Verify state was set
        console.log('[Game] After spawn - isAlive:', this.localPlayer.isAlive);

        this.uiManager.hideDeathScreen();
      } else if (data.playerId && this.otherPlayers) {
        // Update other player - also mark as alive
        this.otherPlayers.updatePlayer({
          id: data.playerId,
          position: data.position,
          isAlive: true,
          hp: data.hp || 100
        });
      }
    });

    // Error
    socketHandler.on('error', (data) => {
      console.error('[Game] Error:', data.message);
      const errorElement = document.getElementById('usernameError');
      if (errorElement) {
        errorElement.textContent = data.message;
      }
    });

    // Connection lost
    socketHandler.on('connectionLost', () => {
      console.warn('[Game] Connection lost');
      document.getElementById('connectionOverlay').classList.remove('hidden');
    });

    // Reconnected
    socketHandler.on('reconnected', () => {
      console.log('[Game] Reconnected');
      document.getElementById('connectionOverlay').classList.add('hidden');
    });
  }

  /**
   * Handle game state update from server
   * @param {object} gameState - Game state data
   */
  handleGameState(gameState) {
    if (!gameState || !gameState.players) return;

    gameState.players.forEach(playerData => {
      if (playerData.id === socketHandler.getLocalPlayerId()) {
        // Update local player from server (for correction)
        if (this.localPlayer && this.localPlayer.isAlive) {
          this.localPlayer.applyServerCorrection(playerData.position);
          this.localPlayer.hp = playerData.hp;
          this.localPlayer.kills = playerData.kills;
        }
      } else {
        // Update other players
        if (this.otherPlayers) {
          this.otherPlayers.updatePlayer(playerData);
        }
      }
    });
  }

  /**
   * Update room list in browse tab
   * @param {Array} rooms - Array of room objects
   */
  updateRoomList(rooms) {
    const roomList = document.getElementById('roomList');

    if (rooms.length === 0) {
      roomList.innerHTML = '<div class="no-rooms">No active rooms. Create one to start!</div>';
      return;
    }

    roomList.innerHTML = '';

    rooms.forEach(room => {
      const roomItem = document.createElement('div');
      roomItem.className = 'room-item';

      const isFull = room.playerCount >= room.maxPlayers;

      roomItem.innerHTML = `
        <div class="room-info-text">
          <div class="room-code">${room.code}</div>
          <div class="room-players">${room.playerCount}/${room.maxPlayers} players</div>
        </div>
        <button class="btn btn-join" ${isFull ? 'disabled' : ''}>
          ${isFull ? 'FULL' : 'JOIN'}
        </button>
      `;

      // Add click handler to join button
      if (!isFull) {
        const joinBtn = roomItem.querySelector('.btn-join');
        joinBtn.addEventListener('click', () => {
          this.joinRoom(room.code);
        });
      }

      roomList.appendChild(roomItem);
    });
  }

  /**
   * Update player list in waiting room
   */
  updatePlayerList() {
    const playerListContainer = document.getElementById('playerList');
    const playerCountDisplay = document.getElementById('playerCountDisplay');

    playerCountDisplay.textContent = `${this.playerList.length}/10 Players`;

    playerListContainer.innerHTML = '';

    this.playerList.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';

      const isYou = player.id === socketHandler.getLocalPlayerId();
      const statusClass = player.ready ? 'ready' : 'not-ready';
      const statusText = player.ready ? '✓ READY' : 'Not Ready';

      playerItem.innerHTML = `
        <div class="player-name">${player.username}${isYou ? ' (You)' : ''}</div>
        <div class="player-status ${statusClass}">${statusText}</div>
      `;

      playerListContainer.appendChild(playerItem);
    });
  }

  /**
   * Show a specific screen
   * @param {string} screenName - Screen name ('lobby', 'waiting', 'game')
   */
  showScreen(screenName) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show requested screen
    const screen = document.getElementById(screenName === 'waiting' ? 'waitingRoom' : screenName === 'game' ? 'gameScreen' : 'lobby');
    if (screen) {
      screen.classList.add('active');
    }

    this.currentScreen = screenName;
  }
}

// Initialize game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new GameManager();
    game.init();
  });
} else {
  const game = new GameManager();
  game.init();
}
