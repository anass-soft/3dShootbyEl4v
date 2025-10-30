/**
 * Mobile Controls System
 * Comprehensive touch-based controls for mobile gameplay
 * Includes dual joysticks, action buttons, and settings persistence
 */

/**
 * MobileJoystick Class
 * Handles individual joystick (left for movement, right for camera rotation)
 */
export class MobileJoystick {
  constructor(elementId, isLeftStick = true) {
    this.elementId = elementId;
    this.isLeftStick = isLeftStick;
    
    this.container = document.getElementById(elementId);
    if (!this.container) {
      console.error(`[MobileJoystick] Element with ID '${elementId}' not found`);
      return;
    }
    
    this.background = this.container.querySelector('.joystick-bg');
    this.stick = this.container.querySelector('.joystick-stick');
    
    if (!this.background || !this.stick) {
      console.error(`[MobileJoystick] Required child elements not found in ${elementId}`);
      return;
    }
    
    this.isDragging = false;
    this.touchId = null;
    this.position = { x: 0, y: 0 };
    this.radius = 50;
    this.centerPosition = { x: 0, y: 0 };
    
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchMove = this.handleTouchMove.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    
    this.initEventListeners();
    console.log(`[MobileJoystick] Initialized ${isLeftStick ? 'left' : 'right'} joystick`);
  }
  
  initEventListeners() {
    this.container.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    document.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
  }
  
  handleTouchStart(e) {
    e.preventDefault();
    if (this.isDragging) return;
    
    const touch = e.touches[0];
    if (!touch) return;
    
    this.touchId = touch.identifier;
    this.isDragging = true;
    
    const rect = this.container.getBoundingClientRect();
    this.centerPosition = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    this.updatePosition(touch.clientX, touch.clientY);
  }
  
  handleTouchMove(e) {
    if (!this.isDragging) return;
    
    const touch = Array.from(e.touches).find(t => t.identifier === this.touchId);
    if (!touch) return;
    
    e.preventDefault();
    this.updatePosition(touch.clientX, touch.clientY);
  }
  
  handleTouchEnd(e) {
    if (!this.isDragging) return;
    
    const touchStillActive = Array.from(e.touches).some(t => t.identifier === this.touchId);
    if (touchStillActive) return;
    
    this.isDragging = false;
    this.touchId = null;
    this.position = { x: 0, y: 0 };
    this.stick.style.transform = 'translate(-50%, -50%)';
  }
  
  updatePosition(touchX, touchY) {
    let offsetX = touchX - this.centerPosition.x;
    let offsetY = touchY - this.centerPosition.y;
    
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    
    if (distance > this.radius) {
      const angle = Math.atan2(offsetY, offsetX);
      offsetX = Math.cos(angle) * this.radius;
      offsetY = Math.sin(angle) * this.radius;
    }
    
    this.position.x = offsetX / this.radius;
    this.position.y = offsetY / this.radius;
    
    this.stick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  }
  
  getValue() {
    return { ...this.position };
  }
  
  getRadians() {
    if (this.position.x === 0 && this.position.y === 0) {
      return 0;
    }
    return Math.atan2(this.position.y, this.position.x);
  }
  
  getMagnitude() {
    return Math.sqrt(this.position.x * this.position.x + this.position.y * this.position.y);
  }
  
  cleanup() {
    if (this.container) {
      this.container.removeEventListener('touchstart', this.handleTouchStart);
    }
    document.removeEventListener('touchmove', this.handleTouchMove);
    document.removeEventListener('touchend', this.handleTouchEnd);
    document.removeEventListener('touchcancel', this.handleTouchEnd);
  }
}

/**
 * MobileControlsManager Class
 * Manages all mobile controls including joysticks and buttons
 */
