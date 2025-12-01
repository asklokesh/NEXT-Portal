/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

// New Entity Components
export { EntityCard } from './EntityCard';
export { EntitySearch } from './EntitySearch';

// Existing exports
export { CatalogLayout } from './CatalogLayout';
export { ServiceCard } from './CatalogGrid/ServiceCard';
export { GridContainer } from './CatalogGrid/GridContainer';
export { ServiceTable } from './CatalogList/ServiceTable';
export { SearchBar } from './Search/SearchBar';
export { FilterPanel } from './Search/FilterPanel';
export { BulkActionsBar } from './common/BulkActionsBar';
export { ViewToggle } from './common/ViewToggle';
export * from './types';

// Re-export entity types
export type {
  Entity,
  EntityKind,
  EntityRef,
  EntitySearchQuery,
  EntitySearchResults,
  EntityGraph,
  ComponentEntity,
  ApiEntity,
  SystemEntity,
  GroupEntity,
} from '@/services/catalog/entity-types';