// Re-export edge-safe metrics by default
// This ensures any imports of '@/lib/monitoring/metrics' are safe for Edge Runtime
export * from './metrics-edge-safe';