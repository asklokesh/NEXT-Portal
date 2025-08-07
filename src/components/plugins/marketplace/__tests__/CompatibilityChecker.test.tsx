import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompatibilityChecker } from '../CompatibilityChecker';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

const mockPlugin: BackstagePlugin = {
  id: 'kubernetes',
  name: '@backstage/plugin-kubernetes',
  title: 'Kubernetes Plugin',
  description: 'A comprehensive plugin for managing Kubernetes resources',
  version: '1.2.3',
  author: 'Backstage Team',
  category: 'infrastructure',
  tags: ['kubernetes', 'infrastructure'],
  downloads: 15420,
  stars: 892,
  rating: 4.7,
  installed: false,
  enabled: false,
  configurable: true,
  official: true,
  compatibility: {
    backstageVersion: '>=1.18.0',
    nodeVersion: '>=18.0.0',
    npmVersion: '>=9.0.0',
  },
  dependencies: [
    '@backstage/core-plugin-api',
    '@backstage/theme',
    'react',
    'react-dom',
  ],
  permissions: [
    'catalog:read',
    'catalog:write',
    'kubernetes:read',
  ],
};

const mockSystemInfo = {
  backstageVersion: '1.18.3',
  nodeVersion: '18.17.1',
  npmVersion: '9.6.7',
  platform: 'linux',
  arch: 'x64',
  memory: 8192,
  diskSpace: 50000,
  installedPackages: {
    '@backstage/core-plugin-api': '1.18.3',
    '@backstage/theme': '0.4.4',
    'react': '18.2.0',
    'react-dom': '18.2.0',
    'typescript': '5.0.4',
  },
  availableServices: ['postgresql', 'redis', 'elasticsearch'],
  permissions: ['catalog:read', 'catalog:write', 'user:read'],
};

const defaultProps = {
  plugin: mockPlugin,
  installedPlugins: [],
  systemInfo: mockSystemInfo,
  onCheckComplete: jest.fn(),
};

