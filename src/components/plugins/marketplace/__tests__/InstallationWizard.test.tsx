import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstallationWizard } from '../InstallationWizard';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock react-hook-form
jest.mock('react-hook-form', () => ({
  useForm: () => ({
    control: {},
    handleSubmit: (fn: any) => (e: any) => {
      e.preventDefault();
      fn({});
    },
    formState: { errors: {} },
    setValue: jest.fn(),
    watch: jest.fn(() => ({})),
  }),
  Controller: ({ render }: any) => render({
    field: { onChange: jest.fn(), value: '' },
    fieldState: { error: null },
  }),
}));

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
};

const defaultProps = {
  plugin: mockPlugin,
  onClose: jest.fn(),
};

describe('InstallationWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the wizard header correctly', () => {
    render(<InstallationWizard {...defaultProps} />);

    expect(screen.getByText('Install Kubernetes Plugin')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3: Configuration')).toBeInTheDocument();
  });

  it('displays step progress indicators', () => {
    render(<InstallationWizard {...defaultProps} />);

    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
    expect(screen.getByText('Installation')).toBeInTheDocument();
  });

  it('shows configuration form in first step', () => {
    render(<InstallationWizard {...defaultProps} />);

    expect(screen.getByText('Configure Kubernetes Plugin')).toBeInTheDocument();
    expect(screen.getByText(/Set up the plugin configuration/)).toBeInTheDocument();
  });

  it('displays appropriate configuration fields based on plugin category', () => {
    render(<InstallationWizard {...defaultProps} />);

    // For infrastructure/kubernetes plugin, should show relevant fields
    expect(screen.getByText('Enable Plugin')).toBeInTheDocument();
    
    // Since it's a kubernetes plugin, should show kubernetes-specific fields
    expect(screen.getByText('Kubernetes API URL')).toBeInTheDocument();
    expect(screen.getByText('Service Account Token')).toBeInTheDocument();
    expect(screen.getByText('Default Namespace')).toBeInTheDocument();
  });

  it('handles navigation between steps', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Should start at configuration step
    expect(screen.getByText('Configure Kubernetes Plugin')).toBeInTheDocument();

    // Navigate to next step
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    expect(screen.getByText('Review Installation')).toBeInTheDocument();
  });

  it('prevents navigation to previous step from first step', () => {
    render(<InstallationWizard {...defaultProps} />);

    const previousButton = screen.getByRole('button', { name: /previous/i });
    expect(previousButton).toBeDisabled();
  });

  it('displays review information in second step', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to review step
    const nextButton = screen.getByRole('button', { name: /next/i });
    await user.click(nextButton);

    expect(screen.getByText('Review Installation')).toBeInTheDocument();
    expect(screen.getByText('Plugin Details')).toBeInTheDocument();
    expect(screen.getByText('Kubernetes Plugin')).toBeInTheDocument();
    expect(screen.getByText('v1.2.3')).toBeInTheDocument();
  });

  it('shows installation preview in review step', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to review step
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('What will happen during installation')).toBeInTheDocument();
    expect(screen.getByText('Download and install the plugin package')).toBeInTheDocument();
    expect(screen.getByText('Apply your configuration settings')).toBeInTheDocument();
  });

  it('starts installation automatically when reaching installation step', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate through steps to installation
    await user.click(screen.getByRole('button', { name: /next/i })); // Go to review
    await user.click(screen.getByRole('button', { name: /install/i })); // Go to installation

    expect(screen.getByText('Installing Plugin...')).toBeInTheDocument();
    expect(screen.getByText('Preparing installation...')).toBeInTheDocument();
  });

  it('shows installation progress', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to installation step
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /install/i }));

    // Should show progress bar and percentage
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    // Fast-forward through installation steps
    jest.advanceTimersByTime(1500);
    await waitFor(() => {
      expect(screen.getByText('20%')).toBeInTheDocument();
    });

    jest.advanceTimersByTime(1500);
    await waitFor(() => {
      expect(screen.getByText('40%')).toBeInTheDocument();
    });
  });

  it('displays installation logs', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to installation step
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /install/i }));

    expect(screen.getByText('Installation Logs')).toBeInTheDocument();
    expect(screen.getByText('Starting plugin installation process...')).toBeInTheDocument();
  });

  it('can toggle log visibility', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to installation step
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /install/i }));

    const toggleLogsButton = screen.getByText('Show Logs');
    await user.click(toggleLogsButton);

    // Should show the logs container
    expect(screen.getByText('Starting plugin installation process...')).toBeVisible();
  });

  it('shows success state after installation completes', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to installation and wait for completion
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /install/i }));

    // Fast-forward through all installation steps
    jest.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(screen.getByText('Installation Complete!')).toBeInTheDocument();
      expect(screen.getByText('Plugin Ready!')).toBeInTheDocument();
    });
  });

  it('handles password field visibility toggle', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Find password field (Service Account Token)
    const passwordField = screen.getByDisplayValue(''); // This would be the token field
    const toggleButton = screen.getByTitle('Show/Hide password'); // Assuming there's a toggle button

    // Initially should be password type
    expect(passwordField).toHaveAttribute('type', 'password');

    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute('type', 'text');

    await user.click(toggleButton);
    expect(passwordField).toHaveAttribute('type', 'password');
  });

  it('validates required fields', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    const nextButton = screen.getByRole('button', { name: /next/i });
    
    // Try to proceed without filling required fields
    await user.click(nextButton);

    // Should still be on configuration step if validation fails
    expect(screen.getByText('Configure Kubernetes Plugin')).toBeInTheDocument();
  });

  it('closes wizard when clicking close button', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('prevents closing during installation', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Navigate to installation step
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /install/i }));

    // Close button should not be visible during installation
    expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
  });

  it('auto-closes after successful installation', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Complete installation
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /install/i }));

    // Fast-forward through installation and auto-close timeout
    jest.advanceTimersByTime(13000); // Installation time + 3s auto-close

    await waitFor(() => {
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  it('handles different plugin categories with appropriate configurations', () => {
    const githubActionsPlugin = {
      ...mockPlugin,
      id: 'github-actions',
      title: 'GitHub Actions',
      category: 'ci-cd' as const,
    };

    render(<InstallationWizard {...defaultProps} plugin={githubActionsPlugin} />);

    // Should show CI/CD specific configuration options
    expect(screen.getByText('GitHub Token')).toBeInTheDocument();
    expect(screen.getByText('GitHub API URL')).toBeInTheDocument();
  });

  it('renders correctly for plugins with no additional configuration', () => {
    const simplePlugin = {
      ...mockPlugin,
      category: 'documentation' as const,
    };

    render(<InstallationWizard {...defaultProps} plugin={simplePlugin} />);

    expect(screen.getByText('No additional configuration required')).toBeInTheDocument();
  });

  it('handles keyboard navigation', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    // Should be able to navigate using keyboard
    await user.keyboard('{Tab}'); // Focus on first input
    await user.keyboard('{Tab}'); // Focus on next button
    await user.keyboard('{Enter}'); // Activate next button

    expect(screen.getByText('Review Installation')).toBeInTheDocument();
  });

  it('displays system requirements section', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<InstallationWizard {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('System Requirements')).toBeInTheDocument();
    // Would show requirements like Backstage version, Node.js version, etc.
  });
});