/**
 * Game Logic
 * Server game loop, physics processing, and hit detection
 */

class GameLogic {
  constructor(roomManager, playerManager, io) {
    this.roomManager = roomManager;
    this.playerManager = playerManager;
    this.io = io;

    // Game loop settings
    this.tickRate = 20; // 20Hz (50ms per tick)
    this.deltaTime = 1 / this.tickRate; // 0.05 seconds
    this.gameLoopInterval = null;

    // Physics constants
    this.gravity = -20; // units/second²
    this.walkSpeed = 5; // units/second
    this.crouchSpeed = 2.5; // units/second (50% of walk speed)
    this.jumpVelocity = 2; // units/second vertical velocity

    // Map boundaries
    this.mapBounds = {
      minX: -30,
      maxX: 30,
      minZ: -30,
      maxZ: 30,
      minY: -10 // Kill plane if player falls through map
    };

    // Weapon stats
    this.weapons = {
      ak47: {
        damage: 15,
        fireRate: 0.1, // Seconds between shots (600 RPM)
        name: 'AK-47'
      },
      sniper: {
        damage: 100,
        fireRate: 1.0, // Seconds between shots (60 RPM)
        name: 'Sniper Rifle'
      }
    };
  }

  /**
   * Start the game loop
   */
  startGameLoop() {
    if (this.gameLoopInterval) {
      console.log('[Game Logic] Game loop already running');
      return;
    }

    console.log(`[Game Logic] Starting game loop at ${this.tickRate}Hz`);

    this.gameLoopInterval = setInterval(() => {
      this.gameLoop();
    }, 1000 / this.tickRate); // Run at 20Hz (every 50ms)

    // Cleanup damage history every 10 seconds
    setInterval(() => {
      this.playerManager.cleanupDamageHistory();
    }, 10000);
  }

  /**
   * Main game loop - runs every 50ms (20Hz)
   */
  gameLoop() {
    const rooms = this.roomManager.rooms;

    rooms.forEach((room, roomCode) => {
      // Only process rooms in active game state
      if (room.gameState !== 'active') {
        return;
      }

      // Get all players in this room
      const players = this.playerManager.getPlayersInRoom(roomCode);

      if (players.length === 0) {
        return;
      }

      // Process each player
      players.forEach(player => {
        if (!player.isAlive) {
          console.warn('[GameLoop] Skipping dead player in active game', {
            playerId: player.id,
            username: player.username,
            hp: player.hp,
            roomCode: roomCode
          });
          return;
        }

        // Update spawn protection
        this.playerManager.updateSpawnProtection(player.id);

        // Process movement and physics
        this.processPlayerPhysics(player);

        // Check if player fell through map
        if (player.position.y < this.mapBounds.minY) {
          console.log(`[Game Logic] Player ${player.username} fell through map - respawning`);
          this.handlePlayerDeath(player.id, null);
        }
      });

      // Broadcast game state to all clients in room
      this.broadcastGameState(roomCode, players);
    });
  }

  /**
   * Process player physics (movement, gravity, collision)
   * @param {object} player - Player object
   */
  processPlayerPhysics(player) {
    const inputState = player.inputState || {};

    // Calculate movement speed based on crouch state
    const moveSpeed = player.isCrouching ? this.crouchSpeed : this.walkSpeed;

    // Process movement input
    let moveX = 0;
    let moveZ = 0;

    if (inputState.forward) moveZ -= 1;
    if (inputState.backward) moveZ += 1;
    if (inputState.left) moveX -= 1;
    if (inputState.right) moveX += 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveZ !== 0) {
      moveX *= 0.707; // 1/sqrt(2)
      moveZ *= 0.707;
    }

    // Apply movement based on player rotation (yaw)
    const yaw = player.rotation.yaw;
    const velocityX = (moveX * Math.cos(yaw) - moveZ * Math.sin(yaw)) * moveSpeed;
    const velocityZ = (moveX * Math.sin(yaw) + moveZ * Math.cos(yaw)) * moveSpeed;

    player.velocity.x = velocityX;
    player.velocity.z = velocityZ;

    // Process jump
    if (inputState.jump && player.isGrounded) {
      player.velocity.y = this.jumpVelocity;
      player.isGrounded = false;
    }

