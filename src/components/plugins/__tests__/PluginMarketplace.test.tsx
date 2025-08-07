import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PluginMarketplace } from '../PluginMarketplace';
import * as pluginService from '@/lib/plugins/marketplace-service';

// Mock the plugin service
jest.mock('@/lib/plugins/marketplace-service');
const mockPluginService = pluginService as jest.Mocked<typeof pluginService>;

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

// Test data
const mockPlugins = [
  {
    id: 'plugin-1',
    name: 'API Documentation',
    version: '1.2.0',
    description: 'Generate and view API documentation',
    author: 'Backstage Team',
    category: 'Documentation',
    tags: ['api', 'docs', 'swagger'],
    icon: 'file-text',
    status: 'available',
    downloadCount: 1500,
    rating: 4.5,
    reviews: 25,
    compatibility: ['1.20.0', '1.21.0', '1.22.0'],
    dependencies: [],
    screenshots: ['screenshot1.png'],
    lastUpdated: '2024-01-15T10:00:00Z',
    size: '2.1 MB',
    license: 'Apache-2.0',
    homepage: 'https://example.com/plugin-1',
    repository: 'https://github.com/example/plugin-1',
    documentation: 'https://docs.example.com/plugin-1',
    config: {
      required: false,
      schema: {
        type: 'object',
        properties: {
          apiUrl: { type: 'string' },
        },
      },
    },
  },
  {
    id: 'plugin-2',
    name: 'Service Monitor',
    version: '2.0.1',
    description: 'Monitor service health and performance',
    author: 'Monitoring Team',
    category: 'Monitoring',
    tags: ['monitoring', 'health', 'performance'],
    icon: 'activity',
    status: 'installed',
    downloadCount: 3200,
    rating: 4.8,
    reviews: 50,
    compatibility: ['1.21.0', '1.22.0'],
    dependencies: ['plugin-1'],
    screenshots: ['screenshot2.png'],
    lastUpdated: '2024-01-10T15:30:00Z',
    size: '5.7 MB',
    license: 'MIT',
    homepage: 'https://example.com/plugin-2',
    repository: 'https://github.com/example/plugin-2',
    documentation: 'https://docs.example.com/plugin-2',
    config: {
      required: true,
      schema: {
        type: 'object',
        properties: {
          monitoringUrl: { type: 'string', format: 'uri' },
          alertThreshold: { type: 'number', minimum: 0, maximum: 100 },
        },
        required: ['monitoringUrl'],
      },
    },
  },
];

