/**
 * UI Manager
 * Handles HUD updates, kill feed, death screen, and mobile controls
 */

export class UIManager {
  constructor(localPlayer) {
    this.localPlayer = localPlayer;

    // HUD Elements
    this.fpsElement = document.getElementById('fpsValue');
    this.scoreElement = document.getElementById('scoreValue');
    this.healthBar = document.getElementById('healthBar');
    this.healthText = document.getElementById('healthText');
    this.weaponName = document.getElementById('weaponName');
    this.killFeedContainer = document.getElementById('killFeed');

    // Death screen
    this.deathScreen = document.getElementById('deathScreen');
    this.deathMessage = document.getElementById('deathMessage');
    this.respawnTimer = document.getElementById('respawnTimer');

    // Kill feed items (max 5)
    this.killFeedItems = [];
    this.maxKillFeedItems = 5;

    // FPS calculation
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
    this.currentFps = 60;
  }

  /**
   * Update FPS counter
   */
  updateFPS() {
    this.frameCount++;
    const now = Date.now();

    if (now - this.lastFpsUpdate >= 1000) {
      this.currentFps = this.frameCount;
      this.fpsElement.textContent = this.currentFps;
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }
  }

  /**
   * Update health bar and text
   * @param {number} hp - Current health
   */
  updateHealth(hp) {
    const healthPercent = Math.max(0, Math.min(100, hp));
    this.healthBar.style.width = healthPercent + '%';
    this.healthText.textContent = `${Math.floor(hp)} / 100`;

    // Change color based on health
    if (healthPercent > 50) {
      this.healthBar.style.backgroundColor = '#4CAF50'; // Green
    } else if (healthPercent > 25) {
      this.healthBar.style.backgroundColor = '#FFA500'; // Orange
    } else {
      this.healthBar.style.backgroundColor = '#f44336'; // Red
    }
  }

  /**
   * Update score display
   * @param {number} kills - Number of kills
   */
  updateScore(kills) {
    this.scoreElement.textContent = kills;
  }

  /**
   * Update weapon display
   * @param {string} weaponName - Weapon name to display
   */
  updateWeapon(weaponName) {
    this.weaponName.textContent = weaponName;
  }

  /**
   * Add kill to kill feed
   * @param {string} killerName - Killer username
   * @param {string} victimName - Victim username
   * @param {boolean} isLocalPlayer - Whether local player is involved
   */
  addKillFeed(killerName, victimName, isLocalPlayer) {
    // Create kill feed item
    const item = document.createElement('div');
    item.className = 'kill-feed-item';

    // Format names
    const killerDisplay = isLocalPlayer && killerName === this.localPlayer.username ? 'You' : killerName;
    const victimDisplay = isLocalPlayer && victimName === this.localPlayer.username ? 'You' : victimName;

    item.innerHTML = `
      <span class="kill-feed-killer">${killerDisplay}</span>
      killed
      <span class="kill-feed-victim">${victimDisplay}</span>
    `;

    // Add to container
    this.killFeedContainer.insertBefore(item, this.killFeedContainer.firstChild);

    // Store reference
    this.killFeedItems.push({
      element: item,
      timestamp: Date.now()
    });

    // Remove old items if exceeds max
    if (this.killFeedItems.length > this.maxKillFeedItems) {
      const oldItem = this.killFeedItems.shift();
      oldItem.element.remove();
    }

    // Auto-remove after 5 seconds
    setTimeout(() => {
      const index = this.killFeedItems.findIndex(i => i.element === item);
      if (index !== -1) {
        this.killFeedItems.splice(index, 1);
        item.remove();
      }
    }, 5000);
  }

  /**
   * Show death screen
   * @param {string} killerName - Name of killer (null if suicide)
   */
  showDeathScreen(killerName) {
    this.deathScreen.classList.remove('hidden');

    if (killerName) {
      this.deathMessage.textContent = `You were killed by ${killerName}`;
    } else {
      this.deathMessage.textContent = 'You died';
    }

    // Start respawn countdown
    this.startRespawnCountdown();
  }

