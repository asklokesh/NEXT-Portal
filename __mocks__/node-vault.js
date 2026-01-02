// Virtual mock for node-vault
const mockVault = jest.fn(() => ({
  health: jest.fn().mockResolvedValue({ sealed: false, initialized: true }),
  read: jest.fn().mockResolvedValue({ data: {} }),
  write: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
  list: jest.fn().mockResolvedValue({ data: { keys: [] } }),
  seal: jest.fn().mockResolvedValue({}),
  unseal: jest.fn().mockResolvedValue({}),
  generateDatabaseCredentials: jest.fn().mockResolvedValue({ data: {} }),
  tokenLookupSelf: jest.fn().mockResolvedValue({ data: {} }),
  tokenRenewSelf: jest.fn().mockResolvedValue({}),
  status: jest.fn().mockResolvedValue({ sealed: false }),
  initialized: jest.fn().mockResolvedValue({ initialized: true }),
}));

module.exports = mockVault;
module.exports.default = mockVault;