    // Process crouch toggle
    if (inputState.crouch && !player.wasCrouching) {
      player.isCrouching = !player.isCrouching;
    }
    player.wasCrouching = inputState.crouch;

    // Apply gravity
    if (!player.isGrounded) {
      player.velocity.y += this.gravity * this.deltaTime;
    }

    // Update position
    player.position.x += player.velocity.x * this.deltaTime;
    player.position.y += player.velocity.y * this.deltaTime;
    player.position.z += player.velocity.z * this.deltaTime;

    // Simple ground detection (Y = 0 is ground level)
    // More sophisticated collision would check specific walkable areas
    if (player.position.y <= 0 && player.velocity.y <= 0) {
      player.position.y = 0;
      player.velocity.y = 0;
      player.isGrounded = true;
    }

    // Clamp position to map boundaries
    player.position.x = Math.max(this.mapBounds.minX, Math.min(this.mapBounds.maxX, player.position.x));
    player.position.z = Math.max(this.mapBounds.minZ, Math.min(this.mapBounds.maxZ, player.position.z));
  }

  /**
   * Process player shooting
   * @param {string} shooterId - Shooter socket ID
   * @param {object} shotData - Shot data from client
   * @returns {object|null} Hit result
   */
  processShot(shooterId, shotData) {
    const shooter = this.playerManager.getPlayer(shooterId);

    if (!shooter) {
      console.warn('[GameLogic] Shot from unknown shooter:', shooterId);
      return null;
    }

    if (!shooter.isAlive) {
      console.warn('[GameLogic] Shot ignored - shooter not alive', {
        shooterId: shooterId,
        shooterName: shooter.username,
        shooterHP: shooter.hp,
        shooterAlive: shooter.isAlive
      });
      return null;
    }

    const weapon = this.weapons[shooter.weapon];
    if (!weapon) {
      return null;
    }

    // Validate fire rate
    const timeSinceLastShot = (Date.now() - shooter.lastShotTime) / 1000;
    if (timeSinceLastShot < weapon.fireRate) {
      console.log(`[Game Logic] Shot rejected - fire rate violation for ${shooter.username}`);
      return null;
    }

    // Update last shot time
    shooter.lastShotTime = Date.now();

    // End spawn protection if shooting
    if (shooter.spawnProtection) {
      this.playerManager.endSpawnProtection(shooterId);
    }

    // Perform raycast hit detection
    const hitResult = this.raycastHit(shooter, shotData.direction);

    if (hitResult) {
      // Hit a player - deal damage
      const damageResult = this.playerManager.dealDamage(shooterId, hitResult.targetId, weapon.damage);

      if (damageResult) {
        // Broadcast hit event
        this.io.to(shooter.roomCode).emit('playerHit', {
          shooterId: shooterId,
          targetId: hitResult.targetId,
          damage: weapon.damage,
          newHP: damageResult.newHP,
          weapon: shooter.weapon
        });

        // Check if target died
        if (damageResult.died) {
          this.handlePlayerDeath(hitResult.targetId, damageResult.killer);
        }

        return {
          hit: true,
          targetId: hitResult.targetId,
          hitPosition: hitResult.hitPosition
        };
      }
    }

    return {
      hit: false,
      hitPosition: null
    };
  }

  /**
   * Raycast hit detection
   * @param {object} shooter - Shooter player object
   * @param {object} direction - Shoot direction {x, y, z}
   * @returns {object|null} Hit result with target ID and position
   */
  raycastHit(shooter, direction) {
    // Get all players in same room (except shooter)
    const players = this.playerManager.getPlayersInRoom(shooter.roomCode);
    const targets = players.filter(p => p.id !== shooter.id && p.isAlive);

    // Ray origin (shooter position + height for camera)
    const rayOrigin = {
      x: shooter.position.x,
      y: shooter.position.y + (shooter.isCrouching ? 0.8 : 1.6),
      z: shooter.position.z
    };

    // Normalize direction
    const length = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    const rayDir = {
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length
    };

    let closestHit = null;
    let closestDistance = Infinity;

    // Check each target
    targets.forEach(target => {
      // Check spawn protection
      if (target.spawnProtection && Date.now() < target.spawnProtectionEnd) {
        return; // Skip protected players
      }

      // Target hitbox (cylinder/capsule approximation)
      const targetHeight = target.isCrouching ? 1 : 2;
      const targetRadius = 0.5;
      const targetCenter = {
        x: target.position.x,
        y: target.position.y + targetHeight / 2,
        z: target.position.z
      };

      // Simple cylinder intersection test
      // Check if ray passes within radius of target cylinder
      const dx = targetCenter.x - rayOrigin.x;
      const dy = targetCenter.y - rayOrigin.y;
      const dz = targetCenter.z - rayOrigin.z;

      // Project target center onto ray
      const t = dx * rayDir.x + dy * rayDir.y + dz * rayDir.z;

      if (t < 0) {
        return; // Target is behind shooter
      }

      // Closest point on ray to target center
      const closestPoint = {
        x: rayOrigin.x + rayDir.x * t,
        y: rayOrigin.y + rayDir.y * t,
        z: rayOrigin.z + rayDir.z * t
      };

      // Distance from closest point to target center
      const distX = closestPoint.x - targetCenter.x;
      const distY = closestPoint.y - targetCenter.y;
      const distZ = closestPoint.z - targetCenter.z;
      const distance = Math.sqrt(distX ** 2 + distZ ** 2); // Horizontal distance for cylinder

      // Check if within cylinder radius and height
      if (distance <= targetRadius &&
          closestPoint.y >= target.position.y &&
          closestPoint.y <= target.position.y + targetHeight) {

        // Hit! Check if closest
        const hitDistance = Math.sqrt(dx ** 2 + dy ** 2 + dz ** 2);
        if (hitDistance < closestDistance) {
          closestDistance = hitDistance;
          closestHit = {
            targetId: target.id,
            hitPosition: closestPoint
          };
        }
      }
    });

    return closestHit;
  }

  /**
   * Handle player death
   * @param {string} targetId - Dead player socket ID
   * @param {object|null} killer - Killer info
   */
  handlePlayerDeath(targetId, killer) {
    const target = this.playerManager.getPlayer(targetId);

    if (!target) {
      return;
    }

    // Broadcast death event
    this.io.to(target.roomCode).emit('playerDied', {
      killer: killer || null,
      victim: { id: target.id, username: target.username }
    });

    // Schedule respawn after 3 seconds
    this.playerManager.scheduleRespawn(targetId, (playerId) => {
      this.respawnPlayer(playerId);
    });
  }

  /**
   * Respawn a player
   * @param {string} socketId - Player socket ID
   */
  respawnPlayer(socketId) {
    const player = this.playerManager.getPlayer(socketId);

    if (!player) {
      return;
    }

    const spawnPosition = this.playerManager.spawnPlayer(socketId);

    if (spawnPosition) {
      // Broadcast respawn event
      this.io.to(player.roomCode).emit('playerRespawned', {
        playerId: socketId,
        position: spawnPosition,
        hp: 100
      });

      console.log(`[Game Logic] Player ${player.username} respawned`);
    }
  }

  /**
   * Broadcast game state to all players in room
   * @param {string} roomCode - Room code
   * @param {Array} players - Array of player objects
   */
  broadcastGameState(roomCode, players) {
    // Create game state snapshot
    const gameState = {
      timestamp: Date.now(),
      players: players.map(p => ({
        id: p.id,
        username: p.username,
        position: p.position,
        rotation: p.rotation,
        hp: p.hp,
        weapon: p.weapon,
        isCrouching: p.isCrouching,
        isAlive: p.isAlive,
        spawnProtection: p.spawnProtection,
        kills: p.kills,
        color: p.color
      }))
    };

    // Broadcast to all players in room
    this.io.to(roomCode).emit('gameState', gameState);
  }

  /**
   * Handle player spawning when game starts
   * @param {string} roomCode - Room code
   */
  handleGameStart(roomCode) {
    const players = this.playerManager.getPlayersInRoom(roomCode);

    // Spawn all players and broadcast their spawn positions
    players.forEach(player => {
      const spawnPosition = this.playerManager.spawnPlayer(player.id);

      if (spawnPosition) {
        // Broadcast spawn event to all players in room
        this.io.to(roomCode).emit('playerRespawned', {
          playerId: player.id,
          position: spawnPosition,
          hp: 100
        });
      }
    });

    console.log(`[Game Logic] Spawned ${players.length} players for room ${roomCode}`);
  }
}

module.exports = GameLogic;
