// Mock D3.js for Jest testing
const d3Mock = {
  select: jest.fn(() => ({
    selectAll: jest.fn(() => ({
      data: jest.fn(() => ({
        enter: jest.fn(() => ({
          append: jest.fn(() => ({
            attr: jest.fn(() => ({})),
            style: jest.fn(() => ({})),
            text: jest.fn(() => ({})),
          })),
        })),
        exit: jest.fn(() => ({
          remove: jest.fn(),
        })),
        attr: jest.fn(() => ({})),
        style: jest.fn(() => ({})),
        text: jest.fn(() => ({})),
      })),
      attr: jest.fn(() => ({})),
      style: jest.fn(() => ({})),
      text: jest.fn(() => ({})),
    })),
    attr: jest.fn(() => ({})),
    style: jest.fn(() => ({})),
    text: jest.fn(() => ({})),
    append: jest.fn(() => ({})),
    datum: jest.fn(() => ({})),
    call: jest.fn(() => ({})),
  })),
  
  selectAll: jest.fn(() => ({
    data: jest.fn(() => ({
      enter: jest.fn(() => ({
        append: jest.fn(() => ({
          attr: jest.fn(() => ({})),
          style: jest.fn(() => ({})),
          text: jest.fn(() => ({})),
        })),
      })),
      exit: jest.fn(() => ({
        remove: jest.fn(),
      })),
      attr: jest.fn(() => ({})),
      style: jest.fn(() => ({})),
      text: jest.fn(() => ({})),
    })),
    attr: jest.fn(() => ({})),
    style: jest.fn(() => ({})),
    text: jest.fn(() => ({})),
  })),

  scaleLinear: jest.fn(() => ({
    domain: jest.fn(() => ({
      range: jest.fn(() => jest.fn()),
    })),
    range: jest.fn(() => ({
      domain: jest.fn(() => jest.fn()),
    })),
  })),

  scaleOrdinal: jest.fn(() => ({
    domain: jest.fn(() => ({
      range: jest.fn(() => jest.fn()),
    })),
    range: jest.fn(() => ({
      domain: jest.fn(() => jest.fn()),
    })),
  })),

  axisBottom: jest.fn(() => jest.fn()),
  axisLeft: jest.fn(() => jest.fn()),
  
  line: jest.fn(() => ({
    x: jest.fn(() => ({})),
    y: jest.fn(() => ({})),
    curve: jest.fn(() => ({})),
  })),

  arc: jest.fn(() => ({
    innerRadius: jest.fn(() => ({})),
    outerRadius: jest.fn(() => ({})),
    startAngle: jest.fn(() => ({})),
    endAngle: jest.fn(() => ({})),
  })),

  pie: jest.fn(() => jest.fn()),

  // Force simulation for network graphs
  forceSimulation: jest.fn(() => ({
    force: jest.fn(() => ({})),
    on: jest.fn(() => ({})),
    nodes: jest.fn(() => ({})),
    links: jest.fn(() => ({})),
    stop: jest.fn(),
    restart: jest.fn(),
    tick: jest.fn(),
  })),

  forceLink: jest.fn(() => ({
    id: jest.fn(() => ({})),
    distance: jest.fn(() => ({})),
    strength: jest.fn(() => ({})),
  })),

  forceManyBody: jest.fn(() => ({
    strength: jest.fn(() => ({})),
  })),

  forceCenter: jest.fn(() => ({})),

  // Event handling
  event: {
    transform: { k: 1, x: 0, y: 0 },
    sourceEvent: null,
  },

  zoom: jest.fn(() => ({
    scaleExtent: jest.fn(() => ({})),
    on: jest.fn(() => ({})),
  })),

  drag: jest.fn(() => ({
    on: jest.fn(() => ({})),
  })),

  // Utility functions
  max: jest.fn((arr, accessor) => {
    if (!arr || arr.length === 0) return undefined;
    return Math.max(...arr.map(accessor || (d => d)));
  }),

  min: jest.fn((arr, accessor) => {
    if (!arr || arr.length === 0) return undefined;
    return Math.min(...arr.map(accessor || (d => d)));
  }),

  extent: jest.fn((arr, accessor) => {
    if (!arr || arr.length === 0) return [undefined, undefined];
    const values = arr.map(accessor || (d => d));
    return [Math.min(...values), Math.max(...values)];
  }),

  // Color scales
  schemeCategory10: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd'],
  scaleOrdinal: jest.fn(() => jest.fn()),
};

module.exports = d3Mock;