export class MobileControlsManager {
  constructor(localPlayer, weaponManager, socketHandler = null) {
    this.localPlayer = localPlayer;
    this.weaponManager = weaponManager;
    this.socketHandler = socketHandler;
    
    this.enabled = false;
    this.isMobile = this.detectMobile();
    
    this.leftJoystick = null;
    this.rightJoystick = null;
    
    this.container = document.getElementById('mobileControlsContainer');
    this.fireButton = document.getElementById('fireButton');
    this.crouchButton = document.getElementById('crouchButton');
    this.weapon1Button = document.getElementById('weapon1Button');
    this.weapon2Button = document.getElementById('weapon2Button');
    
    this.isFiring = false;
    this.crouchToggled = false;
    
    this.settings = {
      enabled: false,
      sensitivity: 0.5,
      joystickDeadzone: 0.1
    };
    
    this.lookSensitivity = 2.0;
    this.maxRotationSpeed = 0.05;
    
    if (!this.container) {
      console.error('[MobileControls] Mobile controls container not found');
      return;
    }
    
    this.loadSettings();
    
    if (this.isMobile && this.settings.enabled !== false) {
      this.enable();
    }
    
    this.setupSettingsToggle();
    console.log('[MobileControls] Manager initialized', {
      isMobile: this.isMobile,
      enabled: this.enabled
    });
  }
  
  detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    return isMobileUA || (isSmallScreen && hasTouchScreen);
  }
  
  setupSettingsToggle() {
    const toggle = document.getElementById('mobileControlsToggle');
    if (!toggle) return;
    
    toggle.checked = this.enabled;
    
    toggle.addEventListener('change', (e) => {
      if (e.target.checked) {
        this.enable();
      } else {
        this.disable();
      }
    });
  }
  
  enable() {
    if (this.enabled) return;
    
    console.log('[MobileControls] Enabling mobile controls...');
    
    if (this.container) {
      this.container.classList.remove('hidden');
    }
    
    this.leftJoystick = new MobileJoystick('leftJoystick', true);
    this.rightJoystick = new MobileJoystick('rightJoystick', false);
    
    this.setupButtonListeners();
    
    this.enabled = true;
    this.settings.enabled = true;
    this.saveSettings();
    
    console.log('[MobileControls] Mobile controls enabled');
  }
  
  disable() {
    if (!this.enabled) return;
    
    console.log('[MobileControls] Disabling mobile controls...');
    
    if (this.container) {
      this.container.classList.add('hidden');
    }
    
    if (this.leftJoystick) {
      this.leftJoystick.cleanup();
      this.leftJoystick = null;
    }
    
    if (this.rightJoystick) {
      this.rightJoystick.cleanup();
      this.rightJoystick = null;
    }
    
    this.removeButtonListeners();
    
    if (this.localPlayer) {
      this.localPlayer.inputState.forward = false;
      this.localPlayer.inputState.backward = false;
      this.localPlayer.inputState.left = false;
      this.localPlayer.inputState.right = false;
    }
    
    this.enabled = false;
    this.settings.enabled = false;
    this.saveSettings();
    
    console.log('[MobileControls] Mobile controls disabled');
  }
  
  setupButtonListeners() {
    if (this.fireButton) {
      this.fireButton.addEventListener('touchstart', this.handleFireButtonPress);
      this.fireButton.addEventListener('touchend', this.handleFireButtonRelease);
      this.fireButton.addEventListener('touchcancel', this.handleFireButtonRelease);
    }
    
    if (this.crouchButton) {
      this.crouchButton.addEventListener('touchstart', this.handleCrouchButton);
    }
    
    if (this.weapon1Button) {
      this.weapon1Button.addEventListener('touchstart', this.handleWeapon1Button);
    }
    
    if (this.weapon2Button) {
      this.weapon2Button.addEventListener('touchstart', this.handleWeapon2Button);
    }
  }
  
  removeButtonListeners() {
    if (this.fireButton) {
      this.fireButton.removeEventListener('touchstart', this.handleFireButtonPress);
      this.fireButton.removeEventListener('touchend', this.handleFireButtonRelease);
      this.fireButton.removeEventListener('touchcancel', this.handleFireButtonRelease);
    }
    
    if (this.crouchButton) {
      this.crouchButton.removeEventListener('touchstart', this.handleCrouchButton);
    }
    
    if (this.weapon1Button) {
      this.weapon1Button.removeEventListener('touchstart', this.handleWeapon1Button);
    }
    
    if (this.weapon2Button) {
      this.weapon2Button.removeEventListener('touchstart', this.handleWeapon2Button);
    }
  }
  
  handleFireButtonPress = (e) => {
    e.preventDefault();
    this.handleFireButton(true);
  }
  
  handleFireButtonRelease = (e) => {
    e.preventDefault();
    this.handleFireButton(false);
  }
  
  handleFireButton(pressed) {
    if (!this.weaponManager) return;
    
    if (pressed && !this.isFiring) {
      this.isFiring = true;
      this.weaponManager.startFiring();
    } else if (!pressed && this.isFiring) {
      this.isFiring = false;
      this.weaponManager.stopFiring();
    }
  }
  
  handleCrouchButton = (e) => {
    e.preventDefault();
    this.handleCrouchToggle();
  }
  
  handleCrouchToggle() {
    if (!this.localPlayer) return;
    
    this.localPlayer.toggleCrouch();
    this.crouchToggled = this.localPlayer.isCrouching;
    
    if (this.crouchButton) {
      if (this.crouchToggled) {
        this.crouchButton.classList.add('active');
      } else {
        this.crouchButton.classList.remove('active');
      }
    }
  }
  
  handleWeapon1Button = (e) => {
    e.preventDefault();
    this.handleWeaponSwitch('ak47');
  }
  
  handleWeapon2Button = (e) => {
    e.preventDefault();
    this.handleWeaponSwitch('sniper');
  }
  
  handleWeaponSwitch(weapon) {
    if (!this.weaponManager) return;
    
    this.weaponManager.switchWeapon(weapon);
    
    if (this.weapon1Button && this.weapon2Button) {
      if (weapon === 'ak47') {
        this.weapon1Button.classList.add('active');
        this.weapon2Button.classList.remove('active');
      } else {
        this.weapon2Button.classList.add('active');
        this.weapon1Button.classList.remove('active');
      }
    }
  }
  
  update(deltaTime) {
    if (!this.enabled || !this.localPlayer) return;
    
    if (this.leftJoystick) {
      const moveInput = this.leftJoystick.getValue();
      const magnitude = this.leftJoystick.getMagnitude();
      
      if (magnitude > this.settings.joystickDeadzone) {
        this.localPlayer.inputState.forward = moveInput.y < -this.settings.joystickDeadzone;
        this.localPlayer.inputState.backward = moveInput.y > this.settings.joystickDeadzone;
        this.localPlayer.inputState.left = moveInput.x < -this.settings.joystickDeadzone;
        this.localPlayer.inputState.right = moveInput.x > this.settings.joystickDeadzone;
      } else {
        this.localPlayer.inputState.forward = false;
        this.localPlayer.inputState.backward = false;
        this.localPlayer.inputState.left = false;
        this.localPlayer.inputState.right = false;
      }
    }
    
    if (this.rightJoystick) {
      const lookInput = this.rightJoystick.getValue();
      const magnitude = this.rightJoystick.getMagnitude();
      
      if (magnitude > this.settings.joystickDeadzone) {
        const rotationX = lookInput.x * this.lookSensitivity * this.settings.sensitivity * deltaTime * 60;
        const rotationY = lookInput.y * this.lookSensitivity * this.settings.sensitivity * deltaTime * 60;
        
        const clampedX = Math.max(-this.maxRotationSpeed, Math.min(this.maxRotationSpeed, rotationX));
        const clampedY = Math.max(-this.maxRotationSpeed, Math.min(this.maxRotationSpeed, rotationY));
        
        this.localPlayer.handleMouseMove(-clampedX * 100, clampedY * 100);
      }
    }
  }
  
  loadSettings() {
    try {
      const saved = localStorage.getItem('mobileControlsSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
      }
    } catch (error) {
      console.error('[MobileControls] Failed to load settings:', error);
    }
  }
  
  saveSettings() {
    try {
      localStorage.setItem('mobileControlsSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('[MobileControls] Failed to save settings:', error);
    }
  }
  
  setSensitivity(sensitivity) {
    this.settings.sensitivity = Math.max(0, Math.min(1, sensitivity));
    this.saveSettings();
  }
  
  setDeadzone(deadzone) {
    this.settings.joystickDeadzone = Math.max(0, Math.min(1, deadzone));
    this.saveSettings();
  }
  
  isEnabled() {
    return this.enabled;
  }
  
  isMobileDevice() {
    return this.isMobile;
  }
}

export default MobileControlsManager;