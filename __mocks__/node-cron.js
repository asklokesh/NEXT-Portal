// Mock for node-cron module
const mockTask = {
  start: jest.fn(),
  stop: jest.fn(),
  destroy: jest.fn(),
};

module.exports = {
  schedule: jest.fn(() => mockTask),
  validate: jest.fn(() => true),
  getTasks: jest.fn(() => new Map()),
};
