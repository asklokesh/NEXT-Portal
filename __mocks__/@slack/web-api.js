// Mock for @slack/web-api
const mockWebClient = {
  chat: {
    postMessage: jest.fn().mockResolvedValue({ ok: true, ts: '1234567890.123456' }),
    update: jest.fn().mockResolvedValue({ ok: true }),
    delete: jest.fn().mockResolvedValue({ ok: true }),
  },
  conversations: {
    list: jest.fn().mockResolvedValue({ ok: true, channels: [] }),
    info: jest.fn().mockResolvedValue({ ok: true, channel: {} }),
    members: jest.fn().mockResolvedValue({ ok: true, members: [] }),
  },
  users: {
    list: jest.fn().mockResolvedValue({ ok: true, members: [] }),
    info: jest.fn().mockResolvedValue({ ok: true, user: {} }),
  },
  files: {
    upload: jest.fn().mockResolvedValue({ ok: true, file: {} }),
  },
};

class WebClient {
  constructor() {
    Object.assign(this, mockWebClient);
  }
}

module.exports = { WebClient };
