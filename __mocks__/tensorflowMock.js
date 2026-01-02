// Mock TensorFlow.js for Jest testing
// Helper function to create tensor mock without circular reference
const createTensorMock = (data, shape, dtype) => ({
  shape: shape || [data?.length || 1],
  dtype: dtype || 'float32',
  data: jest.fn().mockResolvedValue(new Float32Array(Array.isArray(data) ? data : [data])),
  dataSync: jest.fn(() => new Float32Array(Array.isArray(data) ? data : [data])),
  dispose: jest.fn(),
  print: jest.fn(),
  reshape: jest.fn(function() { return createTensorMock(data); }),
  expandDims: jest.fn(function() { return createTensorMock(data); }),
  squeeze: jest.fn(function() { return createTensorMock(data); }),
  cast: jest.fn(function() { return createTensorMock(data); }),
  clone: jest.fn(function() { return createTensorMock(data); }),
});

const tensorflowMock = {
  // Core tensor operations
  tensor: jest.fn((data, shape, dtype) => createTensorMock(data, shape, dtype)),

  tensor1d: jest.fn((values, dtype) => createTensorMock(values, [values.length], dtype)),
  tensor2d: jest.fn((values, shape, dtype) => createTensorMock(values, shape, dtype)),
  tensor3d: jest.fn((values, shape, dtype) => createTensorMock(values, shape, dtype)),
  tensor4d: jest.fn((values, shape, dtype) => createTensorMock(values, shape, dtype)),

  // Mathematical operations
  add: jest.fn(() => createTensorMock([1, 2, 3])),
  sub: jest.fn(() => createTensorMock([1, 2, 3])),
  mul: jest.fn(() => createTensorMock([1, 2, 3])),
  div: jest.fn(() => createTensorMock([1, 2, 3])),
  matMul: jest.fn(() => createTensorMock([1, 2, 3])),
  dot: jest.fn(() => createTensorMock([1, 2, 3])),

  // Activation functions
  relu: jest.fn(() => createTensorMock([1, 2, 3])),
  sigmoid: jest.fn(() => createTensorMock([0.5, 0.7, 0.9])),
  softmax: jest.fn(() => createTensorMock([0.3, 0.3, 0.4])),
  tanh: jest.fn(() => createTensorMock([0.1, 0.2, 0.3])),

  // Loss functions
  losses: {
    meanSquaredError: jest.fn(() => createTensorMock([0.1])),
    categoricalCrossentropy: jest.fn(() => createTensorMock([0.2])),
    sparseCategoricalCrossentropy: jest.fn(() => createTensorMock([0.15])),
  },

  // Optimizers
  train: {
    adam: jest.fn(() => ({
      minimize: jest.fn(),
      computeGradients: jest.fn(() => ({})),
      applyGradients: jest.fn(),
    })),
    sgd: jest.fn(() => ({
      minimize: jest.fn(),
      computeGradients: jest.fn(() => ({})),
      applyGradients: jest.fn(),
    })),
  },

  // Models
  sequential: jest.fn(() => ({
    add: jest.fn(),
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({
      history: {
        loss: [0.5, 0.3, 0.1],
        acc: [0.6, 0.8, 0.9],
      },
    }),
    predict: jest.fn(() => createTensorMock([0.8, 0.2])),
    evaluate: jest.fn().mockResolvedValue([createTensorMock([0.1]), createTensorMock([0.9])]),
    save: jest.fn().mockResolvedValue({}),
    summary: jest.fn(),
    getWeights: jest.fn(() => []),
    setWeights: jest.fn(),
    layers: [],
  })),

  model: jest.fn(() => ({
    compile: jest.fn(),
    fit: jest.fn().mockResolvedValue({
      history: {
        loss: [0.5, 0.3, 0.1],
        acc: [0.6, 0.8, 0.9],
      },
    }),
    predict: jest.fn(() => createTensorMock([0.8, 0.2])),
    evaluate: jest.fn().mockResolvedValue([createTensorMock([0.1]), createTensorMock([0.9])]),
    save: jest.fn().mockResolvedValue({}),
    summary: jest.fn(),
    getWeights: jest.fn(() => []),
    setWeights: jest.fn(),
    inputs: [],
    outputs: [],
  })),

  // Model loading
  loadLayersModel: jest.fn().mockResolvedValue({
    predict: jest.fn(() => createTensorMock([0.8, 0.2])),
    evaluate: jest.fn().mockResolvedValue([createTensorMock([0.1])]),
  }),

  // Layers
  layers: {
    dense: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
      getWeights: jest.fn(() => []),
      setWeights: jest.fn(),
      units: 10,
      activation: 'relu',
    })),
    conv2d: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
      getWeights: jest.fn(() => []),
      setWeights: jest.fn(),
      filters: 32,
      kernelSize: [3, 3],
    })),
    maxPooling2d: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
      poolSize: [2, 2],
    })),
    flatten: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
    })),
    dropout: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
      rate: 0.2,
    })),
    embedding: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
      inputDim: 1000,
      outputDim: 64,
    })),
    lstm: jest.fn(() => ({
      apply: jest.fn(() => createTensorMock([1, 2, 3])),
      units: 50,
    })),
  },

  // Data operations
  data: {
    array: jest.fn(() => ({
      batch: jest.fn(() => ({})),
      map: jest.fn(() => ({})),
      take: jest.fn(() => ({})),
      skip: jest.fn(() => ({})),
      shuffle: jest.fn(() => ({})),
      repeat: jest.fn(() => ({})),
      forEachAsync: jest.fn().mockResolvedValue({}),
    })),
    csv: jest.fn(() => ({
      batch: jest.fn(() => ({})),
      map: jest.fn(() => ({})),
      columnNames: jest.fn().mockResolvedValue(['col1', 'col2']),
    })),
    generator: jest.fn(() => ({})),
  },

  // Utilities
  ready: jest.fn().mockResolvedValue({}),
  dispose: jest.fn(),
  memory: jest.fn(() => ({ numTensors: 0, numDataBuffers: 0, numBytes: 0 })),
  tidy: jest.fn((fn) => fn()),
  keep: jest.fn((tensor) => tensor),

  // Backend operations
  backend: jest.fn(() => 'cpu'),
  setBackend: jest.fn().mockResolvedValue({}),

  // Random operations
  randomNormal: jest.fn(() => createTensorMock([0.1, 0.2, 0.3])),
  randomUniform: jest.fn(() => createTensorMock([0.4, 0.5, 0.6])),
  truncatedNormal: jest.fn(() => createTensorMock([0.1, 0.2, 0.3])),

  // Utility functions for testing
  zeros: jest.fn((shape) => createTensorMock(new Array(shape.reduce((a, b) => a * b, 1)).fill(0))),
  ones: jest.fn((shape) => createTensorMock(new Array(shape.reduce((a, b) => a * b, 1)).fill(1))),
  eye: jest.fn(() => createTensorMock([1, 0, 0, 1])),

  // Image operations
  image: {
    resizeBilinear: jest.fn(() => createTensorMock([1, 2, 3])),
    resizeNearestNeighbor: jest.fn(() => createTensorMock([1, 2, 3])),
  },

  // Version info
  version: {
    'tfjs-core': '4.15.0',
    'tfjs': '4.15.0',
  },
};

// Add aliases for common operations
tensorflowMock.tf = tensorflowMock;

module.exports = tensorflowMock;