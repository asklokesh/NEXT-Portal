/**
 * Main Middleware Entry Point
 * Uses Edge Runtime compatible middleware to prevent module loading errors
 */

export { middleware, config } from './middleware/edge-middleware';