describe('PluginMarketplace', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    user = userEvent.setup();
    
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default mock implementations
    mockPluginService.searchPlugins.mockResolvedValue({
      plugins: mockPlugins,
      total: mockPlugins.length,
      page: 1,
      limit: 20,
    });
    
    mockPluginService.getPluginCategories.mockResolvedValue([
      'Documentation',
      'Monitoring',
      'Security',
      'CI/CD',
    ]);
  });

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <PluginMarketplace {...props} />
      </QueryClientProvider>
    );
  };

  describe('Initial Rendering', () => {
    it('should render the marketplace with search and filters', async () => {
      renderComponent();

      // Check main elements are present
      expect(screen.getByPlaceholderText(/search plugins/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /all categories/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /all statuses/i })).toBeInTheDocument();
      
      // Wait for plugins to load
      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
        expect(screen.getByText('Service Monitor')).toBeInTheDocument();
      });
    });

    it('should display plugin cards with correct information', async () => {
      renderComponent();

      await waitFor(() => {
        const apiDocPlugin = screen.getByTestId('plugin-card-plugin-1');
        
        within(apiDocPlugin).getByText('API Documentation');
        within(apiDocPlugin).getByText('v1.2.0');
        within(apiDocPlugin).getByText('Generate and view API documentation');
        within(apiDocPlugin).getByText('Backstage Team');
        within(apiDocPlugin).getByText('Documentation');
        within(apiDocPlugin).getByText('1.5K downloads');
        within(apiDocPlugin).getByText('4.5');
      });
    });

    it('should show installed badge for installed plugins', async () => {
      renderComponent();

      await waitFor(() => {
        const installedPlugin = screen.getByTestId('plugin-card-plugin-2');
        expect(within(installedPlugin).getByText('Installed')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter plugins when searching', async () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search plugins/i);
      await user.type(searchInput, 'API');

      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            query: 'API',
          })
        );
      });
    });

    it('should debounce search input', async () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search plugins/i);
      
      // Type quickly
      await user.type(searchInput, 'test');
      
      // Should only call once after debounce
      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledTimes(2); // Initial load + search
      }, { timeout: 1000 });
    });

    it('should clear search when clear button is clicked', async () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search plugins/i);
      await user.type(searchInput, 'test query');

      const clearButton = screen.getByRole('button', { name: /clear search/i });
      await user.click(clearButton);

      expect(searchInput).toHaveValue('');
    });
  });

  describe('Category Filtering', () => {
    it('should filter plugins by category', async () => {
      renderComponent();

      const categoryFilter = screen.getByRole('button', { name: /all categories/i });
      await user.click(categoryFilter);

      const documentationOption = screen.getByRole('option', { name: /documentation/i });
      await user.click(documentationOption);

      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'Documentation',
          })
        );
      });
    });

    it('should show category counts in dropdown', async () => {
      mockPluginService.getPluginCategories.mockResolvedValue([
        { name: 'Documentation', count: 5 },
        { name: 'Monitoring', count: 3 },
        { name: 'Security', count: 8 },
      ]);

      renderComponent();

      const categoryFilter = screen.getByRole('button', { name: /all categories/i });
      await user.click(categoryFilter);

      await waitFor(() => {
        expect(screen.getByText('Documentation (5)')).toBeInTheDocument();
        expect(screen.getByText('Monitoring (3)')).toBeInTheDocument();
        expect(screen.getByText('Security (8)')).toBeInTheDocument();
      });
    });
  });

  describe('Status Filtering', () => {
    it('should filter plugins by installation status', async () => {
      renderComponent();

      const statusFilter = screen.getByRole('button', { name: /all statuses/i });
      await user.click(statusFilter);

      const installedOption = screen.getByRole('option', { name: /installed/i });
      await user.click(installedOption);

      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'installed',
          })
        );
      });
    });
  });

  describe('Sorting', () => {
    it('should sort plugins by different criteria', async () => {
      renderComponent();

      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      await user.selectOptions(sortSelect, 'rating');

      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'rating',
            sortOrder: 'desc',
          })
        );
      });
    });

    it('should toggle sort order when same criteria is selected', async () => {
      renderComponent();

      const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
      
      // First selection - should be desc
      await user.selectOptions(sortSelect, 'name');
      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'name',
            sortOrder: 'desc',
          })
        );
      });

      // Second selection of same criteria - should be asc
      await user.selectOptions(sortSelect, 'name');
      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            sortBy: 'name',
            sortOrder: 'asc',
          })
        );
      });
    });
  });

  describe('Plugin Installation', () => {
    it('should handle plugin installation', async () => {
      mockPluginService.installPlugin.mockResolvedValue({
        success: true,
        message: 'Plugin installed successfully',
      });

      renderComponent();

      await waitFor(() => {
        const installButton = screen.getByTestId('install-plugin-plugin-1');
        expect(installButton).toBeInTheDocument();
      });

      const installButton = screen.getByTestId('install-plugin-plugin-1');
      await user.click(installButton);

      await waitFor(() => {
        expect(mockPluginService.installPlugin).toHaveBeenCalledWith('plugin-1');
      });
    });

    it('should show loading state during installation', async () => {
      let resolveInstallation: (value: any) => void;
      const installationPromise = new Promise((resolve) => {
        resolveInstallation = resolve;
      });
      
      mockPluginService.installPlugin.mockReturnValue(installationPromise);

      renderComponent();

      await waitFor(() => {
        const installButton = screen.getByTestId('install-plugin-plugin-1');
        expect(installButton).toBeInTheDocument();
      });

      const installButton = screen.getByTestId('install-plugin-plugin-1');
      await user.click(installButton);

      // Should show loading state
      expect(screen.getByText(/installing/i)).toBeInTheDocument();
      expect(installButton).toBeDisabled();

      // Resolve the installation
      resolveInstallation!({ success: true, message: 'Installed' });

      await waitFor(() => {
        expect(screen.queryByText(/installing/i)).not.toBeInTheDocument();
      });
    });

    it('should handle installation errors', async () => {
      mockPluginService.installPlugin.mockRejectedValue(
        new Error('Installation failed')
      );

      renderComponent();

      await waitFor(() => {
        const installButton = screen.getByTestId('install-plugin-plugin-1');
        expect(installButton).toBeInTheDocument();
      });

      const installButton = screen.getByTestId('install-plugin-plugin-1');
      await user.click(installButton);

      await waitFor(() => {
        expect(screen.getByText(/installation failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Plugin Details Modal', () => {
    it('should open details modal when plugin card is clicked', async () => {
      mockPluginService.getPluginDetails.mockResolvedValue(mockPlugins[0]);

      renderComponent();

      await waitFor(() => {
        const pluginCard = screen.getByTestId('plugin-card-plugin-1');
        expect(pluginCard).toBeInTheDocument();
      });

      const pluginCard = screen.getByTestId('plugin-card-plugin-1');
      await user.click(pluginCard);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByText('Plugin Details')).toBeInTheDocument();
      });

      expect(mockPluginService.getPluginDetails).toHaveBeenCalledWith('plugin-1');
    });

    it('should close details modal when close button is clicked', async () => {
      mockPluginService.getPluginDetails.mockResolvedValue(mockPlugins[0]);

      renderComponent();

      // Open modal
      const pluginCard = screen.getByTestId('plugin-card-plugin-1');
      await user.click(pluginCard);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Close modal
      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('View Mode Toggle', () => {
    it('should switch between grid and list view', async () => {
      renderComponent();

      // Should start in grid view
      expect(screen.getByTestId('plugin-grid-view')).toBeInTheDocument();

      // Switch to list view
      const listViewButton = screen.getByRole('button', { name: /list view/i });
      await user.click(listViewButton);

      expect(screen.getByTestId('plugin-list-view')).toBeInTheDocument();
      expect(screen.queryByTestId('plugin-grid-view')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('should handle pagination', async () => {
      mockPluginService.searchPlugins.mockResolvedValue({
        plugins: mockPlugins,
        total: 50,
        page: 1,
        limit: 20,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('1-20 of 50')).toBeInTheDocument();
      });

      const nextButton = screen.getByRole('button', { name: /next page/i });
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockPluginService.searchPlugins).toHaveBeenCalledWith(
          expect.objectContaining({
            page: 2,
          })
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle search errors gracefully', async () => {
      mockPluginService.searchPlugins.mockRejectedValue(
        new Error('Search failed')
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/failed to load plugins/i)).toBeInTheDocument();
      });
    });

    it('should show retry option when search fails', async () => {
      mockPluginService.searchPlugins.mockRejectedValueOnce(
        new Error('Search failed')
      ).mockResolvedValueOnce({
        plugins: mockPlugins,
        total: mockPlugins.length,
        page: 1,
        limit: 20,
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/failed to load plugins/i)).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', async () => {
      renderComponent();

      expect(screen.getByRole('search')).toHaveAccessibleName(/search plugins/i);
      expect(screen.getByRole('combobox', { name: /category filter/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /status filter/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', async () => {
      renderComponent();

      const searchInput = screen.getByPlaceholderText(/search plugins/i);
      searchInput.focus();
      
      // Tab should move to category filter
      await user.tab();
      expect(screen.getByRole('button', { name: /all categories/i })).toHaveFocus();

      // Tab should move to status filter
      await user.tab();
      expect(screen.getByRole('button', { name: /all statuses/i })).toHaveFocus();
    });
  });

  describe('Performance', () => {
    it('should memoize expensive calculations', async () => {
      const { rerender } = renderComponent();

      await waitFor(() => {
        expect(screen.getByText('API Documentation')).toBeInTheDocument();
      });

      // Rerender with same props - should not re-fetch
      rerender(
        <QueryClientProvider client={queryClient}>
          <PluginMarketplace />
        </QueryClientProvider>
      );

      // Should still show plugins but not make additional API calls
      expect(screen.getByText('API Documentation')).toBeInTheDocument();
      expect(mockPluginService.searchPlugins).toHaveBeenCalledTimes(1);
    });

    it('should virtualize plugin list for large datasets', async () => {
      const manyPlugins = Array.from({ length: 1000 }, (_, i) => ({
        ...mockPlugins[0],
        id: `plugin-${i}`,
        name: `Plugin ${i}`,
      }));

      mockPluginService.searchPlugins.mockResolvedValue({
        plugins: manyPlugins,
        total: 1000,
        page: 1,
        limit: 1000,
      });

      renderComponent({ virtualizeThreshold: 100 });

      await waitFor(() => {
        // Should only render visible items
        const renderedPlugins = screen.getAllByTestId(/^plugin-card-/);
        expect(renderedPlugins.length).toBeLessThan(1000);
      });
    });
  });
});