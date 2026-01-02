/**
 * Jest polyfills - runs before the test environment is set up
 * This is needed for Next.js API route testing which requires Request/Response
 */

const { TextEncoder, TextDecoder } = require('util');

// Text encoding polyfills
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// BroadcastChannel polyfill for MSW
class BroadcastChannelPolyfill {
  constructor(name) {
    this.name = name;
    this.listeners = [];
  }
  postMessage(message) {
    this.listeners.forEach(listener => listener({ data: message }));
  }
  addEventListener(type, listener) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }
  removeEventListener(type, listener) {
    if (type === 'message') {
      this.listeners = this.listeners.filter(l => l !== listener);
    }
  }
  close() {
    this.listeners = [];
  }
}
global.BroadcastChannel = BroadcastChannelPolyfill;

// URL polyfill (usually available in Node.js but ensure it's global)
const { URL, URLSearchParams } = require('url');
global.URL = URL;
global.URLSearchParams = URLSearchParams;

// Blob polyfill
const { Blob } = require('buffer');
global.Blob = Blob;

// ReadableStream polyfill - must be before undici
const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
global.ReadableStream = ReadableStream;
global.WritableStream = WritableStream;
global.TransformStream = TransformStream;

// Web API polyfills for Next.js API routes
// These need to be available before NextRequest/NextResponse are imported
const { Request, Response, Headers, FormData, fetch } = require('undici');
global.Request = Request;
global.Response = Response;
global.Headers = Headers;
global.FormData = FormData;

// Also polyfill fetch since undici provides it
if (typeof global.fetch === 'undefined') {
  global.fetch = fetch;
}
