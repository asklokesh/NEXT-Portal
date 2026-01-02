'use client';

import React, { useState } from 'react';
import { 
  Github, 
  Gitlab, 
  Box, 
  Container, 
  Database,
  Cloud,
  LayoutGrid,
  Settings,
  CheckCircle,
  AlertTriangle,
  Plus,
  ArrowRight
} from 'lucide-react';
import { motion } from 'framer-motion';

// Mock data (will be real later)
const AVAILABLE_INTEGRATIONS = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Sync Repositories, Teams, and Actions',
    icon: Github,
    category: 'VCS',
    color: 'bg-black text-white'
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Pipeline status and Repo discovery',
    icon: Gitlab,
    category: 'VCS',
    color: 'bg-orange-600 text-white'
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    description: 'Multi-cluster visibility and health',
    icon: Container,
    category: 'Infrastructure',
    color: 'bg-blue-600 text-white'
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Issue tracking and project management',
    icon: LayoutGrid,
    category: 'Project Mgmt',
    color: 'bg-blue-500 text-white'
  },
  {
    id: 'harness',
    name: 'Harness',
    description: 'CI/CD Pipelines and Feature Flags',
    icon: ArrowRight,
    category: 'CI/CD',
    color: 'bg-blue-400 text-white'
  },
  {
    id: 'argocd',
    name: 'ArgoCD',
    description: 'GitOps application status',
    icon: Box,
    category: 'CD',
    color: 'bg-orange-500 text-white'
  },
  {
    id: 'aws',
    name: 'AWS',
    description: 'Cloud resources and cost tracking',
    icon: Cloud,
    category: 'Cloud',
    color: 'bg-yellow-500 text-black'
  },
  {
    id: 'servicenow',
    name: 'ServiceNow',
    description: 'ITSM and Change Management',
    icon: Database,
    category: 'ITSM',
    color: 'bg-green-700 text-white'
  }
];

export default function IntegrationsPage() {
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeIntegrations, setActiveIntegrations] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // Load existing integrations
  React.useEffect(() => {
    fetch('/api/integrations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setActiveIntegrations(data);
      })
      .catch(err => console.error(err));
  }, []);

  const handleConnect = async (formData: any) => {
    setIsConnecting(true);
    try {
      const res = await fetch('/api/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider.id.toUpperCase(),
          name: `${selectedProvider.name} Integration`,
          credentials: formData
        })
      });
      
      if (res.ok) {
        const newInt = await res.json();
        setActiveIntegrations(prev => [newInt, ...prev]);
        setIsModalOpen(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsConnecting(false);
    }
  };

  const openConnectModal = (integration: any) => {
    setSelectedProvider(integration);
    setIsModalOpen(true);
  };

  const isConnected = (id: string) => activeIntegrations.some(i => i.provider === id.toUpperCase());

  const filteredIntegrations = AVAILABLE_INTEGRATIONS.filter(integration => {
    const matchesCategory = filter === 'All' || integration.category === filter;
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = ['All', ...Array.from(new Set(AVAILABLE_INTEGRATIONS.map(i => i.category)))];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          Integration Hub
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-lg">
          Connect your tools to automatically populate your catalog and dashboards.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 w-full sm:w-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filter === cat
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        
        <div className="relative w-full sm:w-64">
           <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
           />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredIntegrations.map((integration, idx) => (
          <motion.div
            key={integration.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => openConnectModal(integration)}
            className={`group relative bg-white dark:bg-gray-800 rounded-2xl p-6 border transition-all duration-300 cursor-pointer ${
              isConnected(integration.id) 
                ? 'border-green-500 ring-1 ring-green-500 shadow-md' 
                : 'border-gray-200 dark:border-gray-700 hover:shadow-xl hover:-translate-y-1'
            }`}
          >
            {/* Icon Header */}
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl ${integration.color} shadow-lg`}>
                <integration.icon className="w-8 h-8" />
              </div>
               {isConnected(integration.id) ? (
                 <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold bg-green-100 text-green-700 rounded-full">
                   <CheckCircle className="w-3 h-3" /> Active
                 </span>
               ) : (
                <span className="px-2 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400">
                  {integration.category}
                </span>
               )}
            </div>

            {/* Content */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {integration.name}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6 line-clamp-2">
              {integration.description}
            </p>

            {/* Action Area */}
            <div className="flex items-center justify-between mt-auto">
               <span className="text-xs text-green-600 font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 {isConnected(integration.id) ? 'Manage Configuration' : 'Click to Connect'}
               </span>
               <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                 isConnected(integration.id) ? 'bg-green-100 text-green-600' : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-600 group-hover:text-white'
               }`}>
                 <ArrowRight className="w-4 h-4" />
               </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Connection Modal */}
      {isModalOpen && selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <selectedProvider.icon className="w-6 h-6" />
              Connect {selectedProvider.name}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Enter your API Token or Credentials to enable <strong>{selectedProvider.name}</strong> integration.
            </p>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleConnect({ token: formData.get('token') });
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">API Token / key</label>
                  <input 
                    name="token"
                    type="password" 
                    required
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder={`e.g. ${selectedProvider.id}_pat_...`}
                  />
                </div>
                
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isConnecting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    {isConnecting ? 'Verifying...' : 'Connect & Sync'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}