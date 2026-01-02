// Virtual mock for @aws-sdk/client-organizations
module.exports = {
  OrganizationsClient: jest.fn(),
  ListAccountsCommand: jest.fn(),
  DescribeOrganizationCommand: jest.fn(),
};