describe('CompatibilityChecker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders compatibility checker header', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    expect(screen.getByText('Compatibility Check')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /re-check/i })).toBeInTheDocument();
  });

  it('displays overall compatibility status', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    expect(screen.getByText('Fully Compatible')).toBeInTheDocument();
    expect(screen.getByText(/Compatibility Score:/)).toBeInTheDocument();
  });

  it('shows compatibility score with progress bar', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    const scoreText = screen.getByText(/Compatibility Score: \d+\/100/);
    expect(scoreText).toBeInTheDocument();
    
    // Progress bar should be present
    const progressBar = document.querySelector('.h-2.rounded-full');
    expect(progressBar).toBeInTheDocument();
  });

  it('displays tab navigation', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    expect(screen.getByRole('button', { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /detailed checks/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /requirements/i })).toBeInTheDocument();
  });

  it('shows overview tab content by default', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText(/Passed|Warnings|Failed/)).toBeInTheDocument();
  });

  it('switches between tabs correctly', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CompatibilityChecker {...defaultProps} />);

    // Click on Detailed Checks tab
    const detailedChecksTab = screen.getByRole('button', { name: /detailed checks/i });
    await user.click(detailedChecksTab);

    // Should show detailed checks content
    expect(screen.getByText('Backstage Version')).toBeInTheDocument();
    expect(screen.getByText('Node.js Version')).toBeInTheDocument();

    // Click on Requirements tab
    const requirementsTab = screen.getByRole('button', { name: /requirements/i });
    await user.click(requirementsTab);

    // Should show requirements content
    expect(screen.getByText('Backstage')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
  });

  it('performs version compatibility checks', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    // Switch to detailed checks
    const detailedChecksTab = screen.getByRole('button', { name: /detailed checks/i });
    fireEvent.click(detailedChecksTab);

    expect(screen.getByText('Compatible with Backstage 1.18.3')).toBeInTheDocument();
    expect(screen.getByText('Compatible with Node.js 18.17.1')).toBeInTheDocument();
  });

  it('detects version incompatibilities', () => {
    const incompatibleSystemInfo = {
      ...mockSystemInfo,
      backstageVersion: '1.17.0', // Below required version
      nodeVersion: '16.0.0', // Below required version
    };

    render(
      <CompatibilityChecker 
        {...defaultProps} 
        systemInfo={incompatibleSystemInfo}
      />
    );

    expect(screen.getByText('Not Compatible')).toBeInTheDocument();

    // Switch to detailed checks to see specific issues
    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    expect(screen.getByText(/Requires Backstage >=1.18.0, but 1.17.0 is installed/)).toBeInTheDocument();
    expect(screen.getByText(/Requires Node.js >=18.0.0, but 16.0.0 is installed/)).toBeInTheDocument();
  });

  it('checks dependency availability', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    mockPlugin.dependencies?.forEach(dep => {
      expect(screen.getByText(`Dependency: ${dep}`)).toBeInTheDocument();
    });
  });

  it('checks resource requirements', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    expect(screen.getByText('Memory Requirement')).toBeInTheDocument();
    expect(screen.getByText('Disk Space')).toBeInTheDocument();
  });

  it('detects insufficient resources', () => {
    const lowResourceSystemInfo = {
      ...mockSystemInfo,
      memory: 128, // Very low memory
      diskSpace: 50, // Very low disk space
    };

    render(
      <CompatibilityChecker 
        {...defaultProps} 
        systemInfo={lowResourceSystemInfo}
      />
    );

    expect(screen.getByText('Not Compatible')).toBeInTheDocument();
  });

  it('checks permission requirements', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    mockPlugin.permissions?.forEach(permission => {
      expect(screen.getByText(`Permission: ${permission}`)).toBeInTheDocument();
    });
  });

  it('identifies missing permissions', () => {
    const limitedPermissionsSystemInfo = {
      ...mockSystemInfo,
      permissions: ['catalog:read'], // Missing catalog:write and kubernetes:read
    };

    render(
      <CompatibilityChecker 
        {...defaultProps} 
        systemInfo={limitedPermissionsSystemInfo}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    expect(screen.getByText('Permission catalog:write may be required')).toBeInTheDocument();
    expect(screen.getByText('Permission kubernetes:read may be required')).toBeInTheDocument();
  });

  it('detects plugin conflicts', () => {
    const conflictingPlugin = {
      ...mockPlugin,
      id: 'another-kubernetes-plugin',
      category: 'infrastructure',
    };

    render(
      <CompatibilityChecker 
        {...defaultProps} 
        installedPlugins={[conflictingPlugin] as BackstagePlugin[]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    expect(screen.getByText(/May conflict with installed plugins/)).toBeInTheDocument();
  });

  it('expands and collapses check details', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CompatibilityChecker {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /detailed checks/i }));

    // Find a check with expandable details
    const expandButton = document.querySelector('[data-testid="expand-check"]') || 
                        screen.getAllByRole('button').find(btn => 
                          btn.textContent?.includes('chevron') || 
                          btn.querySelector('[data-icon]')
                        );

    if (expandButton) {
      await user.click(expandButton);
      
      // Should show additional details
      expect(screen.getByText(/Details:|Fix:/)).toBeInTheDocument();
    }
  });

  it('displays system requirements correctly', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /requirements/i }));

    // Should show runtime requirements
    expect(screen.getByText('Backstage')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    
    // Should show dependencies
    mockPlugin.dependencies?.forEach(dep => {
      expect(screen.getByText(dep)).toBeInTheDocument();
    });
  });

  it('shows critical requirements badge', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /requirements/i }));

    const criticalBadges = screen.getAllByText('Critical');
    expect(criticalBadges.length).toBeGreaterThan(0);
  });

  it('provides recommendations based on check results', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Plugin is fully compatible and ready for installation')).toBeInTheDocument();
  });

  it('shows critical issues when there are blockers', () => {
    const incompatibleSystemInfo = {
      ...mockSystemInfo,
      backstageVersion: '1.0.0', // Very old version
      memory: 64, // Insufficient memory
    };

    render(
      <CompatibilityChecker 
        {...defaultProps} 
        systemInfo={incompatibleSystemInfo}
      />
    );

    expect(screen.getByText(/Critical Issues/)).toBeInTheDocument();
  });

  it('handles re-check functionality', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CompatibilityChecker {...defaultProps} />);

    const recheckButton = screen.getByRole('button', { name: /re-check/i });
    await user.click(recheckButton);

    expect(screen.getByText('Checking...')).toBeInTheDocument();

    // Fast-forward through checking delay
    jest.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.queryByText('Checking...')).not.toBeInTheDocument();
      expect(defaultProps.onCheckComplete).toHaveBeenCalled();
    });
  });

  it('shows checking state during re-check', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<CompatibilityChecker {...defaultProps} />);

    const recheckButton = screen.getByRole('button', { name: /re-check/i });
    await user.click(recheckButton);

    expect(screen.getByText('Checking compatibility...')).toBeInTheDocument();
    expect(recheckButton).toBeDisabled();
  });

  it('displays compatibility statistics correctly', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    // Should show statistics for passed, warnings, and failed checks
    const passedCount = screen.getByText(/^\d+$/, { selector: '.text-green-600' });
    const warningsCount = screen.getByText(/^\d+$/, { selector: '.text-yellow-600' });
    const failedCount = screen.getByText(/^\d+$/, { selector: '.text-red-600' });

    expect(passedCount).toBeInTheDocument();
    expect(warningsCount).toBeInTheDocument();
    expect(failedCount).toBeInTheDocument();
  });

  it('handles different plugin categories correctly', () => {
    const cicdPlugin = {
      ...mockPlugin,
      category: 'ci-cd' as const,
    };

    render(<CompatibilityChecker {...defaultProps} plugin={cicdPlugin} />);

    // CI/CD plugins might have different resource requirements
    // The checker should adapt accordingly
    expect(screen.getByText('Compatibility Check')).toBeInTheDocument();
  });

  it('calls onCheckComplete callback with results', () => {
    render(<CompatibilityChecker {...defaultProps} />);

    expect(defaultProps.onCheckComplete).toHaveBeenCalled();
    
    const result = defaultProps.onCheckComplete.mock.calls[0][0];
    expect(result).toHaveProperty('overall');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('requirements');
    expect(result).toHaveProperty('recommendations');
    expect(result).toHaveProperty('blockers');
  });

  describe('Edge Cases', () => {
    it('handles plugins with no compatibility requirements', () => {
      const simplePlugin = {
        ...mockPlugin,
        compatibility: undefined,
        dependencies: undefined,
        permissions: undefined,
      };

      render(<CompatibilityChecker {...defaultProps} plugin={simplePlugin} />);

      expect(screen.getByText('Compatibility Check')).toBeInTheDocument();
      // Should still perform basic checks
    });

    it('handles missing system information gracefully', () => {
      const incompleteSystemInfo = {
        ...mockSystemInfo,
        backstageVersion: '',
        nodeVersion: '',
        installedPackages: {},
        permissions: [],
      };

      render(
        <CompatibilityChecker 
          {...defaultProps} 
          systemInfo={incompleteSystemInfo}
        />
      );

      // Should not crash
      expect(screen.getByText('Compatibility Check')).toBeInTheDocument();
    });

    it('handles very large plugin lists for conflict detection', () => {
      const manyPlugins = Array.from({ length: 100 }, (_, i) => ({
        ...mockPlugin,
        id: `plugin-${i}`,
        category: 'infrastructure' as const,
      }));

      render(
        <CompatibilityChecker 
          {...defaultProps} 
          installedPlugins={manyPlugins as BackstagePlugin[]}
        />
      );

      // Should handle large lists without performance issues
      expect(screen.getByText('Compatibility Check')).toBeInTheDocument();
    });
  });
});