import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn(),
      },
    });
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
      expect(screen.getByText('15.4K downloads')).toBeInTheDocument();
      expect(screen.getByText('4.7 rating')).toBeInTheDocument();
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
      expect(screen.getByText('infrastructure')).toBeInTheDocument();
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

      // Check for official and featured indicators (icons or badges)
      const officialElement = screen.getByTitle('Official');
      const featuredElement = screen.getByTitle('Featured');
      
      expect(officialElement).toBeInTheDocument();
      expect(featuredElement).toBeInTheDocument();
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
      const user = userEvent.setup();
      const mockWriteText = navigator.clipboard.writeText as jest.Mock;

      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="grid"
        />
      );

      const copyButton = screen.getByTitle('Copy package name');
      await user.click(copyButton);

      expect(mockWriteText).toHaveBeenCalledWith(mockPlugin.name);
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

      expect(screen.getByText('1.5M')).toBeInTheDocument(); // downloads
      expect(screen.getByText('2.5K')).toBeInTheDocument(); // stars
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
      render(
        <MarketplacePluginCard
          {...defaultProps}
          plugin={mockPlugin}
          viewMode="list"
        />
      );

      expect(screen.getByText('15.4K downloads')).toBeInTheDocument();
      expect(screen.getByText('4.7 rating')).toBeInTheDocument();
      expect(screen.getByText('infrastructure')).toBeInTheDocument();
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

      expect(screen.getByTitle('Official')).toBeInTheDocument();
      expect(screen.getByTitle('Featured')).toBeInTheDocument();
      expect(screen.getByTitle('Copy package name')).toBeInTheDocument();
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
      expect(screen.getByText('0 downloads')).toBeInTheDocument();
      expect(screen.getByText('N/A rating')).toBeInTheDocument();
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