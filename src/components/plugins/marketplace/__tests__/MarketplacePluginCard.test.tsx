import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketplacePluginCard } from '../MarketplacePluginCard';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockPlugin: BackstagePlugin = {
  id: 'kubernetes',
  name: '@backstage/plugin-kubernetes',
  title: 'Kubernetes Plugin',
  description: 'A comprehensive plugin for managing Kubernetes resources in your Backstage application',
  version: '1.2.3',
  author: 'Backstage Team',
  category: 'infrastructure',
  tags: ['kubernetes', 'infrastructure', 'containers'],
  downloads: 15420,
  stars: 892,
  rating: 4.7,
  lastUpdated: '2024-01-15T10:30:00Z',
  installed: false,
  enabled: false,
  configurable: true,
  official: true,
  featured: true,
  repository: 'https://github.com/backstage/backstage',
  homepage: 'https://backstage.io/docs/features/kubernetes',
  npm: 'https://www.npmjs.com/package/@backstage/plugin-kubernetes',
};

const mockInstalledPlugin: BackstagePlugin = {
  ...mockPlugin,
  id: 'installed-plugin',
  installed: true,
  enabled: true,
};

const defaultProps = {
  viewMode: 'grid' as const,
  isInstalling: false,
  isSelected: false,
  showSelectionCheckbox: false,
  onSelect: jest.fn(),
  onToggleSelection: jest.fn(),
  onInstall: jest.fn(),
};

