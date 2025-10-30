/**
 * Player Management
 * Handles local player state, other players rendering, and interpolation
 */

/**
 * Local Player Class
 * Represents the local player (client-side prediction)
 */
export class LocalPlayer {
  constructor(camera, playerId) {
    this.camera = camera;
    this.playerId = playerId;

    // Position and rotation
    this.position = { x: 0, y: 0, z: 0 };
    this.rotation = { yaw: 0, pitch: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };

    // State
    this.hp = 100;
    this.isAlive = false;
    this.isCrouching = false;
    this.isGrounded = true;
    this.weapon = 'ak47';
    this.kills = 0;

    // Input state
    this.inputState = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      crouch: false
    };

    // Physics constants
    this.walkSpeed = 5;
    this.crouchSpeed = 2.5;
    this.jumpVelocity = 2;
    this.gravity = -20;

    // Camera settings
    this.standingHeight = 1.6;
    this.crouchingHeight = 0.8;

    // Mouse sensitivity
    this.mouseSensitivity = 0.002;
  }

  /**
   * Update player position based on input (client prediction)
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    if (!this.isAlive) {
      if (!this._deadWarnLogged) {
        console.error('[LocalPlayer] CRITICAL: update() called but isAlive=false', {
          playerId: this.playerId,
          isAlive: this.isAlive,
          hp: this.hp,
          position: this.position,
          hasInputState: !!this.inputState
        });
        this._deadWarnLogged = true;
        // Log again after 2s if still dead
        setTimeout(() => { this._deadWarnLogged = false; }, 2000);
      }
      return;
    }

    // Calculate movement speed
    const moveSpeed = this.isCrouching ? this.crouchSpeed : this.walkSpeed;

    // Process movement input
    let moveX = 0;
    let moveZ = 0;

    if (this.inputState.forward) moveZ -= 1;
    if (this.inputState.backward) moveZ += 1;
    if (this.inputState.left) moveX -= 1;
    if (this.inputState.right) moveX += 1;

    // Debug: Log if any input is active (only once per second to avoid spam)
    if (!this._lastInputLog || Date.now() - this._lastInputLog > 1000) {
      if (moveX !== 0 || moveZ !== 0) {
        console.log('[LocalPlayer] Movement input active:', this.inputState);
        this._lastInputLog = Date.now();
      }
    }

    // Normalize diagonal movement
    if (moveX !== 0 && moveZ !== 0) {
      moveX *= 0.707;
      moveZ *= 0.707;
    }

    // Apply movement based on camera yaw
    const yaw = this.rotation.yaw;
    this.velocity.x = (moveX * Math.cos(yaw) - moveZ * Math.sin(yaw)) * moveSpeed;
    this.velocity.z = (moveX * Math.sin(yaw) + moveZ * Math.cos(yaw)) * moveSpeed;

    // Apply gravity
    if (!this.isGrounded) {
      this.velocity.y += this.gravity * deltaTime;
    }

    // Update position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;

    // Ground detection
    if (this.position.y <= 0 && this.velocity.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Clamp to map boundaries
    this.position.x = Math.max(-30, Math.min(30, this.position.x));
    this.position.z = Math.max(-30, Math.min(30, this.position.z));

    // Update camera position
    this.updateCamera();
  }

  /**
   * Update camera position and rotation
   */
  updateCamera() {
    const cameraHeight = this.isCrouching ? this.crouchingHeight : this.standingHeight;
    this.camera.position.set(
      this.position.x,
      this.position.y + cameraHeight,
      this.position.z
    );

    // Apply rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.rotation.yaw;
    this.camera.rotation.x = this.rotation.pitch;
  }

  /**
   * Handle mouse movement for looking around
   * @param {number} movementX - Mouse movement X
   * @param {number} movementY - Mouse movement Y
   */
  handleMouseMove(movementX, movementY) {
    if (!this._mouseLogShown && (movementX !== 0 || movementY !== 0)) {
      console.log('[LocalPlayer] Mouse movement detected, pointer lock working');
      this._mouseLogShown = true;
    }

    this.rotation.yaw -= movementX * this.mouseSensitivity;
    this.rotation.pitch -= movementY * this.mouseSensitivity;

    // Clamp pitch to prevent looking too far up/down
    const maxPitch = (89 * Math.PI) / 180;
    this.rotation.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.rotation.pitch));
  }

  /**
   * Handle jump
   */
  jump() {
    if (this.isGrounded && this.isAlive) {
      this.velocity.y = this.jumpVelocity;
      this.isGrounded = false;
    }
  }

  /**
   * Toggle crouch
   */
  toggleCrouch() {
    if (this.isAlive) {
      this.isCrouching = !this.isCrouching;
    }
  }

  /**
   * Apply server correction to position
   * @param {object} serverPosition - Server's authoritative position
   */
  applyServerCorrection(serverPosition) {
    // Calculate distance from server position
    const dx = serverPosition.x - this.position.x;
    const dy = serverPosition.y - this.position.y;
    const dz = serverPosition.z - this.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // If difference is significant, smoothly interpolate toward server position
    if (distance > 0.5) {
      this.position.x += dx * 0.1; // Smooth correction
      this.position.y += dy * 0.1;
      this.position.z += dz * 0.1;
    }
  }

  /**
   * Get input state for sending to server
   * @returns {object} Input state
   */
  getInputState() {
    return {
      movement: {
        forward: this.inputState.forward,
        backward: this.inputState.backward,
        left: this.inputState.left,
        right: this.inputState.right,
        jump: this.inputState.jump,
        crouch: this.inputState.crouch
      },
      rotation: {
        yaw: this.rotation.yaw,
        pitch: this.rotation.pitch
      },
      timestamp: Date.now()
    };
  }

  /**
   * Spawn the player at a position
   * @param {object} position - Spawn position
   */
  spawn(position) {
    console.log('[LocalPlayer] Spawning at position:', position);
    this.position = { ...position };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.hp = 100;
    this.isAlive = true;
    this.isCrouching = false;
    this.isGrounded = true;
    this.weapon = 'ak47';
    this.updateCamera();
    console.log('[LocalPlayer] Spawn complete, isAlive:', this.isAlive);
  }

  /**
   * Handle player death
   */
  die() {
    this.isAlive = false;
    this.hp = 0;
  }
}

