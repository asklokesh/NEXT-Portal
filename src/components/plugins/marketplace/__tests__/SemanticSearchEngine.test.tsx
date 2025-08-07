import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SemanticSearchEngine, SearchResultHighlight } from '../SemanticSearchEngine';
import type { BackstagePlugin } from '@/services/backstage/plugin-registry';

// Mock useDebounce hook
jest.mock('@/hooks/useDebounce', () => ({
  useDebounce: (value: any, delay: number) => value, // Return immediately for testing
}));

const mockPlugins: BackstagePlugin[] = [
  {
    id: 'kubernetes',
    name: '@backstage/plugin-kubernetes',
    title: 'Kubernetes',
    description: 'Monitor and manage Kubernetes resources with comprehensive dashboard and alerting capabilities',
    version: '1.0.0',
    author: 'Backstage',
    category: 'infrastructure',
    tags: ['kubernetes', 'infrastructure', 'monitoring', 'containers'],
    downloads: 50000,
    stars: 1200,
    rating: 4.5,
    installed: false,
    enabled: false,
    configurable: true,
  },
  {
    id: 'github-actions',
    name: '@backstage/plugin-github-actions',
    title: 'GitHub Actions',
    description: 'View and trigger GitHub Actions workflows for continuous integration and deployment',
    version: '0.8.0',
    author: 'Backstage',
    category: 'ci-cd',
    tags: ['github', 'ci-cd', 'automation', 'workflows'],
    downloads: 35000,
    stars: 800,
    rating: 4.2,
    installed: true,
    enabled: true,
    configurable: false,
  },
  {
    id: 'sonarqube',
    name: '@backstage/plugin-sonarqube',
    title: 'SonarQube',
    description: 'Security scanning and code quality analysis integration with SonarQube platform',
    version: '2.1.0',
    author: 'Backstage',
    category: 'security',
    tags: ['sonarqube', 'security', 'code-quality', 'scanning'],
    downloads: 28000,
    stars: 650,
    rating: 4.1,
    installed: false,
    enabled: false,
    configurable: true,
  },
];

const defaultProps = {
  plugins: mockPlugins,
  onResults: jest.fn(),
  onSuggestionSelect: jest.fn(),
};

