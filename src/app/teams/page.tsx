'use client';

import { useState, useEffect } from 'react';
import { 
 Users, 
 Plus, 
 Search, 
 Filter, 
 Settings, 
 GitBranch,
 Shield,
 Activity,
 ChevronRight,
 UserPlus,
 Mail,
 Calendar,
 Building,
 ExternalLink,
 MoreVertical,
 Edit,
 Trash2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
// Removed direct import of backstageService to avoid Node.js dependencies in client
// Using API routes instead
import { type Entity } from '@/lib/backstage/client';

interface TeamMember {
 name: string;
 email: string;
 role: string;
 avatar?: string;
 joinedAt: string;
}

interface Team {
 apiVersion: string;
 kind: string;
 metadata: {
 name: string;
 namespace?: string;
 title?: string;
 description?: string;
 tags?: string[];
 links?: Array<{
 url: string;
 title?: string;
 icon?: string;
 }>;
 };
 spec: {
 type: string;
 profile?: {
 displayName?: string;
 email?: string;
 picture?: string;
 };
 parent?: string;
 children?: string[];
 members?: string[];
 };
 relations?: Array<{
 type: string;
 targetRef: string;
 }>;
}

const TeamsPage = () => {
 const [teams, setTeams] = useState<Team[]>([]);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');
 const [filterType, setFilterType] = useState<string>('all');
 const [showCreateModal, setShowCreateModal] = useState(false);

 useEffect(() => {
 loadTeams();
 }, []);

 const loadTeams = async () => {
 try {
 setLoading(true);
 
 // Fetch groups from Backstage catalog
 const response = await fetch('/api/backstage/entities?kind=Group');
 if (!response.ok) {
 throw new Error('Failed to fetch teams');
 }
 const entities = await response.json();
 
 // Cast to Team type
 const teamEntities = entities as unknown as Team[];
 setTeams(teamEntities);
 } catch (error) {
 console.error('Failed to load teams:', error);
 toast.error('Failed to load teams');
 
 // Fallback to demo data
 setTeams(getDemoTeams());
 } finally {
 setLoading(false);
 }
 };

 const getDemoTeams = (): Team[] => {
 return [
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Group',
 metadata: {
 name: 'platform-team',
 namespace: 'default',
 title: 'Platform Team',
 description: 'Core platform and infrastructure team',
 tags: ['platform', 'infrastructure'],
 links: [
 { url: 'https://github.com/orgs/company/teams/platform', title: 'GitHub Team' },
 { url: 'https://slack.com/channels/platform', title: 'Slack Channel' }
 ]
 },
 spec: {
 type: 'team',
 profile: {
 displayName: 'Platform Team',
 email: 'platform@company.com',
 picture: 'https://avatars.githubusercontent.com/t/1?s=200'
 },
 members: ['user:default/john.doe', 'user:default/jane.smith', 'user:default/alice.johnson']
 }
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Group',
 metadata: {
 name: 'frontend-team',
 namespace: 'default',
 title: 'Frontend Team',
 description: 'Frontend development and UX team',
 tags: ['frontend', 'ux'],
 },
 spec: {
 type: 'team',
 profile: {
 displayName: 'Frontend Team',
 email: 'frontend@company.com',
 },
 members: ['user:default/bob.wilson', 'user:default/carol.davis']
 }
 },
 {
 apiVersion: 'backstage.io/v1alpha1',
 kind: 'Group',
 metadata: {
 name: 'data-team',
 namespace: 'default',
 title: 'Data Team',
 description: 'Data engineering and analytics team',
 tags: ['data', 'analytics'],
 },
 spec: {
 type: 'team',
 profile: {
 displayName: 'Data Team',
 email: 'data@company.com',
 },
 members: ['user:default/david.brown', 'user:default/eve.martin']
 }
 }
 ];
 };

 const filteredTeams = teams.filter(team => {
 const matchesSearch = searchQuery === '' || 
 team.metadata.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 team.metadata.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
 team.metadata.description?.toLowerCase().includes(searchQuery.toLowerCase());
 
 const matchesFilter = filterType === 'all' || 
 team.spec.type === filterType ||
 team.metadata.tags?.includes(filterType);
 
 return matchesSearch && matchesFilter;
 });

 const getMemberCount = (team: Team): number => {
 return team.spec.members?.length || 0;
 };

 const getServiceCount = (team: Team): number => {
 // In a real implementation, this would count owned services
 return Math.floor(Math.random() * 10) + 1;
 };

 const handleCreateTeam = () => {
 toast('Team creation will be implemented with Backstage scaffolder integration');
 setShowCreateModal(false);
 };

 const handleEditTeam = (team: Team) => {
 toast('Team editing will be implemented with Backstage API integration');
 };

 const handleDeleteTeam = (team: Team) => {
 toast('Team deletion will be implemented with Backstage API integration');
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
 Teams
 </h1>
 <p className="text-gray-600 dark:text-gray-400 mt-1">
 Manage teams and their members across your organization
 </p>
 </div>
 <button
 onClick={() => setShowCreateModal(true)}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Create Team
 </button>
 </div>

 {/* Filters */}
 <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
 <div className="flex flex-col md:flex-row gap-4">
 <div className="flex-1">
 <div className="relative">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 placeholder="Search teams..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 />
 </div>
 </div>
 <div className="flex items-center gap-4">
 <select
 value={filterType}
 onChange={(e) => setFilterType(e.target.value)}
 className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
 >
 <option value="all">All Types</option>
 <option value="team">Teams</option>
 <option value="department">Departments</option>
 <option value="squad">Squads</option>
 </select>
 </div>
 </div>
 </div>

 {/* Teams Grid */}
 {loading ? (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
 </div>
 ) : filteredTeams.length === 0 ? (
 <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
 <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
 <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
 No teams found
 </h3>
 <p className="text-gray-500 dark:text-gray-400">
 {searchQuery ? 'Try adjusting your search criteria' : 'Create your first team to get started'}
 </p>
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredTeams.map((team) => (
 <div
 key={`${team.metadata.namespace}/${team.metadata.name}`}
 className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
 >
 <div className="p-6">
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-3">
 {team.spec.profile?.picture ? (
 <img
 src={team.spec.profile.picture}
 alt={team.metadata.title || team.metadata.name}
 className="w-12 h-12 rounded-full"
 />
 ) : (
 <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
 <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
 </div>
 )}
 <div>
 <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
 {team.metadata.title || team.metadata.name}
 </h3>
 <p className="text-sm text-gray-500 dark:text-gray-400">
 {team.spec.type}
 </p>
 </div>
 </div>
 <div className="relative group">
 <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
 <MoreVertical className="w-4 h-4 text-gray-500" />
 </button>
 <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
 <button
 onClick={() => handleEditTeam(team)}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
 >
 <Edit className="w-4 h-4" />
 Edit Team
 </button>
 <button
 onClick={() => handleDeleteTeam(team)}
 className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-600"
 >
 <Trash2 className="w-4 h-4" />
 Delete Team
 </button>
 </div>
 </div>
 </div>

 <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
 {team.metadata.description || 'No description available'}
 </p>

 <div className="grid grid-cols-2 gap-4 mb-4">
 <div>
 <p className="text-sm text-gray-500 dark:text-gray-400">Members</p>
 <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 {getMemberCount(team)}
 </p>
 </div>
 <div>
 <p className="text-sm text-gray-500 dark:text-gray-400">Services</p>
 <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
 {getServiceCount(team)}
 </p>
 </div>
 </div>

 {team.metadata.tags && team.metadata.tags.length > 0 && (
 <div className="flex flex-wrap gap-2 mb-4">
 {team.metadata.tags.map((tag) => (
 <span
 key={tag}
 className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
 >
 {tag}
 </span>
 ))}
 </div>
 )}

 <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
 <div className="flex items-center gap-4">
 {team.metadata.links?.map((link, index) => (
 <a
 key={index}
 href={link.url}
 target="_blank"
 rel="noopener noreferrer"
 className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
 title={link.title}
 >
 <ExternalLink className="w-4 h-4" />
 </a>
 ))}
 </div>
 <Link
 href={`/teams/${team.metadata.namespace || 'default'}/${team.metadata.name}`}
 className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
 >
 View Details
 <ChevronRight className="w-4 h-4" />
 </Link>
 </div>
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Create Team Modal (Placeholder) */}
 {showCreateModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
 <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
 <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
 Create New Team
 </h2>
 <p className="text-gray-600 dark:text-gray-400 mb-6">
 Team creation will be implemented using Backstage scaffolder templates.
 This will allow you to create teams with proper governance and integration.
 </p>
 <div className="flex gap-3">
 <button
 onClick={() => setShowCreateModal(false)}
 className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
 >
 Cancel
 </button>
 <button
 onClick={handleCreateTeam}
 className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
 >
 Continue
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default TeamsPage;