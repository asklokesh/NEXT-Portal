// Virtual mock for @azure/identity
module.exports = {
  DefaultAzureCredential: jest.fn(),
  ClientSecretCredential: jest.fn(),
  ManagedIdentityCredential: jest.fn(),
};
