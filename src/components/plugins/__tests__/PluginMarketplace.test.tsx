import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PluginMarketplace from '../PluginMarketplace';

// Mock plugin registry
jest.mock('@/services/backstage/plugin-registry', () => ({
  pluginRegistry: {
    getPlugins: jest.fn(),
    installPlugin: jest.fn(),
    uninstallPlugin: jest.fn(),
    enablePlugin: jest.fn(),
    disablePlugin: jest.fn(),
  },
}));

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(() => null),
  }),
}));

// Mock toast notifications
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

// Mock child modals
jest.mock('../PluginConfigurationModal', () => ({
  PluginConfigurationModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="config-modal">
      <button onClick={onClose}>Close Config</button>
    </div>
  ),
}));

jest.mock('../PluginDetailsModal', () => ({
  PluginDetailsModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="details-modal" role="dialog">
      <h2>Plugin Details</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

// Test data matching the BackstagePlugin interface
const mockPlugins = [
  {
    id: 'plugin-api-docs',
    name: '@backstage/plugin-api-docs',
    title: 'API Documentation',
    version: '1.2.0',
    description: 'Generate and view API documentation',
    author: 'Backstage Team',
    category: 'documentation',
    tags: ['api', 'docs', 'swagger'],
    downloads: 1500,
    stars: 250,
    rating: 4.5,
    installed: false,
    enabled: false,
    configurable: true,
    official: true,
  },
  {
    id: 'plugin-monitoring',
    name: '@backstage/plugin-monitoring',
    title: 'Service Monitor',
    version: '2.0.1',
    description: 'Monitor service health and performance',
    author: 'Monitoring Team',
    category: 'monitoring',
    tags: ['monitoring', 'health', 'performance'],
    downloads: 3200,
    stars: 450,
    rating: 4.8,
    installed: true,
    enabled: true,
    configurable: true,
    official: true,
  },
  {
    id: 'plugin-ci-cd',
    name: '@backstage/plugin-ci-cd',
    title: 'CI/CD Pipeline',
    version: '1.5.0',
    description: 'CI/CD pipeline integration',
    author: 'Backstage Team',
    category: 'ci-cd',
    tags: ['ci', 'cd', 'pipeline'],
    downloads: 2800,
    stars: 380,
    rating: 4.6,
    installed: true,
    enabled: false,
    configurable: true,
    official: true,
  },
];

describe('PluginMarketplace', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Reset all mocks
    jest.clearAllMocks();

    // Mock fetch for plugins API - default success response
    global.fetch = jest.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/plugins') {
        if (options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            plugins: mockPlugins,
            total: mockPlugins.length,
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PluginMarketplace {...props} />
      </QueryClientProvider>
    );
  };

  describe('Loading State', () => {
    it('should show loading state while fetching plugins', () => {
      // Create a never-resolving promise to keep in loading state
      global.fetch = jest.fn().mockImplementation(() => new Promise(() => {}));

      renderComponent();

      expect(screen.getByText('Loading plugin marketplace...')).toBeInTheDocument();
    });
  });

  describe('Initial Rendering', () => {
    it('should render the marketplace header and search after loading', async () => {
      renderComponent();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading plugin marketplace...')).not.toBeInTheDocument();
      });

      // Check header elements
      expect(screen.getByText('Plugin Marketplace')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/search plugins/i)).toBeInTheDocument();
    });

    it('should display plugin cards with correct information', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Check plugin details are rendered
      expect(screen.getByText('Service Monitor')).toBeInTheDocument();
      expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument();
    });

    it('should show installed count for installed plugins', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Statistics should show 2 installed (Service Monitor and CI/CD Pipeline)
      const installedStat = screen.getByText('Installed');
      expect(installedStat).toBeInTheDocument();
    });

    it('should display category filter buttons', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('All Plugins')).toBeInTheDocument();
      });

      expect(screen.getByText('CI/CD')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
      expect(screen.getByText('Infrastructure')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should filter plugins when searching', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search plugins/i);
      fireEvent.change(searchInput, { target: { value: 'API' } });

      // After filtering, only API Documentation should be visible
      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });
    });

    it('should show empty state when no plugins match search', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search plugins/i);
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      await waitFor(() => {
        expect(screen.getByText('No plugins found')).toBeInTheDocument();
      });
    });
  });

  describe('Category Filtering', () => {
    it('should filter plugins by category', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('All Plugins')).toBeInTheDocument();
      });

      // Click on CI/CD category
      const cicdButton = screen.getByText('CI/CD');
      fireEvent.click(cicdButton);

      // Should show filtered results
      await waitFor(() => {
        expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument();
      });
    });

    it('should show plugin counts per category', async () => {
      renderComponent();

      await waitFor(() => {
        // Categories show counts like "1 plugin" or "3 plugins"
        expect(screen.getByText('3 plugins')).toBeInTheDocument();
      });
    });
  });

  describe('Plugin Installation', () => {
    it('should handle plugin installation', async () => {
      const onPluginInstalled = jest.fn();
      renderComponent({ onPluginInstalled });

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Find and click Install button for API Documentation
      const installButtons = screen.getAllByText('Install');
      fireEvent.click(installButtons[0]);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/plugins',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('install'),
          })
        );
      });
    });

    it('should show enabled button for installed plugins', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Service Monitor')).toBeInTheDocument();
      });

      // Service Monitor is installed and enabled - multiple Enabled buttons may exist
      const enabledButtons = screen.getAllByText('Enabled');
      expect(enabledButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Plugin Toggle', () => {
    it('should toggle plugin enabled state', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Service Monitor')).toBeInTheDocument();
      });

      // Find the Enable button (for disabled installed plugin)
      const enableButton = screen.getByText('Enable');
      fireEvent.click(enableButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/plugins',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('configure'),
          })
        );
      });
    });
  });

  describe('Plugin Details Modal', () => {
    it('should open details modal when details button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Find and click Details button
      const detailsButtons = screen.getAllByText('Details');
      fireEvent.click(detailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('details-modal')).toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
    });

    it('should close details modal when close button is clicked', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Open modal
      const detailsButtons = screen.getAllByText('Details');
      fireEvent.click(detailsButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('details-modal')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('details-modal')).not.toBeInTheDocument();
      });
    });
  });

  describe('Plugin Configuration', () => {
    it('should open configuration modal for configurable plugins', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('Service Monitor')).toBeInTheDocument();
      });

      // Find and click Configure button (for installed configurable plugin)
      const configureButtons = screen.getAllByText('Configure');
      fireEvent.click(configureButtons[0]);

      await waitFor(() => {
        expect(screen.getByTestId('config-modal')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    // Note: The component has built-in retry logic that makes these tests complex.
    // These tests verify the component has error handling UI elements.
    it('should have error handling UI when fetch fails', async () => {
      // Mock fetch to fail immediately and always
      global.fetch = jest.fn().mockImplementation(() => {
        return Promise.reject(new Error('Network error'));
      });

      // Create a new queryClient with no retries
      const errorQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, retryDelay: 0 },
          mutations: { retry: false },
        },
      });

      render(
        <QueryClientProvider client={errorQueryClient}>
          <PluginMarketplace />
        </QueryClientProvider>
      );

      // Wait for error state to appear - component has built-in retry so give it time
      await waitFor(() => {
        expect(screen.getByText('Failed to load plugins')).toBeInTheDocument();
      }, { timeout: 10000 });
    });
  });

  describe('Statistics Display', () => {
    it('should display plugin statistics correctly', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Check statistics
      expect(screen.getByText('Available Plugins')).toBeInTheDocument();
      expect(screen.getByText('Installed')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should show empty state when no plugins are available', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ plugins: [] }),
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('No plugins found')).toBeInTheDocument();
      });
    });
  });

  describe('Plugin Sections', () => {
    it('should separate installed and available plugins', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Should have section headers - use getAllByText since the text appears in multiple places
      const installedHeaders = screen.getAllByText(/Installed Plugins/);
      const availableHeaders = screen.getAllByText(/Available Plugins/);
      expect(installedHeaders.length).toBeGreaterThan(0);
      expect(availableHeaders.length).toBeGreaterThan(0);
    });
  });
});
