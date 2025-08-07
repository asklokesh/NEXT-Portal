export interface TechRadarEntry {
  id: string;
  name: string;
  quadrant: TechQuadrant;
  ring: TechRing;
  isNew?: boolean;
  description?: string;
  moved?: 0 | 1 | -1; // 0 = no change, 1 = moved up/out, -1 = moved down/in
  url?: string;
  tags?: string[];
  owner?: string;
  lastUpdated?: string;
  maturity?: 'experimental' | 'alpha' | 'beta' | 'stable' | 'deprecated';
}

export interface TechQuadrant {
  id: string;
  name: string;
  description?: string;
  color: string;
}

export interface TechRing {
  id: string;
  name: string;
  description?: string;
  radius: number;
  color: string;
}

export interface TechRadarConfig {
  title: string;
  description?: string;
  quadrants: TechQuadrant[];
  rings: TechRing[];
  entries: TechRadarEntry[];
  lastUpdated?: string;
  version?: string;
}

// Default quadrants based on the original ThoughtWorks Tech Radar
export const DEFAULT_QUADRANTS: TechQuadrant[] = [
  {
    id: 'techniques',
    name: 'Techniques',
    description: 'Elements of software development processes',
    color: '#8B5A3C'
  },
  {
    id: 'tools', 
    name: 'Tools',
    description: 'Components, products, and services used in development',
    color: '#587498'
  },
  {
    id: 'platforms',
    name: 'Platforms',
    description: 'Low-level development and deployment platforms',
    color: '#B32821'
  },
  {
    id: 'languages-frameworks',
    name: 'Languages & Frameworks',
    description: 'Programming languages and frameworks',
    color: '#86A697'
  }
];

// Default rings based on the original ThoughtWorks Tech Radar
export const DEFAULT_RINGS: TechRing[] = [
  {
    id: 'adopt',
    name: 'Adopt',
    description: 'Strong recommendation for adoption',
    radius: 130,
    color: '#93c47d'
  },
  {
    id: 'trial', 
    name: 'Trial',
    description: 'Worth pursuing with the goal of adoption',
    radius: 220,
    color: '#ffe599'
  },
  {
    id: 'assess',
    name: 'Assess',
    description: 'Worth exploring to understand impact',
    radius: 310,
    color: '#f4cccc'
  },
  {
    id: 'hold',
    name: 'Hold',
    description: 'Proceed with caution',
    radius: 400,
    color: '#ea9999'
  }
];

export interface TechRadarFilters {
  quadrant?: string;
  ring?: string;
  isNew?: boolean;
  moved?: 0 | 1 | -1;
  search?: string;
  tags?: string[];
  maturity?: string;
}

export interface TechRadarStats {
  totalEntries: number;
  newEntries: number;
  movedUp: number;
  movedDown: number;
  byQuadrant: Record<string, number>;
  byRing: Record<string, number>;
  byMaturity: Record<string, number>;
}