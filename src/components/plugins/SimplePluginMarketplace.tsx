'use client';

import React from 'react';
import { Package } from 'lucide-react';

export function SimplePluginMarketplace() {
 return (
 <div className="p-8">
 <div className="max-w-7xl mx-auto">
 <div className="flex items-center gap-3 mb-8">
 <Package className="h-8 w-8 text-blue-600" />
 <h1 className="text-3xl font-bold text-gray-900">Plugin Marketplace</h1>
 </div>
 
 <div className="bg-white rounded-lg shadow-sm border p-6">
 <h2 className="text-xl font-semibold mb-4">Available Plugins</h2>
 <p className="text-gray-600">
 The plugin marketplace is loading. Please check your browser console for any errors.
 </p>
 
 <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {/* Mock plugin cards */}
 <div className="border rounded-lg p-4">
 <h3 className="font-semibold">Kubernetes Plugin</h3>
 <p className="text-sm text-gray-600 mt-1">
 View and manage Kubernetes resources
 </p>
 <div className="mt-3">
 <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
 Infrastructure
 </span>
 </div>
 </div>
 
 <div className="border rounded-lg p-4">
 <h3 className="font-semibold">GitHub Actions Plugin</h3>
 <p className="text-sm text-gray-600 mt-1">
 View and trigger GitHub Actions workflows
 </p>
 <div className="mt-3">
 <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
 CI/CD
 </span>
 </div>
 </div>
 
 <div className="border rounded-lg p-4">
 <h3 className="font-semibold">SonarQube Plugin</h3>
 <p className="text-sm text-gray-600 mt-1">
 Code quality metrics and analysis
 </p>
 <div className="mt-3">
 <span className="inline-block bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded">
 Monitoring
 </span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
}
