/**
 * Player Manager
 * Tracks player state, stats, position, health, and damage attribution
 */

class PlayerManager {
  constructor() {
    // Map of player socket IDs to player objects
    this.players = new Map();

    // Spawn points at map corners
    this.spawnPoints = [
      { x: -25, y: 0, z: -25 }, // Northwest corner
      { x: 25, y: 0, z: -25 },  // Northeast corner
      { x: -25, y: 0, z: 25 },  // Southwest corner
      { x: 25, y: 0, z: 25 }    // Southeast corner
    ];
  }

  /**
   * Add a new player
   * @param {string} socketId - Player socket ID
   * @param {string} username - Player username
   * @param {string} roomCode - Room code player is in
   * @param {string} color - Assigned color
   * @returns {object} Player object
   */
  addPlayer(socketId, username, roomCode, color) {
    const player = {
      id: socketId,
      username: username,
      roomCode: roomCode,
      color: color,
      position: { x: 0, y: 0, z: 0 }, // Will be set on spawn
      rotation: { yaw: 0, pitch: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      hp: 100,
      weapon: 'ak47', // 'ak47' or 'sniper'
      isCrouching: false,
      isGrounded: true,
      isAlive: false, // Starts dead, will spawn after game starts
      spawnProtection: false,
      spawnProtectionEnd: null,
      kills: 0,
      deaths: 0,
      damageDealt: [], // Array of {to: playerId, amount: number, timestamp: number}
      lastShotTime: 0, // Timestamp for fire rate validation
      respawnTimer: null // Timeout reference for respawn
    };

    this.players.set(socketId, player);
    console.log(`[Player Manager] Player added: ${username} (${socketId})`);

    return player;
  }

  /**
   * Remove a player
   * @param {string} socketId - Player socket ID
   */
  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      // Clear respawn timer if exists
      if (player.respawnTimer) {
        clearTimeout(player.respawnTimer);
      }
      this.players.delete(socketId);
      console.log(`[Player Manager] Player removed: ${socketId}`);
    }
  }

  /**
   * Get player by socket ID
   * @param {string} socketId - Player socket ID
   * @returns {object|null} Player object or null
   */
  getPlayer(socketId) {
    return this.players.get(socketId) || null;
  }

  /**
   * Get all players in a specific room
   * @param {string} roomCode - Room code
   * @returns {Array} Array of player objects
   */
  getPlayersInRoom(roomCode) {
    const players = [];
    this.players.forEach(player => {
      if (player.roomCode === roomCode) {
        players.push(player);
      }
    });
    return players;
  }

  /**
   * Update player input (position, rotation, velocity)
   * @param {string} socketId - Player socket ID
   * @param {object} inputData - Input data from client
   */
  updatePlayerInput(socketId, inputData) {
    const player = this.players.get(socketId);
    if (!player || !player.isAlive) {
      if (!player) {
        console.warn('[PlayerManager] Input from unknown player:', socketId);
      } else {
        console.warn('[PlayerManager] Input ignored - player not alive:', {
          playerId: socketId,
          username: player.username,
          isAlive: player.isAlive,
          hp: player.hp,
          hasMovement: !!inputData.movement
        });
      }
      return;
    }

    // Update rotation (always trust client rotation for responsiveness)
    if (inputData.rotation) {
      player.rotation.yaw = inputData.rotation.yaw;
      player.rotation.pitch = inputData.rotation.pitch;
    }

    // Server will process movement in game loop
    // Store input for processing
    player.inputState = inputData.movement || {};
  }

  /**
   * Spawn a player at a random spawn point
   * @param {string} socketId - Player socket ID
   * @returns {object} Spawn position
   */
  spawnPlayer(socketId) {
    const player = this.players.get(socketId);
    if (!player) {
      return null;
    }

    // Select random spawn point
    const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];

    // Set player state
    player.position = { x: spawnPoint.x, y: spawnPoint.y, z: spawnPoint.z };
    player.velocity = { x: 0, y: 0, z: 0 };
    player.hp = 100;
    player.weapon = 'ak47';
    player.isAlive = true;
    player.isCrouching = false;
    player.isGrounded = true;

    // Enable spawn protection for 2 seconds
    player.spawnProtection = true;
    player.spawnProtectionEnd = Date.now() + 2000;

    // Clear damage dealt history
    player.damageDealt = [];

    console.log(`[Player Manager] Player spawned: ${player.username} at (${spawnPoint.x}, ${spawnPoint.y}, ${spawnPoint.z})`);

    return spawnPoint;
  }

  /**
   * Deal damage to a player
   * @param {string} shooterId - Shooter socket ID
   * @param {string} targetId - Target socket ID
   * @param {number} damage - Damage amount
   * @returns {object|null} Result object with target HP and death info
   */
  dealDamage(shooterId, targetId, damage) {
    const shooter = this.players.get(shooterId);
    const target = this.players.get(targetId);

    if (!shooter || !target || !target.isAlive) {
      return null;
    }

    // Check spawn protection
    if (target.spawnProtection && Date.now() < target.spawnProtectionEnd) {
      console.log(`[Player Manager] Shot ignored - target has spawn protection`);
      return null;
    }

    // Apply damage
    target.hp -= damage;

    // Track damage dealt by shooter
    shooter.damageDealt.push({
      to: targetId,
      amount: damage,
      timestamp: Date.now()
    });

    console.log(`[Player Manager] ${shooter.username} dealt ${damage} damage to ${target.username} (HP: ${target.hp})`);

    const result = {
      targetId: targetId,
      damage: damage,
      newHP: target.hp,
      died: false
    };

    // Check if target died
    if (target.hp <= 0) {
      const killInfo = this.killPlayer(targetId);
      result.died = true;
      result.killer = killInfo.killer;
      result.victim = killInfo.victim;
    }

    return result;
  }

  /**
   * Handle player death and determine killer
   * @param {string} targetId - Dead player socket ID
   * @returns {object} Kill info with killer and victim
   */
  killPlayer(targetId) {
    const target = this.players.get(targetId);

    if (!target) {
      return null;
    }

    target.isAlive = false;
    target.hp = 0;
    target.deaths++;

    // Find who dealt the most damage in the last 5 seconds
    let killer = null;
    let maxDamage = 0;
    const fiveSecondsAgo = Date.now() - 5000;

    this.players.forEach(player => {
      if (player.id === targetId) return; // Skip self

      // Sum damage dealt to target in last 5 seconds
      const recentDamage = player.damageDealt
        .filter(d => d.to === targetId && d.timestamp > fiveSecondsAgo)
        .reduce((sum, d) => sum + d.amount, 0);

      if (recentDamage > maxDamage) {
        maxDamage = recentDamage;
        killer = player;
      }
    });

    // Increment killer's kills
    if (killer) {
      killer.kills++;
    }

    console.log(`[Player Manager] ${target.username} killed by ${killer ? killer.username : 'unknown'}`);

    return {
      killer: killer ? { id: killer.id, username: killer.username } : null,
      victim: { id: target.id, username: target.username }
    };
  }

  /**
   * Schedule player respawn after 3 seconds
   * @param {string} socketId - Player socket ID
   * @param {Function} callback - Callback to execute after timer
   */
  scheduleRespawn(socketId, callback) {
    const player = this.players.get(socketId);

    if (!player) {
      return;
    }

    // Clear existing timer if any
    if (player.respawnTimer) {
      clearTimeout(player.respawnTimer);
    }

    // Set 3-second respawn timer
    player.respawnTimer = setTimeout(() => {
      player.respawnTimer = null;
      callback(socketId);
    }, 3000);

    console.log(`[Player Manager] Respawn scheduled for ${player.username} in 3 seconds`);
  }

  /**
   * Cancel respawn timer (used when player leaves)
   * @param {string} socketId - Player socket ID
   */
  cancelRespawn(socketId) {
    const player = this.players.get(socketId);

    if (player && player.respawnTimer) {
      clearTimeout(player.respawnTimer);
      player.respawnTimer = null;
      console.log(`[Player Manager] Respawn cancelled for ${player.username}`);
    }
  }

  /**
   * Update spawn protection status
   * @param {string} socketId - Player socket ID
   * @returns {boolean} Whether protection ended this update
   */
  updateSpawnProtection(socketId) {
    const player = this.players.get(socketId);

    if (!player || !player.spawnProtection) {
      return false;
    }

    // Check if protection expired
    if (Date.now() >= player.spawnProtectionEnd) {
      player.spawnProtection = false;
      player.spawnProtectionEnd = null;
      console.log(`[Player Manager] Spawn protection ended for ${player.username}`);
      return true;
    }

    return false;
  }

  /**
   * End spawn protection immediately (called when player shoots)
   * @param {string} socketId - Player socket ID
   */
  endSpawnProtection(socketId) {
    const player = this.players.get(socketId);

    if (player && player.spawnProtection) {
      player.spawnProtection = false;
      player.spawnProtectionEnd = null;
      console.log(`[Player Manager] Spawn protection forcibly ended for ${player.username}`);
    }
  }

  /**
   * Switch player weapon
   * @param {string} socketId - Player socket ID
   * @param {string} weapon - Weapon name ('ak47' or 'sniper')
   */
  switchWeapon(socketId, weapon) {
    const player = this.players.get(socketId);

    if (!player || !player.isAlive) {
      return;
    }

    if (weapon === 'ak47' || weapon === 'sniper') {
      player.weapon = weapon;
      console.log(`[Player Manager] ${player.username} switched to ${weapon}`);
    }
  }

  /**
   * Clean up old damage records (older than 5 seconds)
   * Called periodically to prevent memory growth
   */
  cleanupDamageHistory() {
    const fiveSecondsAgo = Date.now() - 5000;

    this.players.forEach(player => {
      player.damageDealt = player.damageDealt.filter(d => d.timestamp > fiveSecondsAgo);
    });
  }
}

module.exports = PlayerManager;
