// Mock for discord.js
class Client {
  constructor() {
    this.user = { tag: 'MockBot#0000' };
    this.channels = {
      fetch: jest.fn().mockResolvedValue({
        send: jest.fn().mockResolvedValue({ id: '123456789' }),
      }),
    };
    this.users = {
      fetch: jest.fn().mockResolvedValue({ send: jest.fn() }),
    };
  }

  login() {
    return Promise.resolve('token');
  }

  on() {
    return this;
  }

  destroy() {
    return Promise.resolve();
  }
}

const GatewayIntentBits = {
  Guilds: 1,
  GuildMessages: 2,
  MessageContent: 4,
  DirectMessages: 8,
};

const Events = {
  ClientReady: 'ready',
  MessageCreate: 'messageCreate',
};

module.exports = { Client, GatewayIntentBits, Events };
