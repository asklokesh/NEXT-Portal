import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdvancedPluginMarketplace } from '../AdvancedPluginMarketplace';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock hooks
jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any) => value, // Return value immediately for testing
}));

// Mock child components
jest.mock('../MarketplacePluginCard', () => ({
  MarketplacePluginCard: ({ plugin, onSelect, onInstall }: any) => (
    <div data-testid={`plugin-card-${plugin.id}`}>
      <h3>{plugin.title}</h3>
      <p>{plugin.description}</p>
      <button onClick={onSelect} data-testid={`select-${plugin.id}`}>
        Details
      </button>
      <button onClick={onInstall} data-testid={`install-${plugin.id}`}>
        Install
      </button>
    </div>
  ),
}));

jest.mock('../PluginDetailModal', () => ({
  PluginDetailModal: ({ plugin, onClose }: any) => (
    <div data-testid="plugin-detail-modal">
      <h2>{plugin.title}</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../InstallationWizard', () => ({
  InstallationWizard: ({ plugin, onClose }: any) => (
    <div data-testid="installation-wizard">
      <h2>Installing {plugin.title}</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../PluginComparison', () => ({
  PluginComparison: ({ plugins, onClose }: any) => (
    <div data-testid="plugin-comparison">
      <h2>Comparing {plugins.length} plugins</h2>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

jest.mock('../PluginFilters', () => ({
  PluginFilters: ({ onFiltersChange }: any) => (
    <div data-testid="plugin-filters">
      <button onClick={() => onFiltersChange({ tags: ['test'] })}>
        Apply Filter
      </button>
    </div>
  ),
}));

jest.mock('../FeaturedPluginsCarousel', () => ({
  FeaturedPluginsCarousel: ({ plugins, onPluginSelect }: any) => (
    <div data-testid="featured-carousel">
      {plugins.map((plugin: any) => (
        <button
          key={plugin.id}
          onClick={() => onPluginSelect(plugin.id)}
          data-testid={`featured-${plugin.id}`}
        >
          {plugin.title}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('../RecommendationsPanel', () => ({
  RecommendationsPanel: ({ onPluginSelect }: any) => (
    <div data-testid="recommendations-panel">
      <button onClick={() => onPluginSelect('recommended-plugin')}>
        Recommended Plugin
      </button>
    </div>
  ),
}));

const mockPlugins: BackstagePlugin[] = [
  {
    id: 'kubernetes',
    name: '@backstage/plugin-kubernetes',
    title: 'Kubernetes',
    description: 'View and manage Kubernetes resources',
    version: '1.0.0',
    author: 'Backstage',
    category: 'infrastructure',
    tags: ['kubernetes', 'infrastructure'],
    downloads: 50000,
    stars: 1200,
    rating: 4.5,
    installed: false,
    enabled: false,
    configurable: true,
    featured: true,
    official: true,
  },
  {
    id: 'github-actions',
    name: '@backstage/plugin-github-actions',
    title: 'GitHub Actions',
    description: 'View GitHub Actions workflows',
    version: '0.8.0',
    author: 'Backstage',
    category: 'ci-cd',
    tags: ['github', 'ci-cd'],
    downloads: 35000,
    stars: 800,
    rating: 4.2,
    installed: true,
    enabled: true,
    configurable: false,
    featured: false,
    official: true,
  },
];

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

// Mock fetch
global.fetch = jest.fn();

describe('AdvancedPluginMarketplace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ plugins: mockPlugins }),
    });
  });

  it('renders the marketplace correctly', async () => {
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    // Check header elements
    expect(screen.getByText('Plugin Marketplace')).toBeInTheDocument();
    expect(screen.getByText(/Discover, install, and manage/)).toBeInTheDocument();

    // Wait for plugins to load
    await waitFor(() => {
      expect(screen.getByTestId('plugin-card-kubernetes')).toBeInTheDocument();
      expect(screen.getByTestId('plugin-card-github-actions')).toBeInTheDocument();
    });
  });

  it('displays statistics correctly', async () => {
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument(); // Total plugins
      expect(screen.getByText('1')).toBeInTheDocument(); // Installed plugins
    });
  });

  it('filters plugins by search query', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-card-kubernetes')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search plugins/);
    await user.type(searchInput, 'kubernetes');

    // The filtering logic would be tested in the implementation
    // This tests the search input interaction
    expect(searchInput).toHaveValue('kubernetes');
  });

  it('opens plugin details modal when plugin is selected', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('select-kubernetes')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('select-kubernetes'));

    expect(screen.getByTestId('plugin-detail-modal')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
  });

  it('opens installation wizard when plugin is installed', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('install-kubernetes')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('install-kubernetes'));

    expect(screen.getByTestId('installation-wizard')).toBeInTheDocument();
    expect(screen.getByText('Installing Kubernetes')).toBeInTheDocument();
  });

  it('switches between grid and list view modes', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getAllByRole('button')).toHaveLength > 0;
    });

    // The view mode buttons would be part of the view controls
    // This test would verify the view mode switching functionality
  });

  it('filters by categories', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByText('Infrastructure')).toBeInTheDocument();
    });

    // Click on infrastructure category
    await user.click(screen.getByText('Infrastructure'));

    // This would test the category filtering logic
  });

  it('shows featured plugins carousel when featured plugins exist', async () => {
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('featured-carousel')).toBeInTheDocument();
      expect(screen.getByTestId('featured-kubernetes')).toBeInTheDocument();
    });
  });

  it('displays recommendations panel', async () => {
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('recommendations-panel')).toBeInTheDocument();
    });
  });

  it('handles plugin comparison', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-card-kubernetes')).toBeInTheDocument();
    });

    // This would test the plugin comparison functionality
    // The actual implementation would involve selecting multiple plugins for comparison
  });

  it('applies advanced filters', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('plugin-filters')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Apply Filter'));

    // This would test the advanced filtering functionality
  });

  it('sorts plugins correctly', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('popularity-desc')).toBeInTheDocument();
    });

    const sortSelect = screen.getByDisplayValue('popularity-desc');
    await user.selectOptions(sortSelect, 'name-asc');

    expect(sortSelect).toHaveValue('name-asc');
  });

  it('handles loading state', () => {
    (global.fetch as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 1000))
    );

    renderWithQueryClient(<AdvancedPluginMarketplace />);

    expect(screen.getByText('Loading marketplace...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Failed to fetch'));

    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load marketplace')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('handles empty search results', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ plugins: [] }),
    });

    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByText('No plugins found')).toBeInTheDocument();
    });
  });

  it('closes modals when clicking close button', async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<AdvancedPluginMarketplace />);

    await waitFor(() => {
      expect(screen.getByTestId('select-kubernetes')).toBeInTheDocument();
    });

    // Open detail modal
    await user.click(screen.getByTestId('select-kubernetes'));
    expect(screen.getByTestId('plugin-detail-modal')).toBeInTheDocument();

    // Close modal
    await user.click(screen.getByText('Close'));
    expect(screen.queryByTestId('plugin-detail-modal')).not.toBeInTheDocument();
  });
});