describe('MarketplacePluginCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Grid View', () => {
    it('renders plugin information correctly in grid view', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByText('Kubernetes Plugin')).toBeInTheDocument();
      expect(screen.getByText('v1.2.3 • Backstage Team')).toBeInTheDocument();
      expect(screen.getByText(mockPlugin.description)).toBeInTheDocument();
      // In grid view, downloads and ratings are displayed with separate labels
      expect(screen.getByText('Downloads')).toBeInTheDocument();
      expect(screen.getByText('15.4K')).toBeInTheDocument();
      expect(screen.getByText('Rating')).toBeInTheDocument();
      expect(screen.getByText('4.7')).toBeInTheDocument();
    });

    it('displays tags correctly', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByText('kubernetes')).toBeInTheDocument();
      // 'infrastructure' appears twice: once as category, once as tag - use getAllByText
      expect(screen.getAllByText('infrastructure').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('containers')).toBeInTheDocument();
    });

    it('shows install button for non-installed plugins', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument();
      expect(screen.queryByText('Installed')).not.toBeInTheDocument();
    });

    it('shows installed status for installed plugins', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockInstalledPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByText('Installed')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /install/i })).not.toBeInTheDocument();
    });

    it('shows configure button for configurable installed plugins', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockInstalledPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByRole('button', { name: /configure/i })).toBeInTheDocument();
    });

    it('displays badges for official and featured plugins', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      // Official is shown as text "Official" within the metadata section
      expect(screen.getByText('Official')).toBeInTheDocument();
      // Featured is shown as a badge with "Featured" text
      expect(screen.getByText('Featured')).toBeInTheDocument();
    });

    it('shows installing state when installation is in progress', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
          isInstalling={true}
        />
      );

      expect(screen.getByText('Installing...')).toBeInTheDocument();
      const installButton = screen.getByRole('button', { name: /installing/i });
      expect(installButton).toBeDisabled();
    });

    it('shows selection checkbox when enabled', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
          showSelectionCheckbox={true}
        />
      );

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('handles plugin selection', async () => {
      const user = userEvent.setup();
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      const titleButton = screen.getByText('Kubernetes Plugin');
      await user.click(titleButton);

      expect(defaultProps.onSelect).toHaveBeenCalled();
    });

    it('handles plugin installation', async () => {
      const user = userEvent.setup();
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      const installButton = screen.getByRole('button', { name: /install/i });
      await user.click(installButton);

      expect(defaultProps.onInstall).toHaveBeenCalled();
    });

    it('handles selection toggle', async () => {
      const user = userEvent.setup();
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
          showSelectionCheckbox={true}
        />
      );

      const checkbox = screen.getByRole('checkbox');
      await user.click(checkbox);

      expect(defaultProps.onToggleSelection).toHaveBeenCalled();
    });

    it('copies package name to clipboard', async () => {
      // Create a spy on the clipboard writeText function
      const writeTextSpy = jest.spyOn(navigator.clipboard, 'writeText');

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      // The copy button is hidden by default (opacity-0), but still clickable
      const copyButton = screen.getByTitle('Copy package name');

      // Fire click event directly
      fireEvent.click(copyButton);

      // Wait for async clipboard operation to complete
      await waitFor(() => {
        expect(writeTextSpy).toHaveBeenCalledWith(mockPlugin.name);
      });
    });

    it('formats numbers correctly', () => {
      const highDownloadPlugin = {
        ...mockPlugin,
        downloads: 1500000,
        stars: 2500,
      };

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={highDownloadPlugin}
          viewMode="grid"
        />
      );

      // Downloads are formatted with M suffix for millions
      expect(screen.getByText('1.5M')).toBeInTheDocument();
      // Note: stars aren't displayed in the component, only downloads and rating
    });
  });

  describe('List View', () => {
    it('renders plugin information correctly in list view', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="list"
        />
      );

      expect(screen.getByText('Kubernetes Plugin')).toBeInTheDocument();
      expect(screen.getByText('v1.2.3 • by Backstage Team')).toBeInTheDocument();
      expect(screen.getByText(mockPlugin.description)).toBeInTheDocument();
    });

    it('displays metadata in list format', () => {
      const { container } = render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="list"
        />
      );

      // In list view, downloads and ratings are shown inline
      // Check that the formatted download count appears
      expect(container.textContent).toContain('15.4K');
      expect(container.textContent).toContain('downloads');
      expect(container.textContent).toContain('4.7');
      expect(container.textContent).toContain('rating');
      // 'infrastructure' appears multiple times - use getAllByText
      expect(screen.getAllByText('infrastructure').length).toBeGreaterThanOrEqual(1);
    });

    it('shows quick actions in list view', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="list"
        />
      );

      expect(screen.getByRole('button', { name: /install/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      const installButton = screen.getByRole('button', { name: /install/i });
      const detailsButton = screen.getByRole('button', { name: /details/i });

      expect(installButton).toBeInTheDocument();
      expect(detailsButton).toBeInTheDocument();
    });

    it('provides proper tooltips', () => {
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      // The copy button has a title for accessibility
      expect(screen.getByTitle('Copy package name')).toBeInTheDocument();
      // Repository link also has a title
      expect(screen.getByTitle('View repository')).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      const installButton = screen.getByRole('button', { name: /install/i });
      
      await user.tab();
      expect(installButton).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(defaultProps.onInstall).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional properties', () => {
      const minimalPlugin = {
        id: 'minimal',
        name: '@test/minimal-plugin',
        title: 'Minimal Plugin',
        description: 'A minimal plugin',
        version: '1.0.0',
        author: 'Test',
        category: 'development-tools' as const,
        tags: [],
        installed: false,
        enabled: false,
        configurable: false,
      };

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={minimalPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByText('Minimal Plugin')).toBeInTheDocument();
      // In grid view, downloads show as "0" with separate "Downloads" label
      expect(screen.getByText('0')).toBeInTheDocument();
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });

    it('handles very long descriptions', () => {
      const longDescriptionPlugin = {
        ...mockPlugin,
        description: 'This is a very long description that should be truncated or handled gracefully by the component. It contains a lot of text to test how the component handles overflow and text wrapping scenarios.',
      };

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={longDescriptionPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByText(longDescriptionPlugin.description)).toBeInTheDocument();
    });

    it('handles many tags gracefully', () => {
      const manyTagsPlugin = {
        ...mockPlugin,
        tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7'],
      };

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={manyTagsPlugin}
          viewMode="grid"
        />
      );

      // Should show first 3 tags plus indicator for more
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();
      expect(screen.getByText('+4')).toBeInTheDocument();
    });

    it('handles plugins without external links', () => {
      const noLinksPlugin = {
        ...mockPlugin,
        repository: undefined,
        homepage: undefined,
        npm: undefined,
      };

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={noLinksPlugin}
          viewMode="grid"
        />
      );

      expect(screen.getByText('Kubernetes Plugin')).toBeInTheDocument();
      // Should not crash and should still render the plugin
    });
  });
});