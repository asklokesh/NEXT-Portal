'use client';

// This file provides client-only exports for recharts components
// to prevent SSR issues during build

// Safe re-export of recharts components
export {
 LineChart,
 Line,
 BarChart,
 Bar,
 PieChart,
 Pie,
 Cell,
 XAxis,
 YAxis,
 CartesianGrid,
 Tooltip,
 Legend,
 ResponsiveContainer,
 Area,
 AreaChart,
 Radar,
 RadarChart,
 PolarGrid,
 PolarAngleAxis,
 PolarRadiusAxis,
 ScatterChart,
 Scatter,
 ComposedChart,
 ReferenceLine,
 type TooltipProps,
 type LegendProps,
 type CartesianGridProps
} from 'recharts';