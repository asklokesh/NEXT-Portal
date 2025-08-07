import { backstageClient } from '../backstage/real-client';
import { 
  TechRadarConfig, 
  TechRadarEntry, 
  TechRadarFilters, 
  TechRadarStats,
  DEFAULT_QUADRANTS,
  DEFAULT_RINGS 
} from './types';

/**
 * Tech Radar client for managing technology radar data
 * Integrates with Backstage TechRadar plugin if available
 */
export class TechRadarClient {
  private baseUrl = '/api/techradar';

  /**
   * Get the complete tech radar configuration
   */
  async getRadarConfig(): Promise<TechRadarConfig> {
    try {
      // Try to get from Backstage tech radar plugin first
      const response = await backstageClient.request('/api/tech-radar');
      return response;
    } catch (error) {
      console.warn('Backstage TechRadar not available, using mock data:', error);
      return this.getMockRadarConfig();
    }
  }

  /**
   * Get tech radar entries with optional filtering
   */
  async getEntries(filters?: TechRadarFilters): Promise<TechRadarEntry[]> {
    try {
      const response = await fetch(`${this.baseUrl}/entries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filters })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.entries || [];
    } catch (error) {
      console.error('Failed to fetch tech radar entries:', error);
      const mockConfig = this.getMockRadarConfig();
      
      // Apply filters to mock data
      let entries = mockConfig.entries;
      
      if (filters) {
        if (filters.quadrant) {
          entries = entries.filter(e => e.quadrant.id === filters.quadrant);
        }
        if (filters.ring) {
          entries = entries.filter(e => e.ring.id === filters.ring);
        }
        if (filters.isNew !== undefined) {
          entries = entries.filter(e => e.isNew === filters.isNew);
        }
        if (filters.moved !== undefined) {
          entries = entries.filter(e => e.moved === filters.moved);
        }
        if (filters.search) {
          const search = filters.search.toLowerCase();
          entries = entries.filter(e => 
            e.name.toLowerCase().includes(search) ||
            e.description?.toLowerCase().includes(search) ||
            e.tags?.some(tag => tag.toLowerCase().includes(search))
          );
        }
        if (filters.tags?.length) {
          entries = entries.filter(e =>
            e.tags?.some(tag => filters.tags!.includes(tag))
          );
        }
        if (filters.maturity) {
          entries = entries.filter(e => e.maturity === filters.maturity);
        }
      }
      
      return entries;
    }
  }

  /**
   * Add or update a tech radar entry
   */
  async saveEntry(entry: Omit<TechRadarEntry, 'id'> | TechRadarEntry): Promise<TechRadarEntry> {
    try {
      const response = await fetch(`${this.baseUrl}/entries`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entry })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to save tech radar entry:', error);
      throw error;
    }
  }

  /**
   * Delete a tech radar entry
   */
  async deleteEntry(entryId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/entries/${entryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to delete tech radar entry:', error);
      throw error;
    }
  }

  /**
   * Get tech radar statistics
   */
  async getStats(): Promise<TechRadarStats> {
    try {
      const response = await fetch(`${this.baseUrl}/stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to fetch tech radar stats:', error);
      
      // Calculate stats from mock data
      const entries = this.getMockRadarConfig().entries;
      return this.calculateStats(entries);
    }
  }

  /**
   * Export tech radar data in various formats
   */
  async exportData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Failed to export tech radar data:', error);
      throw error;
    }
  }

  /**
   * Import tech radar data
   */
  async importData(data: TechRadarConfig): Promise<{ success: boolean; imported: number; errors: string[] }> {
    try {
      const response = await fetch(`${this.baseUrl}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to import tech radar data:', error);
      throw error;
    }
  }

  /**
   * Calculate statistics from entries
   */
  private calculateStats(entries: TechRadarEntry[]): TechRadarStats {
    const stats: TechRadarStats = {
      totalEntries: entries.length,
      newEntries: entries.filter(e => e.isNew).length,
      movedUp: entries.filter(e => e.moved === 1).length,
      movedDown: entries.filter(e => e.moved === -1).length,
      byQuadrant: {},
      byRing: {},
      byMaturity: {}
    };

    entries.forEach(entry => {
      // Count by quadrant
      stats.byQuadrant[entry.quadrant.name] = (stats.byQuadrant[entry.quadrant.name] || 0) + 1;
      
      // Count by ring
      stats.byRing[entry.ring.name] = (stats.byRing[entry.ring.name] || 0) + 1;
      
      // Count by maturity
      if (entry.maturity) {
        stats.byMaturity[entry.maturity] = (stats.byMaturity[entry.maturity] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * Get mock tech radar configuration for fallback
   */
  private getMockRadarConfig(): TechRadarConfig {
    return {
      title: 'Platform Engineering Tech Radar',
      description: 'Our assessment of technologies for platform engineering and internal developer platforms',
      quadrants: DEFAULT_QUADRANTS,
      rings: DEFAULT_RINGS,
      lastUpdated: new Date().toISOString(),
      version: '1.0.0',
      entries: [
        // Techniques quadrant
        {
          id: 'microservices',
          name: 'Microservices Architecture',
          quadrant: DEFAULT_QUADRANTS[0], // techniques
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Architectural approach to building applications as a collection of loosely coupled services',
          tags: ['architecture', 'scalability'],
          maturity: 'stable',
          lastUpdated: '2024-01-15T00:00:00Z'
        },
        {
          id: 'gitops',
          name: 'GitOps',
          quadrant: DEFAULT_QUADRANTS[0], // techniques
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Operational framework that uses Git as the single source of truth for infrastructure and applications',
          tags: ['deployment', 'automation'],
          maturity: 'stable',
          moved: 1,
          lastUpdated: '2024-01-10T00:00:00Z'
        },
        {
          id: 'chaos-engineering',
          name: 'Chaos Engineering',
          quadrant: DEFAULT_QUADRANTS[0], // techniques
          ring: DEFAULT_RINGS[1], // trial
          description: 'Practice of experimenting on systems to build confidence in their resilience',
          tags: ['reliability', 'testing'],
          maturity: 'beta',
          isNew: true,
          lastUpdated: '2024-01-20T00:00:00Z'
        },
        
        // Tools quadrant
        {
          id: 'kubernetes',
          name: 'Kubernetes',
          quadrant: DEFAULT_QUADRANTS[1], // tools
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Container orchestration platform for automating deployment, scaling, and management',
          tags: ['containers', 'orchestration'],
          maturity: 'stable',
          url: 'https://kubernetes.io',
          lastUpdated: '2024-01-05T00:00:00Z'
        },
        {
          id: 'backstage',
          name: 'Backstage',
          quadrant: DEFAULT_QUADRANTS[1], // tools
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Open platform for building developer portals',
          tags: ['developer-experience', 'platform'],
          maturity: 'stable',
          url: 'https://backstage.io',
          owner: 'Platform Team',
          lastUpdated: '2024-01-01T00:00:00Z'
        },
        {
          id: 'terraform',
          name: 'Terraform',
          quadrant: DEFAULT_QUADRANTS[1], // tools
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Infrastructure as Code tool for building, changing, and versioning infrastructure',
          tags: ['infrastructure', 'automation'],
          maturity: 'stable',
          lastUpdated: '2024-01-08T00:00:00Z'
        },
        {
          id: 'argo-cd',
          name: 'Argo CD',
          quadrant: DEFAULT_QUADRANTS[1], // tools
          ring: DEFAULT_RINGS[1], // trial
          description: 'Declarative GitOps continuous delivery tool for Kubernetes',
          tags: ['deployment', 'gitops', 'kubernetes'],
          maturity: 'stable',
          moved: 1,
          lastUpdated: '2024-01-12T00:00:00Z'
        },
        {
          id: 'crossplane',
          name: 'Crossplane',
          quadrant: DEFAULT_QUADRANTS[1], // tools
          ring: DEFAULT_RINGS[2], // assess
          description: 'Open source Kubernetes add-on that supercharges your Kubernetes clusters',
          tags: ['infrastructure', 'kubernetes', 'cloud'],
          maturity: 'beta',
          isNew: true,
          lastUpdated: '2024-01-18T00:00:00Z'
        },

        // Platforms quadrant
        {
          id: 'aws',
          name: 'Amazon Web Services',
          quadrant: DEFAULT_QUADRANTS[2], // platforms
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Cloud computing platform offering compute, storage, and networking services',
          tags: ['cloud', 'infrastructure'],
          maturity: 'stable',
          lastUpdated: '2024-01-03T00:00:00Z'
        },
        {
          id: 'docker',
          name: 'Docker',
          quadrant: DEFAULT_QUADRANTS[2], // platforms
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Platform for developing, shipping, and running applications using containers',
          tags: ['containers', 'development'],
          maturity: 'stable',
          lastUpdated: '2024-01-06T00:00:00Z'
        },
        {
          id: 'serverless',
          name: 'Serverless Computing',
          quadrant: DEFAULT_QUADRANTS[2], // platforms
          ring: DEFAULT_RINGS[1], // trial
          description: 'Cloud computing execution model where the cloud provider manages the infrastructure',
          tags: ['cloud', 'scalability'],
          maturity: 'stable',
          lastUpdated: '2024-01-14T00:00:00Z'
        },
        {
          id: 'wasm',
          name: 'WebAssembly (WASM)',
          quadrant: DEFAULT_QUADRANTS[2], // platforms
          ring: DEFAULT_RINGS[2], // assess
          description: 'Binary instruction format for a stack-based virtual machine',
          tags: ['performance', 'portability'],
          maturity: 'experimental',
          isNew: true,
          lastUpdated: '2024-01-22T00:00:00Z'
        },

        // Languages & Frameworks quadrant
        {
          id: 'typescript',
          name: 'TypeScript',
          quadrant: DEFAULT_QUADRANTS[3], // languages-frameworks
          ring: DEFAULT_RINGS[0], // adopt
          description: 'Strongly typed programming language that builds on JavaScript',
          tags: ['language', 'frontend', 'backend'],
          maturity: 'stable',
          lastUpdated: '2024-01-04T00:00:00Z'
        },
        {
          id: 'react',
          name: 'React',
          quadrant: DEFAULT_QUADRANTS[3], // languages-frameworks
          ring: DEFAULT_RINGS[0], // adopt
          description: 'JavaScript library for building user interfaces',
          tags: ['frontend', 'javascript'],
          maturity: 'stable',
          lastUpdated: '2024-01-07T00:00:00Z'
        },
        {
          id: 'nextjs',
          name: 'Next.js',
          quadrant: DEFAULT_QUADRANTS[3], // languages-frameworks
          ring: DEFAULT_RINGS[0], // adopt
          description: 'React framework for production-grade applications',
          tags: ['frontend', 'react', 'fullstack'],
          maturity: 'stable',
          moved: 1,
          lastUpdated: '2024-01-09T00:00:00Z'
        },
        {
          id: 'go',
          name: 'Go',
          quadrant: DEFAULT_QUADRANTS[3], // languages-frameworks
          ring: DEFAULT_RINGS[1], // trial
          description: 'Programming language developed by Google, known for simplicity and performance',
          tags: ['language', 'backend', 'microservices'],
          maturity: 'stable',
          lastUpdated: '2024-01-11T00:00:00Z'
        },
        {
          id: 'rust',
          name: 'Rust',
          quadrant: DEFAULT_QUADRANTS[3], // languages-frameworks
          ring: DEFAULT_RINGS[2], // assess
          description: 'Systems programming language focused on safety, speed, and concurrency',
          tags: ['language', 'systems', 'performance'],
          maturity: 'stable',
          moved: 1,
          lastUpdated: '2024-01-16T00:00:00Z'
        },
        {
          id: 'deno',
          name: 'Deno',
          quadrant: DEFAULT_QUADRANTS[3], // languages-frameworks
          ring: DEFAULT_RINGS[3], // hold
          description: 'Runtime for JavaScript and TypeScript built with security in mind',
          tags: ['runtime', 'javascript', 'typescript'],
          maturity: 'beta',
          moved: -1,
          lastUpdated: '2024-01-13T00:00:00Z'
        }
      ]
    };
  }
}

// Create and export singleton instance
export const techRadarClient = new TechRadarClient();