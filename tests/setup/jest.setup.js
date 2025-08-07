// Jest setup file for global test configuration
const { TextEncoder, TextDecoder } = require('util');

// Polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Only add DOM mocks if window exists (jsdom environment)
if (typeof window !== 'undefined') {
  require('@testing-library/jest-dom');
  require('jest-canvas-mock');
}

// Mock environment variables
process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3000';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock_secret';
process.env.JAEGER_ENDPOINT = 'http://localhost:14268/api/traces';
process.env.PROMETHEUS_URL = 'http://localhost:9090';
process.env.LOKI_URL = 'http://localhost:3100';

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      reload: jest.fn(),
      forward: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
      route: '/',
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
  useParams() {
    return {};
  },
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props) => {
    // eslint-disable-next-line jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock fetch for tests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    blob: () => Promise.resolve(new Blob()),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    formData: () => Promise.resolve(new FormData()),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic',
    url: '',
    clone: () => global.fetch(),
  })
);

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
};

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
};

// Mock window.matchMedia (only if window exists)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock localStorage and sessionStorage for all environments
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
global.localStorage = localStorageMock;

const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock crypto.randomUUID
global.crypto = {
  ...global.crypto,
  randomUUID: jest.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
};

// Suppress console errors in tests (optional)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Warning: useLayoutEffect') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError.call(console, ...args);
  };

  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: useLayoutEffect')
    ) {
      return;
    }
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Mock WebSocket for Socket.IO tests
global.WebSocket = class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  send(data) {
    // Mock send functionality
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) this.onclose();
  }
};

// Mock performance API
global.performance = {
  ...global.performance,
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  now: jest.fn(() => Date.now()),
};

// Mock Web APIs that might be used in components
global.Worker = class MockWorker {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
  }
  
  postMessage(data) {
    // Mock worker message posting
  }
  
  terminate() {
    // Mock worker termination
  }
};

// Mock File API
global.File = class MockFile {
  constructor(parts, filename, options = {}) {
    this.name = filename;
    this.size = parts.reduce((acc, part) => acc + (part.length || 0), 0);
    this.type = options.type || '';
    this.lastModified = options.lastModified || Date.now();
  }
};

global.FileReader = class MockFileReader {
  constructor() {
    this.readyState = 0;
    this.result = null;
    this.error = null;
    this.onload = null;
    this.onerror = null;
    this.onabort = null;
  }
  
  readAsText(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = 'mock file content';
      if (this.onload) this.onload();
    }, 10);
  }
  
  readAsDataURL(file) {
    setTimeout(() => {
      this.readyState = 2;
      this.result = 'data:text/plain;base64,bW9jayBmaWxlIGNvbnRlbnQ=';
      if (this.onload) this.onload();
    }, 10);
  }
  
  abort() {
    this.readyState = 2;
    if (this.onabort) this.onabort();
  }
};

// Mock Clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(),
    readText: jest.fn().mockResolvedValue('mocked clipboard text'),
    write: jest.fn().mockResolvedValue(),
    read: jest.fn().mockResolvedValue([]),
  },
});

// Mock Notification API
global.Notification = class MockNotification {
  constructor(title, options) {
    this.title = title;
    this.body = options?.body;
    this.icon = options?.icon;
    this.onclick = null;
    this.onclose = null;
    this.onshow = null;
    this.onerror = null;
    
    // Simulate showing notification
    setTimeout(() => {
      if (this.onshow) this.onshow();
    }, 10);
  }
  
  static requestPermission() {
    return Promise.resolve('granted');
  }
  
  static permission = 'granted';
  
  close() {
    if (this.onclose) this.onclose();
  }
};

// Custom matchers for plugin testing
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  
  toHaveValidPluginStructure(received) {
    const requiredFields = ['name', 'version', 'description'];
    const hasAllFields = requiredFields.every(field => received.hasOwnProperty(field));
    const hasValidVersion = /^\d+\.\d+\.\d+/.test(received.version);
    
    const pass = hasAllFields && hasValidVersion;
    
    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to have valid plugin structure`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to have valid plugin structure with fields: ${requiredFields.join(', ')} and valid version format`,
        pass: false,
      };
    }
  },
  
  toHaveBeenCalledWithPluginEvent(received, eventType, pluginId) {
    const calls = received.mock.calls;
    const matchingCall = calls.find(call => 
      call[0] === eventType && 
      call[1] && 
      call[1].pluginId === pluginId
    );
    
    if (matchingCall) {
      return {
        message: () => `expected function not to have been called with plugin event ${eventType} for plugin ${pluginId}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected function to have been called with plugin event ${eventType} for plugin ${pluginId}`,
        pass: false,
      };
    }
  }
});

// Global test utilities for plugin testing
global.createMockPlugin = (overrides = {}) => ({
  id: 'test-plugin-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Plugin',
  version: '1.0.0',
  description: 'A test plugin for unit tests',
  author: 'Test Author',
  category: 'Development',
  tags: ['test', 'development'],
  icon: 'package',
  status: 'active',
  dependencies: [],
  config: {},
  ...overrides,
});

global.createMockPluginInstallation = (plugin, overrides = {}) => ({
  pluginId: plugin.id,
  status: 'installed',
  version: plugin.version,
  installedAt: new Date().toISOString(),
  config: {},
  health: 'healthy',
  metrics: {
    uptime: 100,
    errorRate: 0,
    responseTime: 50,
  },
  ...overrides,
});

// Helper for creating mock API responses
global.createMockApiResponse = (data, options = {}) => ({
  ok: options.ok !== false,
  status: options.status || 200,
  statusText: options.statusText || 'OK',
  json: jest.fn().mockResolvedValue(data),
  text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  headers: new Headers(options.headers || {}),
  ...options,
});

// Test database cleanup utilities
global.cleanupTestDb = jest.fn();
global.seedTestDb = jest.fn();