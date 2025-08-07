'use client';
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, react-hooks/exhaustive-deps, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/role-supports-aria-props, jsx-a11y/no-autofocus, import/no-named-as-default-member, no-console, no-dupe-else-if, no-return-await, import/no-self-import */

import { ServiceComparison } from '@/components/catalog/ServiceComparison';

const ComparisonPage = () => {
 return (
 <div className="container mx-auto px-4 py-6">
 <div className="mb-6">
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Service Comparison
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 Compare multiple services side by side to analyze their performance and characteristics.
 </p>
 </div>
 
 <ServiceComparison embedded={true} />
 </div>
 );
};

export default ComparisonPage;