  /**
   * Hide death screen
   */
  hideDeathScreen() {
    this.deathScreen.classList.add('hidden');
  }

  /**
   * Start respawn countdown timer
   */
  startRespawnCountdown() {
    let secondsLeft = 3;
    this.respawnTimer.textContent = `Respawning in ${secondsLeft}...`;

    const countdown = setInterval(() => {
      secondsLeft--;

      if (secondsLeft > 0) {
        this.respawnTimer.textContent = `Respawning in ${secondsLeft}...`;
      } else {
        this.respawnTimer.textContent = 'Respawning...';
        clearInterval(countdown);
      }
    }, 1000);
  }

  /**
   * Update all HUD elements
   */
  updateHUD() {
    this.updateFPS();
    this.updateHealth(this.localPlayer.hp);
    this.updateScore(this.localPlayer.kills);
  }
}

/**
 * Mobile Controls Manager
 * Handles touch controls for mobile devices
 */
export class MobileControls {
  constructor(localPlayer, weaponManager) {
    this.localPlayer = localPlayer;
    this.weaponManager = weaponManager;

    // Detect if mobile
    this.isMobile = this.detectMobile();

    if (!this.isMobile) {
      return; // Don't initialize if not mobile
    }

    // Mobile control elements
    this.mobileControlsContainer = document.getElementById('mobileControls');
    this.joystickOuter = document.getElementById('joystickOuter');
    this.joystickInner = document.getElementById('joystickInner');
    this.fireBtn = document.getElementById('fireBtn');
    this.jumpBtn = document.getElementById('jumpBtn');
    this.crouchBtn = document.getElementById('crouchBtn');
    this.ak47Btn = document.getElementById('ak47Btn');
    this.sniperBtn = document.getElementById('sniperBtn');

    // Joystick state
    this.joystickActive = false;
    this.joystickStartPos = { x: 0, y: 0 };
    this.joystickOffset = { x: 0, y: 0 };

    // Touch look state
    this.touchLookActive = false;
    this.lastTouchPos = { x: 0, y: 0 };

    this.init();
  }

