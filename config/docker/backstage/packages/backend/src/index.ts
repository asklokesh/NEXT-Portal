/*
 * Hi!
 *
 * Note that this is an EXAMPLE Backstage backend. Please check the README.
 *
 * Happy hacking!
 */

import { createBackend } from '@backstage/backend-defaults';

const backend = createBackend();

// Auth plugin
backend.add(import('@backstage/plugin-auth-backend'));
backend.add(import('@backstage/plugin-auth-backend/alpha'));

// Catalog plugin
backend.add(import('@backstage/plugin-catalog-backend/alpha'));

// Permission plugin
backend.add(import('@backstage/plugin-permission-backend/alpha'));
backend.add(import('@backstage/plugin-permission-backend-module-allow-all-policy'));

// Search plugin
backend.add(import('@backstage/plugin-search-backend/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-catalog/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-pg/alpha'));
backend.add(import('@backstage/plugin-search-backend-module-techdocs/alpha'));

// Scaffolder plugin
backend.add(import('@backstage/plugin-scaffolder-backend/alpha'));

// TechDocs plugin
backend.add(import('@backstage/plugin-techdocs-backend/alpha'));

// Kubernetes plugin
backend.add(import('@backstage/plugin-kubernetes-backend/alpha'));

// Proxy plugin
backend.add(import('@backstage/plugin-proxy-backend/alpha'));

// App backend plugin
backend.add(import('@backstage/plugin-app-backend/alpha'));

backend.start();