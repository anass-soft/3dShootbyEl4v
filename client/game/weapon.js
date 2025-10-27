/**
 * Weapon System
 * Handles weapon mechanics, firing, and visual effects (tracers, muzzle flash)
 */

/**
 * Weapon Manager Class
 */
export class WeaponManager {
  constructor(scene, camera, socketHandler, localPlayer) {
    this.scene = scene;
    this.camera = camera;
    this.socketHandler = socketHandler;
    this.localPlayer = localPlayer;

    // Current weapon
    this.currentWeapon = 'ak47';

    // Weapon configurations
    this.weapons = {
      ak47: {
        name: 'AK-47',
        damage: 15,
        fireRate: 0.1, // Seconds between shots (600 RPM)
        auto: true, // Automatic fire
        tracerColor: 0xFF0000, // Red
        tracerDuration: 0.2 // Seconds
      },
      sniper: {
        name: 'Sniper Rifle',
        damage: 100,
        fireRate: 1.0, // Seconds between shots (60 RPM)
        auto: false, // Semi-automatic
        tracerColor: 0x0000FF, // Blue
        tracerDuration: 0.3 // Seconds
      }
    };

    // Firing state
    this.lastShotTime = 0;
    this.isFiring = false;
    this.canFire = true;

    // Active tracers (for cleanup)
    this.activeTracers = [];
  }

  /**
   * Update weapon system (called every frame)
   * @param {number} deltaTime - Time since last frame
   */
  update(deltaTime) {
    // Handle automatic fire
    if (this.isFiring && this.weapons[this.currentWeapon].auto) {
      this.tryFire();
    }

    // Update and remove expired tracers
    this.updateTracers(deltaTime);
  }

  /**
   * Start firing (mouse down / touch start)
   */
  startFiring() {
    if (!this.localPlayer.isAlive) {
      return;
    }

    this.isFiring = true;
    this.tryFire();
  }

  /**
   * Stop firing (mouse up / touch end)
   */
  stopFiring() {
    this.isFiring = false;
  }

  /**
   * Attempt to fire weapon
   */
  tryFire() {
    if (!this.localPlayer.isAlive || !this.canFire) {
      return;
    }

    const weapon = this.weapons[this.currentWeapon];
    const now = Date.now() / 1000; // Convert to seconds

    // Check fire rate
    if (now - this.lastShotTime < weapon.fireRate) {
      return;
    }

    this.lastShotTime = now;

    // Calculate shoot direction from camera
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(this.camera.quaternion);

    // Send shot to server
    this.socketHandler.sendShot({
      direction: {
        x: direction.x,
        y: direction.y,
        z: direction.z
      },
      weapon: this.currentWeapon,
      timestamp: Date.now()
    });

    // Play local visual effects
    this.playMuzzleFlash();
  }

  /**
   * Switch weapon
   * @param {string} weapon - Weapon name ('ak47' or 'sniper')
   */
  switchWeapon(weapon) {
    if (this.weapons[weapon] && weapon !== this.currentWeapon) {
      this.currentWeapon = weapon;
      this.localPlayer.weapon = weapon;
      this.socketHandler.switchWeapon(weapon);
      console.log(`[Weapon] Switched to ${this.weapons[weapon].name}`);
    }
  }

  /**
   * Create tracer line for shot
   * @param {object} shotData - Shot data from server
   */
  createTracer(shotData) {
    const weapon = this.weapons[shotData.weapon];
    if (!weapon) {
      return;
    }

    // Get shooter position (if local player, use camera position)
    let shooterPos;
    if (shotData.shooterId === this.localPlayer.playerId) {
      shooterPos = this.camera.position.clone();
    } else {
      // For other players, estimate position
      // (In full implementation, track other players' positions)
      shooterPos = new THREE.Vector3(0, 1.6, 0); // Placeholder
    }

    // Calculate end position
    const direction = new THREE.Vector3(
      shotData.direction.x,
      shotData.direction.y,
      shotData.direction.z
    );

    let endPos;
    if (shotData.hit && shotData.hitPosition) {
      endPos = new THREE.Vector3(
        shotData.hitPosition.x,
        shotData.hitPosition.y,
        shotData.hitPosition.z
      );
    } else {
      // Miss - extend far in direction
      endPos = shooterPos.clone().add(direction.multiplyScalar(100));
    }

    // Create line geometry
    const points = [shooterPos, endPos];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: weapon.tracerColor,
      linewidth: 2
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    // Store tracer with expiry time
    this.activeTracers.push({
      line: line,
      expiryTime: Date.now() + weapon.tracerDuration * 1000
    });
  }

  /**
   * Update active tracers and remove expired ones
   * @param {number} deltaTime - Time since last frame
   */
  updateTracers(deltaTime) {
    const now = Date.now();

    // Remove expired tracers
    this.activeTracers = this.activeTracers.filter(tracer => {
      if (now >= tracer.expiryTime) {
        this.scene.remove(tracer.line);
        tracer.line.geometry.dispose();
        tracer.line.material.dispose();
        return false;
      }
      return true;
    });
  }

  /**
   * Play muzzle flash effect
   */
  playMuzzleFlash() {
    // Create small sphere of light at camera position
    const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFF00,
      emissive: 0xFFFF00
    });
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);

    // Position slightly in front of camera
    const flashPos = new THREE.Vector3(0, 0, -0.5);
    flashPos.applyQuaternion(this.camera.quaternion);
    flashPos.add(this.camera.position);

    flash.position.copy(flashPos);
    this.scene.add(flash);

    // Remove after 0.1 seconds
    setTimeout(() => {
      this.scene.remove(flash);
      flash.geometry.dispose();
      flash.material.dispose();
    }, 100);
  }

  /**
   * Get current weapon name
   * @returns {string} Weapon name
   */
  getCurrentWeaponName() {
    return this.weapons[this.currentWeapon].name;
  }

  /**
   * Get current weapon
   * @returns {string} Weapon ID
   */
  getCurrentWeapon() {
    return this.currentWeapon;
  }
}

/**
 * Hit Marker Display
 * Shows brief indicator when hitting a player
 */
export class HitMarker {
  constructor() {
    this.element = null;
    this.timeout = null;
  }

  /**
   * Show hit marker
   */
  show() {
    // Create element if doesn't exist
    if (!this.element) {
      this.element = document.createElement('div');
      this.element.id = 'hitMarker';
      this.element.style.position = 'absolute';
      this.element.style.top = '50%';
      this.element.style.left = '50%';
      this.element.style.transform = 'translate(-50%, -50%)';
      this.element.style.fontSize = '48px';
      this.element.style.color = '#FF0000';
      this.element.style.fontWeight = 'bold';
      this.element.style.pointerEvents = 'none';
      this.element.style.zIndex = '1000';
      this.element.textContent = 'X';
      document.body.appendChild(this.element);
    }

    // Show element
    this.element.style.display = 'block';

    // Clear existing timeout
    if (this.timeout) {
      clearTimeout(this.timeout);
    }

    // Hide after 0.2 seconds
    this.timeout = setTimeout(() => {
      if (this.element) {
        this.element.style.display = 'none';
      }
    }, 200);
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.element) {
      document.body.removeChild(this.element);
      this.element = null;
    }

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }
}