  /**
   * Detect if device is mobile
   * @returns {boolean} Is mobile
   */
  detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  /**
   * Initialize mobile controls
   */
  init() {
    // Show mobile controls
    this.mobileControlsContainer.classList.remove('hidden');

    // Joystick touch events
    this.joystickOuter.addEventListener('touchstart', this.handleJoystickStart.bind(this));
    document.addEventListener('touchmove', this.handleJoystickMove.bind(this));
    document.addEventListener('touchend', this.handleJoystickEnd.bind(this));

    // Fire button
    this.fireBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.weaponManager.startFiring();
    });
    this.fireBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.weaponManager.stopFiring();
    });

    // Jump button
    this.jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.localPlayer.jump();
    });

    // Crouch button
    this.crouchBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.localPlayer.toggleCrouch();
    });

    // Weapon switch buttons
    this.ak47Btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.weaponManager.switchWeapon('ak47');
      this.updateWeaponButtons();
    });

    this.sniperBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.weaponManager.switchWeapon('sniper');
      this.updateWeaponButtons();
    });

    // Touch look (drag anywhere on screen)
    document.addEventListener('touchstart', this.handleTouchLookStart.bind(this));
    document.addEventListener('touchmove', this.handleTouchLookMove.bind(this));
    document.addEventListener('touchend', this.handleTouchLookEnd.bind(this));
  }

  /**
   * Handle joystick touch start
   * @param {TouchEvent} e - Touch event
   */
  handleJoystickStart(e) {
    e.preventDefault();
    this.joystickActive = true;
    const touch = e.touches[0];
    this.joystickStartPos = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  /**
   * Handle joystick touch move
   * @param {TouchEvent} e - Touch event
   */
  handleJoystickMove(e) {
    if (!this.joystickActive) return;

    e.preventDefault();
    const touch = e.touches[0];

    // Calculate offset from start position
    const offsetX = touch.clientX - this.joystickStartPos.x;
    const offsetY = touch.clientY - this.joystickStartPos.y;

    // Clamp to joystick radius (30px)
    const maxRadius = 30;
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    if (distance > maxRadius) {
      this.joystickOffset.x = (offsetX / distance) * maxRadius;
      this.joystickOffset.y = (offsetY / distance) * maxRadius;
    } else {
      this.joystickOffset.x = offsetX;
      this.joystickOffset.y = offsetY;
    }

    // Update joystick inner position
    this.joystickInner.style.transform = `translate(calc(-50% + ${this.joystickOffset.x}px), calc(-50% + ${this.joystickOffset.y}px))`;

    // Update player input state
    const threshold = 10;
    this.localPlayer.inputState.forward = this.joystickOffset.y < -threshold;
    this.localPlayer.inputState.backward = this.joystickOffset.y > threshold;
    this.localPlayer.inputState.left = this.joystickOffset.x < -threshold;
    this.localPlayer.inputState.right = this.joystickOffset.x > threshold;
  }

  /**
   * Handle joystick touch end
   * @param {TouchEvent} e - Touch event
   */
  handleJoystickEnd(e) {
    if (!this.joystickActive) return;

    this.joystickActive = false;
    this.joystickOffset = { x: 0, y: 0 };

    // Reset joystick position
    this.joystickInner.style.transform = 'translate(-50%, -50%)';

    // Reset player input
    this.localPlayer.inputState.forward = false;
    this.localPlayer.inputState.backward = false;
    this.localPlayer.inputState.left = false;
    this.localPlayer.inputState.right = false;
  }

  /**
   * Handle touch look start
   * @param {TouchEvent} e - Touch event
   */
  handleTouchLookStart(e) {
    // Ignore if touching control areas
    if (this.isTouchingControls(e.touches[0])) {
      return;
    }

    this.touchLookActive = true;
    this.lastTouchPos = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
  }

  /**
   * Handle touch look move
   * @param {TouchEvent} e - Touch event
   */
  handleTouchLookMove(e) {
    if (!this.touchLookActive) return;
    if (this.isTouchingControls(e.touches[0])) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - this.lastTouchPos.x;
    const deltaY = touch.clientY - this.lastTouchPos.y;

    // Apply movement with sensitivity
    this.localPlayer.handleMouseMove(deltaX * 0.5, deltaY * 0.5);

    this.lastTouchPos = {
      x: touch.clientX,
      y: touch.clientY
    };
  }

  /**
   * Handle touch look end
   * @param {TouchEvent} e - Touch event
   */
  handleTouchLookEnd(e) {
    this.touchLookActive = false;
  }

  /**
   * Check if touch is on control areas
   * @param {Touch} touch - Touch object
   * @returns {boolean} Is touching controls
   */
  isTouchingControls(touch) {
    const x = touch.clientX;
    const y = touch.clientY;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Bottom left (joystick) - 120x120px
    if (x < 140 && y > screenHeight - 140) {
      return true;
    }

    // Bottom right (action buttons) - 180x180px
    if (x > screenWidth - 200 && y > screenHeight - 200) {
      return true;
    }

    // Top right (weapon buttons) - 50x100px
    if (x > screenWidth - 70 && y < 120) {
      return true;
    }

    return false;
  }

  /**
   * Update weapon button active states
   */
  updateWeaponButtons() {
    const currentWeapon = this.weaponManager.getCurrentWeapon();

    if (currentWeapon === 'ak47') {
      this.ak47Btn.classList.add('active');
      this.sniperBtn.classList.remove('active');
    } else {
      this.sniperBtn.classList.add('active');
      this.ak47Btn.classList.remove('active');
    }
  }
}
