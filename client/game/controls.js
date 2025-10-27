/**
 * Input Controller
 * Simplified, reliable input handling for player controls
 */

export class InputController {
  constructor() {
    // Keyboard state
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      crouch: false,
      fire: false,
      weapon1: false,
      weapon2: false
    };

    // Mouse state
    this.mouseMovement = { x: 0, y: 0 };
    this.pointerLocked = false;

    // Bind methods
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);

    console.log('[Controls] Input controller initialized');
  }

  /**
   * Start listening for input
   */
  enable() {
    document.addEventListener('keydown', this.onKeyDown, false);
    document.addEventListener('keyup', this.onKeyUp, false);
    document.addEventListener('mousemove', this.onMouseMove, false);
    document.addEventListener('mousedown', this.onMouseDown, false);
    document.addEventListener('mouseup', this.onMouseUp, false);
    document.addEventListener('pointerlockchange', this.onPointerLockChange, false);

    console.log('[Controls] Input listeners enabled');
  }

  /**
   * Stop listening for input
   */
  disable() {
    document.removeEventListener('keydown', this.onKeyDown, false);
    document.removeEventListener('keyup', this.onKeyUp, false);
    document.removeEventListener('mousemove', this.onMouseMove, false);
    document.removeEventListener('mousedown', this.onMouseDown, false);
    document.removeEventListener('mouseup', this.onMouseUp, false);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange, false);

    console.log('[Controls] Input listeners disabled');
  }

  /**
   * Handle key down
   */
  onKeyDown(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'Space':
        this.keys.jump = true;
        this.keys.fire = true; // Space can also fire
        break;
      case 'KeyC':
        this.keys.crouch = true;
        break;
      case 'Digit1':
        this.keys.weapon1 = true;
        break;
      case 'Digit2':
        this.keys.weapon2 = true;
        break;
    }
  }

  /**
   * Handle key up
   */
  onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.backward = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'Space':
        this.keys.jump = false;
        this.keys.fire = false;
        break;
      case 'KeyC':
        this.keys.crouch = false;
        break;
      case 'Digit1':
        this.keys.weapon1 = false;
        break;
      case 'Digit2':
        this.keys.weapon2 = false;
        break;
    }
  }

  /**
   * Handle mouse movement
   */
  onMouseMove(event) {
    if (this.pointerLocked) {
      this.mouseMovement.x = event.movementX || 0;
      this.mouseMovement.y = event.movementY || 0;
    }
  }

  /**
   * Handle mouse down
   */
  onMouseDown(event) {
    if (event.button === 0) { // Left click
      this.keys.fire = true;
    }
  }

  /**
   * Handle mouse up
   */
  onMouseUp(event) {
    if (event.button === 0) { // Left click
      this.keys.fire = false;
    }
  }

  /**
   * Handle pointer lock change
   */
  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement !== null;
    console.log('[Controls] Pointer lock:', this.pointerLocked);
  }

  /**
   * Request pointer lock on element
   */
  requestPointerLock(element) {
    element.requestPointerLock = element.requestPointerLock || element.mozRequestPointerLock;

    element.addEventListener('click', () => {
      if (!this.pointerLocked) {
        element.requestPointerLock();
        console.log('[Controls] Requesting pointer lock...');
      }
    });
  }

  /**
   * Get current mouse movement and reset
   */
  getMouseDelta() {
    const delta = { ...this.mouseMovement };
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
    return delta;
  }

  /**
   * Check if pointer is locked
   */
  isPointerLocked() {
    return this.pointerLocked;
  }

  /**
   * Get current key states
   */
  getKeyStates() {
    return { ...this.keys };
  }

  /**
   * Reset all keys
   */
  reset() {
    for (let key in this.keys) {
      this.keys[key] = false;
    }
    this.mouseMovement.x = 0;
    this.mouseMovement.y = 0;
  }
}
