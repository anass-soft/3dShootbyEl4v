/**
 * Map Generator
 * Procedurally generates the 3D map using Three.js primitives
 */

/**
 * Generate the complete game map
 * @param {THREE.Scene} scene - Three.js scene to add geometry to
 */
export function generateMap(scene) {
  console.log('[Map] Generating procedural map...');

  // Create ground
  createGround(scene);

  // Create outer walls
  createOuterWalls(scene);

  // Create elevated walkways
  createWalkways(scene);

  // Create central platform
  createCentralPlatform(scene);

  // Create ramps to central platform
  createRamps(scene);

  // Create cover blocks
  createCoverBlocks(scene);

  console.log('[Map] Map generation complete');
}

/**
 * Create ground floor
 * @param {THREE.Scene} scene - Three.js scene
 */
function createGround(scene) {
  const geometry = new THREE.PlaneGeometry(60, 60);
  const material = new THREE.MeshLambertMaterial({
    color: 0x90EE90, // Light green
    side: THREE.DoubleSide
  });

  const ground = new THREE.Mesh(geometry, material);
  ground.rotation.x = -Math.PI / 2; // Rotate to horizontal
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;

  scene.add(ground);
}

/**
 * Create outer perimeter walls
 * @param {THREE.Scene} scene - Three.js scene
 */
function createOuterWalls(scene) {
  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 }); // Gray

  // North Wall
  const northWall = createWall(60, 8, 1, wallMaterial);
  northWall.position.set(0, 4, -30);
  scene.add(northWall);

  // South Wall
  const southWall = createWall(60, 8, 1, wallMaterial);
  southWall.position.set(0, 4, 30);
  scene.add(southWall);

  // East Wall
  const eastWall = createWall(1, 8, 60, wallMaterial);
  eastWall.position.set(30, 4, 0);
  scene.add(eastWall);

  // West Wall
  const westWall = createWall(1, 8, 60, wallMaterial);
  westWall.position.set(-30, 4, 0);
  scene.add(westWall);
}

/**
 * Create elevated walkways (orange platforms)
 * @param {THREE.Scene} scene - Three.js scene
 */
function createWalkways(scene) {
  const walkwayMaterial = new THREE.MeshLambertMaterial({ color: 0xFFA500 }); // Orange

  // North Walkway
  const northWalkway = createBox(40, 1, 4, walkwayMaterial);
  northWalkway.position.set(0, 5, -15);
  scene.add(northWalkway);

  // South Walkway
  const southWalkway = createBox(40, 1, 4, walkwayMaterial);
  southWalkway.position.set(0, 5, 15);
  scene.add(southWalkway);
}

/**
 * Create central raised platform
 * @param {THREE.Scene} scene - Three.js scene
 */
function createCentralPlatform(scene) {
  const platformMaterial = new THREE.MeshLambertMaterial({ color: 0xDDDDDD }); // Light gray

  const platform = createBox(10, 2, 10, platformMaterial);
  platform.position.set(0, 3, 0);
  scene.add(platform);
}

/**
 * Create ramps to central platform
 * @param {THREE.Scene} scene - Three.js scene
 */
function createRamps(scene) {
  const rampMaterial = new THREE.MeshLambertMaterial({ color: 0xCCCCCC }); // Gray

  // North Ramp
  const northRamp = createBox(4, 0.5, 8, rampMaterial);
  northRamp.position.set(0, 1.5, -9);
  northRamp.rotation.x = -22 * (Math.PI / 180); // Slope upward
  scene.add(northRamp);

  // South Ramp
  const southRamp = createBox(4, 0.5, 8, rampMaterial);
  southRamp.position.set(0, 1.5, 9);
  southRamp.rotation.x = 22 * (Math.PI / 180); // Slope upward
  scene.add(southRamp);

  // East Ramp
  const eastRamp = createBox(8, 0.5, 4, rampMaterial);
  eastRamp.position.set(9, 1.5, 0);
  eastRamp.rotation.z = 22 * (Math.PI / 180); // Slope upward
  scene.add(eastRamp);

  // West Ramp
  const westRamp = createBox(8, 0.5, 4, rampMaterial);
  westRamp.position.set(-9, 1.5, 0);
  westRamp.rotation.z = -22 * (Math.PI / 180); // Slope upward
  scene.add(westRamp);
}

/**
 * Create cover blocks (12 total, symmetrically placed)
 * @param {THREE.Scene} scene - Three.js scene
 */
function createCoverBlocks(scene) {
  const blockMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown

  const blockPositions = [
    { x: -18, y: 1, z: -18 }, // NW quadrant
    { x: -18, y: 1, z: 18 },  // SW quadrant
    { x: 18, y: 1, z: -18 },  // NE quadrant
    { x: 18, y: 1, z: 18 },   // SE quadrant
    { x: -12, y: 1, z: -8 },
    { x: -12, y: 1, z: 8 },
    { x: 12, y: 1, z: -8 },
    { x: 12, y: 1, z: 8 },
    { x: 0, y: 1, z: -22 },
    { x: 0, y: 1, z: 22 },
    { x: -22, y: 1, z: 0 },
    { x: 22, y: 1, z: 0 }
  ];

  blockPositions.forEach(pos => {
    const block = createBox(2, 2, 2, blockMaterial);
    block.position.set(pos.x, pos.y, pos.z);
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
  });
}

/**
 * Helper: Create a box mesh
 * @param {number} width - Width (X dimension)
 * @param {number} height - Height (Y dimension)
 * @param {number} depth - Depth (Z dimension)
 * @param {THREE.Material} material - Material
 * @returns {THREE.Mesh} Box mesh
 */
function createBox(width, height, depth, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Helper: Create a wall mesh
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} depth - Depth
 * @param {THREE.Material} material - Material
 * @returns {THREE.Mesh} Wall mesh
 */
function createWall(width, height, depth, material) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Setup scene lighting
 * @param {THREE.Scene} scene - Three.js scene
 */
export function setupLighting(scene) {
  // Ambient light (base illumination)
  const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.6);
  scene.add(ambientLight);

  // Directional light (main light with shadows)
  const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 0.8);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;

  // Shadow settings
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -60;
  directionalLight.shadow.camera.right = 60;
  directionalLight.shadow.camera.top = 60;
  directionalLight.shadow.camera.bottom = -60;

  scene.add(directionalLight);

  console.log('[Map] Lighting setup complete');
}

/**
 * Setup scene background and fog
 * @param {THREE.Scene} scene - Three.js scene
 */
export function setupEnvironment(scene) {
  // Sky blue background
  scene.background = new THREE.Color(0x87CEEB);

  // Add fog for distance fading
  scene.fog = new THREE.Fog(0x87CEEB, 50, 100);

  console.log('[Map] Environment setup complete');
}
