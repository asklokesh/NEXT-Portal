// Mock Socket.IO client for Jest testing
const socketIOMock = {
  io: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    connected: true,
    disconnected: false,
    id: 'mock-socket-id',
    
    // Event emitter simulation for tests
    _events: {},
    _emit: jest.fn(function(event, ...args) {
      if (this._events[event]) {
        this._events[event].forEach(callback => callback(...args));
      }
    }),
    
    // Helper methods for testing
    simulateConnect: jest.fn(function() {
      this.connected = true;
      this.disconnected = false;
      this._emit('connect');
    }),
    
    simulateDisconnect: jest.fn(function() {
      this.connected = false;
      this.disconnected = true;
      this._emit('disconnect');
    }),
    
    simulateEvent: jest.fn(function(event, data) {
      this._emit(event, data);
    }),
    
    // Connection state
    auth: {},
    recovered: false,
    
    // Binary support
    binary: jest.fn(() => ({
      emit: jest.fn(),
    })),
    
    // Compression
    compress: jest.fn(() => ({
      emit: jest.fn(),
    })),
    
    // Volatile
    volatile: {
      emit: jest.fn(),
    },
    
    // Timeout
    timeout: jest.fn(() => ({
      emit: jest.fn(),
    })),
  })),

  // Manager mock
  Manager: jest.fn(() => ({
    open: jest.fn(),
    close: jest.fn(),
    socket: jest.fn(),
    reconnection: jest.fn(),
    reconnectionAttempts: jest.fn(),
    reconnectionDelay: jest.fn(),
    reconnectionDelayMax: jest.fn(),
    randomizationFactor: jest.fn(),
    timeout: jest.fn(),
    autoConnect: jest.fn(),
    _reconnection: true,
    _reconnectionAttempts: 5,
    _reconnectionDelay: 1000,
    _reconnectionDelayMax: 5000,
    _randomizationFactor: 0.5,
    _timeout: 20000,
    _autoConnect: true,
  })),

  // Socket mock class
  Socket: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    once: jest.fn(),
    removeAllListeners: jest.fn(),
    send: jest.fn(),
    connected: true,
    disconnected: false,
    id: 'mock-socket-id',
    nsp: '/',
    
    // Custom events storage for testing
    _events: {},
    
    // Simulate events for testing
    simulateEvent: jest.fn(function(event, data) {
      if (this._events[event]) {
        this._events[event].forEach(callback => callback(data));
      }
    }),
  })),
};

// Create a default socket instance
const mockSocket = socketIOMock.io();

// Override the on method to store event listeners for testing
mockSocket.on = jest.fn((event, callback) => {
  if (!mockSocket._events[event]) {
    mockSocket._events[event] = [];
  }
  mockSocket._events[event].push(callback);
});

// Override the off method to remove event listeners
mockSocket.off = jest.fn((event, callback) => {
  if (mockSocket._events[event]) {
    const index = mockSocket._events[event].indexOf(callback);
    if (index > -1) {
      mockSocket._events[event].splice(index, 1);
    }
  }
});

// Make io function return the same mock socket instance
socketIOMock.io.mockReturnValue(mockSocket);

// Export both the default export and named exports
module.exports = socketIOMock.io;
module.exports.io = socketIOMock.io;
module.exports.Manager = socketIOMock.Manager;
module.exports.Socket = socketIOMock.Socket;
module.exports.mockSocket = mockSocket;