/**
 * Other Players Manager
 * Manages rendering and interpolation of other players
 */
export class OtherPlayersManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map(); // Map of player ID to player object
  }

  /**
   * Update or create other player
   * @param {object} playerData - Player data from server
   */
  updatePlayer(playerData) {
    let player = this.players.get(playerData.id);

    if (!player) {
      // Create new player
      player = this.createPlayer(playerData);
      this.players.set(playerData.id, player);
    }

    // Update player data
    player.targetPosition = { ...playerData.position };
    player.targetRotation = { ...playerData.rotation };
    player.hp = playerData.hp;
    player.isAlive = playerData.isAlive;
    player.isCrouching = playerData.isCrouching;
    player.spawnProtection = playerData.spawnProtection;
    player.username = playerData.username;
    player.kills = playerData.kills;

    // Update visibility based on alive status
    if (player.mesh) {
      player.mesh.visible = playerData.isAlive;
    }

    // Update opacity based on spawn protection
    if (player.body && player.head) {
      if (playerData.spawnProtection) {
        player.body.material.opacity = 0.5;
        player.body.material.transparent = true;
        player.head.material.opacity = 0.5;
        player.head.material.transparent = true;
      } else {
        player.body.material.opacity = 1.0;
        player.body.material.transparent = false;
        player.head.material.opacity = 1.0;
        player.head.material.transparent = false;
      }
    }
  }

  /**
   * Create a new player model
   * @param {object} playerData - Player data
   * @returns {object} Player object
   */
  createPlayer(playerData) {
    const player = {
      id: playerData.id,
      username: playerData.username,
      color: playerData.color,
      position: { ...playerData.position },
      targetPosition: { ...playerData.position },
      rotation: { ...playerData.rotation },
      targetRotation: { ...playerData.rotation },
      hp: playerData.hp,
      isAlive: playerData.isAlive,
      isCrouching: playerData.isCrouching,
      spawnProtection: playerData.spawnProtection,
      mesh: null
    };

    // Create player mesh (body + head)
    const group = new THREE.Group();

    // Body (cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const bodyMaterial = new THREE.MeshLambertMaterial({
      color: parseInt(playerData.color.replace('#', '0x'))
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1; // Center at Y=1 (height of 2)
    group.add(body);

    // Head (sphere)
    const headGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    const headMaterial = new THREE.MeshLambertMaterial({
      color: parseInt(playerData.color.replace('#', '0x'))
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.2; // On top of body
    group.add(head);

    player.mesh = group;
    player.body = body;
    player.head = head;

    this.scene.add(group);

    console.log(`[Players] Created player: ${playerData.username}`);

    return player;
  }

  /**
   * Interpolate other players' positions for smooth movement
   * @param {number} deltaTime - Time since last frame
   */
  interpolate(deltaTime) {
    this.players.forEach(player => {
      if (!player.isAlive || !player.mesh) {
        return;
      }

      // Interpolate position
      const lerpFactor = Math.min(deltaTime * 10, 1); // Smooth interpolation
      player.position.x += (player.targetPosition.x - player.position.x) * lerpFactor;
      player.position.y += (player.targetPosition.y - player.position.y) * lerpFactor;
      player.position.z += (player.targetPosition.z - player.position.z) * lerpFactor;

      // Interpolate rotation
      player.rotation.yaw += (player.targetRotation.yaw - player.rotation.yaw) * lerpFactor;

      // Update mesh position and rotation
      player.mesh.position.set(player.position.x, player.position.y, player.position.z);
      player.mesh.rotation.y = player.rotation.yaw;

      // Adjust body height based on crouch
      if (player.isCrouching) {
        player.body.scale.y = 0.5;
        player.body.position.y = 0.5;
        player.head.position.y = 1.2;
      } else {
        player.body.scale.y = 1;
        player.body.position.y = 1;
        player.head.position.y = 2.2;
      }
    });
  }

  /**
   * Remove a player
   * @param {string} playerId - Player ID to remove
   */
  removePlayer(playerId) {
    const player = this.players.get(playerId);

    if (player && player.mesh) {
      this.scene.remove(player.mesh);
      console.log(`[Players] Removed player: ${playerId}`);
    }

    this.players.delete(playerId);
  }

  /**
   * Get all other players
   * @returns {Map} Players map
   */
  getPlayers() {
    return this.players;
  }

  /**
   * Clear all players
   */
  clearAll() {
    this.players.forEach(player => {
      if (player.mesh) {
        this.scene.remove(player.mesh);
      }
    });

    this.players.clear();
    console.log('[Players] Cleared all players');
  }
}