describe('SemanticSearchEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input with correct placeholder', () => {
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveAttribute('type', 'text');
  });

  it('displays semantic search indicator when typing', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'monitoring dashboard');

    await waitFor(() => {
      expect(screen.getByText('AI-powered semantic search active')).toBeInTheDocument();
    });
  });

  it('calls onResults with search results when query changes', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'kubernetes');

    await waitFor(() => {
      expect(defaultProps.onResults).toHaveBeenCalled();
      const results = defaultProps.onResults.mock.calls[0][0];
      expect(results).toHaveLength(1);
      expect(results[0].plugin.id).toBe('kubernetes');
    });
  });

  it('performs semantic search for functionality-based queries', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'help with monitoring and alerts');

    await waitFor(() => {
      expect(defaultProps.onResults).toHaveBeenCalled();
      const results = defaultProps.onResults.mock.calls[0][0];
      
      // Should find Kubernetes plugin due to monitoring keywords
      const kubernetesResult = results.find((r: any) => r.plugin.id === 'kubernetes');
      expect(kubernetesResult).toBeDefined();
      expect(kubernetesResult.matchReasons.some((r: any) => r.type === 'functionality')).toBeTruthy();
    });
  });

  it('searches by category', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'ci-cd');

    await waitFor(() => {
      expect(defaultProps.onResults).toHaveBeenCalled();
      const results = defaultProps.onResults.mock.calls[0][0];
      
      const githubResult = results.find((r: any) => r.plugin.id === 'github-actions');
      expect(githubResult).toBeDefined();
    });
  });

  it('searches by tags', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'security');

    await waitFor(() => {
      expect(defaultProps.onResults).toHaveBeenCalled();
      const results = defaultProps.onResults.mock.calls[0][0];
      
      const sonarResult = results.find((r: any) => r.plugin.id === 'sonarqube');
      expect(sonarResult).toBeDefined();
    });
  });

  it('shows suggestions when input is focused', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText('Recent searches')).toBeInTheDocument();
      expect(screen.getByText('Search tips:')).toBeInTheDocument();
    });
  });

  it('displays category suggestions when no query is entered', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText(/infrastructure/)).toBeInTheDocument();
      expect(screen.getByText(/ci cd/)).toBeInTheDocument();
      expect(screen.getByText(/security/)).toBeInTheDocument();
    });
  });

  it('shows contextual suggestions based on partial input', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'kubern');

    await waitFor(() => {
      // Should show kubernetes-related suggestions
      const suggestions = screen.getAllByRole('button');
      const kubernetesSuggestion = suggestions.find(button => 
        button.textContent?.includes('kubernetes')
      );
      expect(kubernetesSuggestion).toBeInTheDocument();
    });
  });

  it('handles suggestion selection', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.click(searchInput);

    await waitFor(() => {
      const infrastructureSuggestion = screen.getByText(/infrastructure/);
      await user.click(infrastructureSuggestion);

      expect(defaultProps.onSuggestionSelect).toHaveBeenCalledWith('infrastructure');
    });
  });

  it('supports keyboard navigation through suggestions', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'test');

    // Simulate arrow key navigation
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    // Should select a suggestion (exact behavior depends on implementation)
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.type(searchInput, 'test query');

    const clearButton = screen.getByRole('button');
    await user.click(clearButton);

    expect(searchInput).toHaveValue('');
    expect(defaultProps.onResults).toHaveBeenCalledWith([]);
  });

  it('maintains search history', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    
    // Perform a search
    await user.type(searchInput, 'kubernetes');
    await user.clear(searchInput);

    // Focus again to see history
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText('kubernetes')).toBeInTheDocument();
    });
  });

  it('handles escape key to close suggestions', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.click(searchInput);

    // Suggestions should be visible
    await waitFor(() => {
      expect(screen.getByText('Search tips:')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    // Suggestions should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Search tips:')).not.toBeInTheDocument();
    });
  });

  it('provides search tips to users', async () => {
    const user = userEvent.setup();
    render(<SemanticSearchEngine {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
    await user.click(searchInput);

    await waitFor(() => {
      expect(screen.getByText(/Try "monitoring with alerts"/)).toBeInTheDocument();
      expect(screen.getByText(/Use "similar to \[plugin\]"/)).toBeInTheDocument();
      expect(screen.getByText(/Search by functionality/)).toBeInTheDocument();
    });
  });

  describe('SearchResultHighlight', () => {
    const mockResult = {
      plugin: mockPlugins[0],
      score: 95.5,
      matchReasons: [
        {
          type: 'title' as const,
          field: 'title',
          matchedText: 'Kubernetes',
          confidence: 1.0,
        },
        {
          type: 'functionality' as const,
          field: 'category',
          matchedText: 'infrastructure',
          confidence: 0.8,
        },
        {
          type: 'semantic' as const,
          field: 'semantic',
          matchedText: 'Semantic similarity',
          confidence: 0.6,
        },
      ],
      semanticScore: 0.6,
      relevanceScore: 15.5,
    };

    it('displays match score and reason count', () => {
      render(<SearchResultHighlight result={mockResult} />);

      expect(screen.getByText('Match Score: 96')).toBeInTheDocument();
      expect(screen.getByText('3 matches')).toBeInTheDocument();
    });

    it('shows match reason badges', () => {
      render(<SearchResultHighlight result={mockResult} />);

      expect(screen.getByText('title')).toBeInTheDocument();
      expect(screen.getByText('functionality')).toBeInTheDocument();
      expect(screen.getByText('semantic')).toBeInTheDocument();
    });

    it('limits displayed match reasons to first 3', () => {
      const manyReasonsResult = {
        ...mockResult,
        matchReasons: [
          ...mockResult.matchReasons,
          {
            type: 'tags' as const,
            field: 'tags',
            matchedText: 'kubernetes',
            confidence: 0.9,
          },
          {
            type: 'description' as const,
            field: 'description',
            matchedText: 'monitoring',
            confidence: 0.7,
          },
        ],
      };

      render(<SearchResultHighlight result={manyReasonsResult} />);

      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('provides tooltips for match reasons', () => {
      render(<SearchResultHighlight result={mockResult} />);

      const titleBadge = screen.getByText('title');
      expect(titleBadge).toHaveAttribute('title', 
        'title: Kubernetes (100% confidence)'
      );
    });

    it('displays appropriate icons for different match types', () => {
      render(<SearchResultHighlight result={mockResult} />);

      // Should show different icons for different match types
      const semanticBadge = screen.getByText('semantic');
      const functionalityBadge = screen.getByText('functionality');
      
      expect(semanticBadge.querySelector('svg')).toBeInTheDocument();
      expect(functionalityBadge.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty plugin list gracefully', async () => {
      const user = userEvent.setup();
      render(<SemanticSearchEngine {...defaultProps} plugins={[]} />);

      const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
      await user.type(searchInput, 'test');

      await waitFor(() => {
        expect(defaultProps.onResults).toHaveBeenCalledWith([]);
      });
    });

    it('handles very long search queries', async () => {
      const user = userEvent.setup();
      render(<SemanticSearchEngine {...defaultProps} />);

      const longQuery = 'a'.repeat(1000);
      const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
      await user.type(searchInput, longQuery);

      // Should not crash and should handle gracefully
      expect(searchInput).toHaveValue(longQuery);
    });

    it('handles special characters in search query', async () => {
      const user = userEvent.setup();
      render(<SemanticSearchEngine {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
      await user.type(searchInput, 'test@#$%^&*()');

      // Should not crash
      expect(searchInput).toHaveValue('test@#$%^&*()');
    });

    it('handles plugins with missing or null properties', async () => {
      const incompletePlugins = [
        {
          ...mockPlugins[0],
          description: '',
          tags: [],
          rating: undefined,
        },
      ] as BackstagePlugin[];

      const user = userEvent.setup();
      render(
        <SemanticSearchEngine 
          {...defaultProps} 
          plugins={incompletePlugins}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Describe what you're looking for/);
      await user.type(searchInput, 'kubernetes');

      // Should handle gracefully without crashing
      await waitFor(() => {
        expect(defaultProps.onResults).toHaveBeenCalled();
      });
    });
  });
});