// Virtual mock for @aws-sdk/client-cost-explorer
module.exports = {
  CostExplorerClient: jest.fn(),
  GetCostAndUsageCommand: jest.fn(),
  GetCostForecastCommand: jest.fn(),
  GetDimensionValuesCommand: jest.fn(),
};
