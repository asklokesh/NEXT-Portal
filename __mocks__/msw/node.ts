// Mock for msw/node module
export const setupServer = jest.fn(() => ({
  listen: jest.fn(),
  close: jest.fn(),
  resetHandlers: jest.fn(),
  use: jest.fn(),
}));
