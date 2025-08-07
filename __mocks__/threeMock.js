// Mock Three.js for Jest testing
const threeMock = {
  Scene: jest.fn(() => ({
    add: jest.fn(),
    remove: jest.fn(),
    traverse: jest.fn(),
    background: null,
    children: [],
  })),

  PerspectiveCamera: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    lookAt: jest.fn(),
    updateProjectionMatrix: jest.fn(),
    aspect: 1,
    fov: 75,
    near: 0.1,
    far: 1000,
  })),

  WebGLRenderer: jest.fn(() => ({
    setSize: jest.fn(),
    render: jest.fn(),
    setClearColor: jest.fn(),
    setPixelRatio: jest.fn(),
    domElement: {
      style: {},
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    dispose: jest.fn(),
    getContext: jest.fn(() => ({})),
    capabilities: { maxTextureSize: 2048 },
  })),

  Mesh: jest.fn(() => ({
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set: jest.fn() },
    material: null,
    geometry: null,
    visible: true,
    userData: {},
  })),

  BoxGeometry: jest.fn(() => ({
    type: 'BoxGeometry',
    dispose: jest.fn(),
  })),

  SphereGeometry: jest.fn(() => ({
    type: 'SphereGeometry',
    dispose: jest.fn(),
  })),

  PlaneGeometry: jest.fn(() => ({
    type: 'PlaneGeometry',
    dispose: jest.fn(),
  })),

  MeshBasicMaterial: jest.fn(() => ({
    type: 'MeshBasicMaterial',
    color: { r: 1, g: 1, b: 1 },
    transparent: false,
    opacity: 1,
    dispose: jest.fn(),
  })),

  MeshStandardMaterial: jest.fn(() => ({
    type: 'MeshStandardMaterial',
    color: { r: 1, g: 1, b: 1 },
    roughness: 1,
    metalness: 0,
    transparent: false,
    opacity: 1,
    dispose: jest.fn(),
  })),

  Vector3: jest.fn(() => ({
    x: 0,
    y: 0,
    z: 0,
    set: jest.fn(),
    copy: jest.fn(),
    add: jest.fn(),
    sub: jest.fn(),
    multiply: jest.fn(),
    normalize: jest.fn(),
    length: jest.fn(() => 0),
    distanceTo: jest.fn(() => 0),
  })),

  Vector2: jest.fn(() => ({
    x: 0,
    y: 0,
    set: jest.fn(),
    copy: jest.fn(),
  })),

  Color: jest.fn(() => ({
    r: 1,
    g: 1,
    b: 1,
    set: jest.fn(),
    setHex: jest.fn(),
    setRGB: jest.fn(),
    getHex: jest.fn(() => 0xffffff),
  })),

  AmbientLight: jest.fn(() => ({
    type: 'AmbientLight',
    color: { r: 1, g: 1, b: 1 },
    intensity: 1,
  })),

  DirectionalLight: jest.fn(() => ({
    type: 'DirectionalLight',
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    color: { r: 1, g: 1, b: 1 },
    intensity: 1,
    target: { position: { x: 0, y: 0, z: 0 } },
  })),

  PointLight: jest.fn(() => ({
    type: 'PointLight',
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    color: { r: 1, g: 1, b: 1 },
    intensity: 1,
    distance: 0,
    decay: 1,
  })),

  Group: jest.fn(() => ({
    type: 'Group',
    add: jest.fn(),
    remove: jest.fn(),
    children: [],
    position: { x: 0, y: 0, z: 0, set: jest.fn() },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1, set: jest.fn() },
  })),

  Raycaster: jest.fn(() => ({
    setFromCamera: jest.fn(),
    intersectObjects: jest.fn(() => []),
    ray: {
      origin: { x: 0, y: 0, z: 0 },
      direction: { x: 0, y: 0, z: -1 },
    },
  })),

  Clock: jest.fn(() => ({
    getDelta: jest.fn(() => 0.016),
    getElapsedTime: jest.fn(() => 0),
    start: jest.fn(),
    stop: jest.fn(),
  })),

  // Animation
  AnimationMixer: jest.fn(() => ({
    clipAction: jest.fn(() => ({
      play: jest.fn(),
      stop: jest.fn(),
      setLoop: jest.fn(),
    })),
    update: jest.fn(),
  })),

  // Loaders
  TextureLoader: jest.fn(() => ({
    load: jest.fn((url, onLoad) => {
      if (onLoad) {
        setTimeout(() => onLoad({ 
          image: { width: 256, height: 256 },
          dispose: jest.fn()
        }), 0);
      }
      return { dispose: jest.fn() };
    }),
  })),

  // Controls (for react-three-fiber compatibility)
  OrbitControls: jest.fn(() => ({
    enabled: true,
    enableDamping: false,
    dampingFactor: 0.1,
    update: jest.fn(),
    dispose: jest.fn(),
  })),

  // Constants
  REVISION: '148',
  
  // Math utilities
  MathUtils: {
    degToRad: jest.fn((degrees) => degrees * (Math.PI / 180)),
    radToDeg: jest.fn((radians) => radians * (180 / Math.PI)),
    clamp: jest.fn((value, min, max) => Math.max(min, Math.min(max, value))),
    lerp: jest.fn((x, y, t) => x * (1 - t) + y * t),
  },
};

module.exports = threeMock;