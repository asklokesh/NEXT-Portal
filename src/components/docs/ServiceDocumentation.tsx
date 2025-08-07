'use client';

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions, react-hooks/exhaustive-deps */

// Removed date-fns import - using native JavaScript date formatting instead
import { motion, AnimatePresence } from 'framer-motion';
import {
 FileText,
 BookOpen,
 Code,
 ExternalLink,
 Search,
 Download,
 Edit,
 Star,
 Clock,
 Users,
 Tag,
 ChevronRight,
 ChevronDown,
 Folder,
 FolderOpen,
 File,
 Eye,
 GitBranch,
 History,
 Share2,
 Copy,
 Check
} from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface DocumentSection {
 id: string;
 title: string;
 content: string;
 type: 'markdown' | 'api' | 'tutorial' | 'reference';
 level: number;
 children?: DocumentSection[];
 lastUpdated: string;
 author: string;
 tags: string[];
}

interface DocumentationFile {
 id: string;
 name: string;
 path: string;
 type: 'file' | 'folder';
 size?: number;
 lastModified: string;
 author: string;
 children?: DocumentationFile[];
}

interface ServiceDocumentationProps {
 serviceRef: string;
 embedded?: boolean;
}

export const ServiceDocumentation = ({ serviceRef, embedded = false }: ServiceDocumentationProps) => {
 const [documentation, setDocumentation] = useState<DocumentSection[]>([]);
 const [fileStructure, setFileStructure] = useState<DocumentationFile[]>([]);
 const [selectedSection, setSelectedSection] = useState<DocumentSection | null>(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [loading, setLoading] = useState(true);
 const [view, setView] = useState<'content' | 'files' | 'api'>('content');
 const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
 const [copied, setCopied] = useState(false);

 useEffect(() => {
 loadDocumentation();
 }, [serviceRef]);

 const loadDocumentation = async () => {
 try {
 setLoading(true);
 
 // Generate mock documentation
 const mockDocs = generateMockDocumentation(serviceRef);
 setDocumentation(mockDocs.sections);
 setFileStructure(mockDocs.files);
 
 if (mockDocs.sections.length > 0) {
 setSelectedSection(mockDocs.sections[0]);
 }
 } catch (error) {
 console.error('Failed to load documentation:', error);
 toast.error('Failed to load documentation');
 } finally {
 setLoading(false);
 }
 };

 const generateMockDocumentation = (service: string) => {
 const serviceName = service.split('/').pop() || 'service';
 
 const sections: DocumentSection[] = [
 {
 id: 'overview',
 title: 'Overview',
 content: `# ${serviceName} Service\n\nThe ${serviceName} is a critical component of our platform that handles user authentication, authorization, and profile management.\n\n## Key Features\n\n- User registration and login\n- JWT token management\n- Role-based access control\n- Profile management\n- Password reset functionality\n\n## Architecture\n\nThe service follows a microservices architecture pattern with the following components:\n\n- **API Gateway**: Routes requests to appropriate handlers\n- **Authentication Service**: Handles login/logout operations\n- **User Repository**: Manages user data persistence\n- **Token Service**: JWT token generation and validation`,
 type: 'markdown',
 level: 1,
 lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
 author: 'tech-lead@company.com',
 tags: ['overview', 'architecture']
 },
 {
 id: 'getting-started',
 title: 'Getting Started',
 content: `# Getting Started\n\n## Prerequisites\n\n- Node.js 18+\n- PostgreSQL 14+\n- Redis 6+\n\n## Installation\n\n\`\`\`bash\n# Clone the repository\ngit clone https://github.com/company/${serviceName}.git\n\n# Install dependencies\nnpm install\n\n# Set up environment variables\ncp .env.example .env\n\n# Run database migrations\nnpm run migrate\n\n# Start the service\nnpm start\n\`\`\`\n\n## Configuration\n\nThe service uses environment variables for configuration:\n\n- \`DATABASE_URL\`: PostgreSQL connection string\n- \`REDIS_URL\`: Redis connection string\n- \`JWT_SECRET\`: Secret key for JWT tokens\n- \`PORT\`: Service port (default: 3000)`,
 type: 'tutorial',
 level: 1,
 lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
 author: 'developer@company.com',
 tags: ['setup', 'installation', 'configuration']
 },
 {
 id: 'api-reference',
 title: 'API Reference',
 content: `# API Reference\n\n## Authentication Endpoints\n\n### POST /auth/login\n\nAuthenticate a user and return a JWT token.\n\n**Request Body:**\n\`\`\`json\n{\n "email": "user@example.com",\n "password": "password123"\n}\n\`\`\`\n\n**Response:**\n\`\`\`json\n{\n "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",\n "user": {\n "id": "123",\n "email": "user@example.com",\n "name": "John Doe"\n }\n}\n\`\`\`\n\n### POST /auth/register\n\nRegister a new user account.\n\n**Request Body:**\n\`\`\`json\n{\n "email": "user@example.com",\n "password": "password123",\n "name": "John Doe"\n}\n\`\`\`\n\n### GET /auth/me\n\nGet current user information (requires authentication).\n\n**Headers:**\n\`\`\`\nAuthorization: Bearer <token>\n\`\`\``,
 type: 'api',
 level: 1,
 lastUpdated: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
 author: 'api-team@company.com',
 tags: ['api', 'endpoints', 'authentication']
 },
 {
 id: 'deployment',
 title: 'Deployment Guide',
 content: `# Deployment Guide\n\n## Docker Deployment\n\n### Build Image\n\n\`\`\`bash\ndocker build -t ${serviceName}:latest .\n\`\`\`\n\n### Run Container\n\n\`\`\`bash\ndocker run -d \\\n --name ${serviceName} \\\n -p 3000:3000 \\\n -e DATABASE_URL=postgresql://... \\\n -e REDIS_URL=redis://... \\\n ${serviceName}:latest\n\`\`\`\n\n## Kubernetes Deployment\n\n\`\`\`yaml\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n name: ${serviceName}\nspec:\n replicas: 3\n selector:\n matchLabels:\n app: ${serviceName}\n template:\n metadata:\n labels:\n app: ${serviceName}\n spec:\n containers:\n - name: ${serviceName}\n image: ${serviceName}:latest\n ports:\n - containerPort: 3000\n env:\n - name: DATABASE_URL\n valueFrom:\n secretKeyRef:\n name: db-secret\n key: url\n\`\`\`\n\n## Environment Variables\n\n| Variable | Description | Required |\n|----------|-------------|----------|\n| DATABASE_URL | PostgreSQL connection string | Yes |\n| REDIS_URL | Redis connection string | Yes |\n| JWT_SECRET | JWT signing secret | Yes |\n| PORT | Service port | No (default: 3000) |`,
 type: 'reference',
 level: 1,
 lastUpdated: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
 author: 'devops@company.com',
 tags: ['deployment', 'docker', 'kubernetes']
 }
 ];

 const files: DocumentationFile[] = [
 {
 id: 'docs',
 name: 'docs',
 path: '/docs',
 type: 'folder',
 lastModified: new Date().toISOString(),
 author: 'system',
 children: [
 {
 id: 'readme',
 name: 'README.md',
 path: '/docs/README.md',
 type: 'file',
 size: 2048,
 lastModified: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
 author: 'tech-lead@company.com'
 },
 {
 id: 'api',
 name: 'api',
 path: '/docs/api',
 type: 'folder',
 lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
 author: 'api-team@company.com',
 children: [
 {
 id: 'openapi',
 name: 'openapi.yaml',
 path: '/docs/api/openapi.yaml',
 type: 'file',
 size: 15360,
 lastModified: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
 author: 'api-team@company.com'
 },
 {
 id: 'examples',
 name: 'examples.md',
 path: '/docs/api/examples.md',
 type: 'file',
 size: 8192,
 lastModified: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
 author: 'developer@company.com'
 }
 ]
 },
 {
 id: 'guides',
 name: 'guides',
 path: '/docs/guides',
 type: 'folder',
 lastModified: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
 author: 'tech-writer@company.com',
 children: [
 {
 id: 'setup',
 name: 'setup.md',
 path: '/docs/guides/setup.md',
 type: 'file',
 size: 4096,
 lastModified: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
 author: 'developer@company.com'
 },
 {
 id: 'deployment',
 name: 'deployment.md',
 path: '/docs/guides/deployment.md',
 type: 'file',
 size: 6144,
 lastModified: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
 author: 'devops@company.com'
 }
 ]
 }
 ]
 },
 {
 id: 'changelog',
 name: 'CHANGELOG.md',
 path: '/CHANGELOG.md',
 type: 'file',
 size: 3072,
 lastModified: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
 author: 'release-bot@company.com'
 }
 ];

 return { sections, files };
 };

 const filteredSections = documentation.filter(section =>
 section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
 section.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
 section.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
 );

 const toggleFolder = (folderId: string) => {
 const newExpanded = new Set(expandedFolders);
 if (newExpanded.has(folderId)) {
 newExpanded.delete(folderId);
 } else {
 newExpanded.add(folderId);
 }
 setExpandedFolders(newExpanded);
 };

 const renderFileTree = (files: DocumentationFile[], level = 0) => {
 return files.map(file => (
 <div key={file.id} className={`${level > 0 ? 'ml-4' : ''}`}>
 <div
 className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
 onClick={() => file.type === 'folder' ? toggleFolder(file.id) : null}
 >
 {file.type === 'folder' ? (
 <>
 {expandedFolders.has(file.id) ? (
 <ChevronDown className="w-4 h-4" />
 ) : (
 <ChevronRight className="w-4 h-4" />
 )}
 {expandedFolders.has(file.id) ? (
 <FolderOpen className="w-4 h-4 text-blue-600" />
 ) : (
 <Folder className="w-4 h-4 text-blue-600" />
 )}
 </>
 ) : (
 <>
 <div className="w-4" />
 <File className="w-4 h-4 text-gray-600" />
 </>
 )}
 <span className="text-sm text-gray-900 dark:text-gray-100">{file.name}</span>
 {file.size && (
 <span className="text-xs text-gray-500 ml-auto">
 {(file.size / 1024).toFixed(1)}KB
 </span>
 )}
 </div>
 {file.type === 'folder' && file.children && expandedFolders.has(file.id) && (
 <div className="ml-2">
 {renderFileTree(file.children, level + 1)}
 </div>
 )}
 </div>
 ));
 };

 const handleShare = async () => {
 try {
 await navigator.share({
 title: `${serviceRef} Documentation`,
 url: window.location.href
 });
 } catch (err) {
 // Fallback to copying URL
 navigator.clipboard.writeText(window.location.href);
 toast.success('Documentation URL copied to clipboard');
 }
 };

 const handleCopyContent = async () => {
 if (selectedSection) {
 await navigator.clipboard.writeText(selectedSection.content);
 setCopied(true);
 setTimeout(() => setCopied(false), 2000);
 toast.success('Content copied to clipboard');
 }
 };

 if (loading) {
 return (
 <div className="flex items-center justify-center h-96">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 );
 }

 const containerClass = embedded 
 ? "space-y-4" 
 : "min-h-screen bg-gray-50 dark:bg-gray-900";

 return (
 <div className={containerClass}>
 {!embedded && (
 <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Service Documentation
 </h1>
 <p className="text-gray-600 dark:text-gray-400">
 {serviceRef.split('/').pop()} service documentation and guides
 </p>
 </div>
 
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
 <button
 onClick={() => setView('content')}
 className={`px-3 py-1 text-sm rounded ${view === 'content' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Content
 </button>
 <button
 onClick={() => setView('files')}
 className={`px-3 py-1 text-sm rounded ${view === 'files' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 Files
 </button>
 <button
 onClick={() => setView('api')}
 className={`px-3 py-1 text-sm rounded ${view === 'api' ? 'bg-white dark:bg-gray-600 shadow' : ''}`}
 >
 API
 </button>
 </div>
 
 <button
 onClick={handleShare}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Share documentation"
 >
 <Share2 className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Search */}
 <div className="mt-4 relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
 <input
 type="text"
 placeholder="Search documentation..."
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
 />
 </div>
 </div>
 )}

 <div className={`flex ${embedded ? '' : 'h-screen'}`}>
 {/* Sidebar */}
 <div className={`${embedded ? 'w-80' : 'w-80'} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto`}>
 {view === 'content' && (
 <div className="p-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Table of Contents
 </h3>
 <div className="space-y-2">
 {filteredSections.map(section => (
 <div
 key={section.id}
 onClick={() => setSelectedSection(section)}
 className={`p-3 rounded-lg cursor-pointer transition-colors ${
 selectedSection?.id === section.id
 ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
 : 'hover:bg-gray-50 dark:hover:bg-gray-700'
 }`}
 >
 <div className="flex items-start gap-3">
 <div className={`p-1 rounded ${getTypeColor(section.type)}`}>
 {getTypeIcon(section.type)}
 </div>
 <div className="flex-1">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">
 {section.title}
 </h4>
 <div className="flex items-center gap-2 mt-1">
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {new Date(section.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}
 </span>
 <span className="text-xs text-gray-500 dark:text-gray-400">•</span>
 <span className="text-xs text-gray-500 dark:text-gray-400">
 {section.author.split('@')[0]}
 </span>
 </div>
 <div className="flex flex-wrap gap-1 mt-2">
 {section.tags.slice(0, 2).map(tag => (
 <span
 key={tag}
 className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 {tag}
 </span>
 ))}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {view === 'files' && (
 <div className="p-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Documentation Files
 </h3>
 <div className="space-y-1">
 {renderFileTree(fileStructure)}
 </div>
 </div>
 )}

 {view === 'api' && (
 <div className="p-4">
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
 API Reference
 </h3>
 <div className="space-y-2">
 <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">OpenAPI Spec</h4>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Complete API specification
 </p>
 <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm">
 View Spec
 </button>
 </div>
 
 <div className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
 <h4 className="font-medium text-gray-900 dark:text-gray-100">Postman Collection</h4>
 <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
 Import into Postman for testing
 </p>
 <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm">
 Download
 </button>
 </div>
 </div>
 </div>
 )}
 </div>

 {/* Main Content */}
 <div className="flex-1 overflow-y-auto">
 {selectedSection ? (
 <div className="p-6">
 <div className="flex items-center justify-between mb-6">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
 {selectedSection.title}
 </h1>
 <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
 <div className="flex items-center gap-1">
 <Clock className="w-4 h-4" />
 Last updated {new Date(selectedSection.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
 </div>
 <div className="flex items-center gap-1">
 <Users className="w-4 h-4" />
 {selectedSection.author.split('@')[0]}
 </div>
 </div>
 </div>
 
 <div className="flex items-center gap-2">
 <button
 onClick={handleCopyContent}
 className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
 title="Copy content"
 >
 {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
 </button>
 <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
 <Edit className="w-4 h-4" />
 </button>
 <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
 <ExternalLink className="w-4 h-4" />
 </button>
 </div>
 </div>

 {/* Tags */}
 <div className="flex flex-wrap gap-2 mb-6">
 {selectedSection.tags.map(tag => (
 <span
 key={tag}
 className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 <Tag className="w-3 h-3" />
 {tag}
 </span>
 ))}
 </div>

 {/* Content */}
 <div className="prose dark:prose-invert max-w-none">
 <pre className="whitespace-pre-wrap text-gray-900 dark:text-gray-100 leading-relaxed">
 {selectedSection.content}
 </pre>
 </div>
 </div>
 ) : (
 <div className="flex items-center justify-center h-full">
 <div className="text-center">
 <BookOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 Select Documentation
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 Choose a section from the sidebar to view its content.
 </p>
 </div>
 </div>
 )}
 </div>
 </div>
 </div>
 );
}

function getTypeIcon(type: string) {
 switch (type) {
 case 'api': return <Code className="w-3 h-3" />;
 case 'tutorial': return <BookOpen className="w-3 h-3" />;
 case 'reference': return <FileText className="w-3 h-3" />;
 default: return <FileText className="w-3 h-3" />;
 }
}

function getTypeColor(type: string) {
 switch (type) {
 case 'api': return 'text-blue-600 bg-blue-100 dark:bg-blue-900 dark:text-blue-300';
 case 'tutorial': return 'text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300';
 case 'reference': return 'text-purple-600 bg-purple-100 dark:bg-purple-900 dark:text-purple-300';
 default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-300';
 }
}