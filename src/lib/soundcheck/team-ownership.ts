/**
 * Soundcheck Team and Ownership Tracking
 * Track team ownership, responsibilities, and quality metrics
 */

import {
 SoundcheckEntity,
 QualityAssessment,
 QualityCertification
} from '@/types/soundcheck';
import { soundcheckEngine } from './soundcheck-engine';

export interface Team {
 id: string;
 name: string;
 description?: string;
 email?: string;
 slackChannel?: string;
 members: TeamMember[];
 responsibilities: {
 ownedEntities: string[];
 supportedEntities: string[];
 onCallRotation?: OnCallRotation;
 };
 metadata: {
 department?: string;
 location?: string;
 tags?: string[];
 createdAt: string;
 updatedAt: string;
 };
}

export interface TeamMember {
 id: string;
 name: string;
 email: string;
 role: 'lead' | 'member' | 'contributor';
 githubUsername?: string;
 slackId?: string;
 joinedAt: string;
}

export interface OnCallRotation {
 schedule: 'weekly' | 'biweekly' | 'monthly';
 currentOnCall: string; // member ID
 nextRotation: string; // ISO date
 members: string[]; // member IDs in rotation
}

export interface TeamMetrics {
 teamId: string;
 period: string; // e.g., "2024-01"
 ownership: {
 totalEntities: number;
 activeEntities: number;
 archivedEntities: number;
 newEntitiesAdded: number;
 };
 quality: {
 averageScore: number;
 scoreDistribution: Record<string, number>; // score ranges
 topPerformers: Array<{ entityId: string; score: number }>;
 needsAttention: Array<{ entityId: string; score: number; issues: string[] }>;
 };
 compliance: {
 policiesApplied: number;
 complianceRate: number;
 violations: number;
 criticalViolations: number;
 };
 certifications: {
 total: number;
 byLevel: Record<string, number>;
 expiringSoon: number;
 recentlyAchieved: Array<{ entityId: string; level: string; date: string }>;
 };
 trends: {
 scoreChange: number; // percentage
 complianceChange: number;
 newIssues: number;
 resolvedIssues: number;
 };
}

export interface OwnershipChange {
 id: string;
 entityId: string;
 entityName: string;
 previousOwner?: string;
 newOwner: string;
 reason?: string;
 changedBy: string;
 changedAt: string;
 approved: boolean;
 approvedBy?: string;
}

export interface TeamComparison {
 teams: string[];
 metrics: {
 averageScores: Record<string, number>;
 complianceRates: Record<string, number>;
 entityCounts: Record<string, number>;
 certificationCounts: Record<string, number>;
 };
 rankings: {
 quality: Array<{ teamId: string; score: number; rank: number }>;
 compliance: Array<{ teamId: string; rate: number; rank: number }>;
 certifications: Array<{ teamId: string; count: number; rank: number }>;
 };
}

export class TeamOwnershipService {
 private teams: Map<string, Team> = new Map();
 private ownershipHistory: OwnershipChange[] = [];
 private teamMetrics: Map<string, TeamMetrics[]> = new Map();

 constructor() {
 this.initializeDefaultTeams();
 }

 /**
 * Initialize default teams
 */
 private initializeDefaultTeams(): void {
 const defaultTeams: Team[] = [
 {
 id: 'platform-team',
 name: 'Platform Team',
 description: 'Central platform engineering team',
 email: 'platform@company.com',
 slackChannel: '#platform-team',
 members: [
 {
 id: 'john-doe',
 name: 'John Doe',
 email: 'john.doe@company.com',
 role: 'lead',
 githubUsername: 'johndoe',
 slackId: 'U123456',
 joinedAt: '2023-01-15T00:00:00Z'
 },
 {
 id: 'jane-smith',
 name: 'Jane Smith',
 email: 'jane.smith@company.com',
 role: 'member',
 githubUsername: 'janesmith',
 slackId: 'U789012',
 joinedAt: '2023-03-20T00:00:00Z'
 }
 ],
 responsibilities: {
 ownedEntities: ['backstage-core', 'idp-platform', 'ci-cd-pipeline'],
 supportedEntities: ['monitoring-stack', 'logging-infrastructure'],
 onCallRotation: {
 schedule: 'weekly',
 currentOnCall: 'john-doe',
 nextRotation: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
 members: ['john-doe', 'jane-smith']
 }
 },
 metadata: {
 department: 'Engineering',
 location: 'San Francisco',
 tags: ['platform', 'infrastructure', 'devops'],
 createdAt: '2023-01-01T00:00:00Z',
 updatedAt: new Date().toISOString()
 }
 },
 {
 id: 'security-team',
 name: 'Security Team',
 description: 'Application and infrastructure security',
 email: 'security@company.com',
 slackChannel: '#security',
 members: [
 {
 id: 'alice-security',
 name: 'Alice Johnson',
 email: 'alice.johnson@company.com',
 role: 'lead',
 githubUsername: 'alicej',
 slackId: 'U345678',
 joinedAt: '2022-11-01T00:00:00Z'
 }
 ],
 responsibilities: {
 ownedEntities: ['security-scanner', 'vault-integration', 'auth-service'],
 supportedEntities: ['api-gateway', 'user-service']
 },
 metadata: {
 department: 'Security',
 location: 'New York',
 tags: ['security', 'compliance', 'governance'],
 createdAt: '2022-11-01T00:00:00Z',
 updatedAt: new Date().toISOString()
 }
 },
 {
 id: 'frontend-team',
 name: 'Frontend Team',
 description: 'User interface and experience team',
 email: 'frontend@company.com',
 slackChannel: '#frontend',
 members: [
 {
 id: 'bob-ui',
 name: 'Bob Wilson',
 email: 'bob.wilson@company.com',
 role: 'lead',
 githubUsername: 'bobw',
 slackId: 'U567890',
 joinedAt: '2023-02-01T00:00:00Z'
 },
 {
 id: 'carol-ux',
 name: 'Carol Davis',
 email: 'carol.davis@company.com',
 role: 'member',
 githubUsername: 'carold',
 slackId: 'U234567',
 joinedAt: '2023-04-15T00:00:00Z'
 }
 ],
 responsibilities: {
 ownedEntities: ['web-portal', 'mobile-app', 'design-system'],
 supportedEntities: ['admin-dashboard']
 },
 metadata: {
 department: 'Product',
 location: 'Remote',
 tags: ['frontend', 'ui', 'ux', 'design'],
 createdAt: '2023-02-01T00:00:00Z',
 updatedAt: new Date().toISOString()
 }
 }
 ];

 defaultTeams.forEach(team => this.teams.set(team.id, team));
 }

 /**
 * Create a new team
 */
 createTeam(team: Team): Team {
 if (this.teams.has(team.id)) {
 throw new Error(`Team with ID ${team.id} already exists`);
 }

 team.metadata.createdAt = new Date().toISOString();
 team.metadata.updatedAt = team.metadata.createdAt;

 this.teams.set(team.id, team);
 return team;
 }

 /**
 * Update team information
 */
 updateTeam(teamId: string, updates: Partial<Team>): Team {
 const team = this.teams.get(teamId);
 if (!team) {
 throw new Error(`Team ${teamId} not found`);
 }

 const updatedTeam = {
 ...team,
 ...updates,
 id: teamId, // Ensure ID cannot be changed
 metadata: {
 ...team.metadata,
 ...updates.metadata,
 updatedAt: new Date().toISOString()
 }
 };

 this.teams.set(teamId, updatedTeam);
 return updatedTeam;
 }

 /**
 * Get team by ID
 */
 getTeam(teamId: string): Team | undefined {
 return this.teams.get(teamId);
 }

 /**
 * Get all teams
 */
 getAllTeams(): Team[] {
 return Array.from(this.teams.values());
 }

 /**
 * Get team by entity ownership
 */
 getTeamByEntity(entityId: string): Team | undefined {
 for (const team of this.teams.values()) {
 if (team.responsibilities.ownedEntities.includes(entityId)) {
 return team;
 }
 }
 return undefined;
 }

 /**
 * Add team member
 */
 addTeamMember(teamId: string, member: TeamMember): void {
 const team = this.teams.get(teamId);
 if (!team) {
 throw new Error(`Team ${teamId} not found`);
 }

 // Check if member already exists
 if (team.members.some(m => m.id === member.id)) {
 throw new Error(`Member ${member.id} already in team`);
 }

 team.members.push(member);
 team.metadata.updatedAt = new Date().toISOString();
 }

 /**
 * Remove team member
 */
 removeTeamMember(teamId: string, memberId: string): void {
 const team = this.teams.get(teamId);
 if (!team) {
 throw new Error(`Team ${teamId} not found`);
 }

 team.members = team.members.filter(m => m.id !== memberId);
 team.metadata.updatedAt = new Date().toISOString();

 // Update on-call rotation if needed
 if (team.responsibilities.onCallRotation) {
 team.responsibilities.onCallRotation.members = 
 team.responsibilities.onCallRotation.members.filter(id => id !== memberId);
 
 if (team.responsibilities.onCallRotation.currentOnCall === memberId) {
 // Rotate to next person
 this.rotateOnCall(teamId);
 }
 }
 }

 /**
 * Transfer entity ownership
 */
 async transferOwnership(
 entityId: string,
 newTeamId: string,
 reason?: string,
 changedBy: string = 'system'
 ): Promise<OwnershipChange> {
 const newTeam = this.teams.get(newTeamId);
 if (!newTeam) {
 throw new Error(`Team ${newTeamId} not found`);
 }

 // Find current owner
 let previousOwner: string | undefined;
 for (const team of this.teams.values()) {
 const index = team.responsibilities.ownedEntities.indexOf(entityId);
 if (index !== -1) {
 previousOwner = team.id;
 team.responsibilities.ownedEntities.splice(index, 1);
 team.metadata.updatedAt = new Date().toISOString();
 break;
 }
 }

 // Add to new team
 if (!newTeam.responsibilities.ownedEntities.includes(entityId)) {
 newTeam.responsibilities.ownedEntities.push(entityId);
 newTeam.metadata.updatedAt = new Date().toISOString();
 }

 // Record ownership change
 const change: OwnershipChange = {
 id: `ownership-change-${Date.now()}`,
 entityId,
 entityName: entityId, // In real implementation, would fetch entity name
 previousOwner,
 newOwner: newTeamId,
 reason,
 changedBy,
 changedAt: new Date().toISOString(),
 approved: true, // Auto-approve for now
 approvedBy: changedBy
 };

 this.ownershipHistory.push(change);
 return change;
 }

 /**
 * Calculate team metrics
 */
 async calculateTeamMetrics(
 teamId: string,
 period: string = new Date().toISOString().substring(0, 7) // YYYY-MM
 ): Promise<TeamMetrics> {
 const team = this.teams.get(teamId);
 if (!team) {
 throw new Error(`Team ${teamId} not found`);
 }

 const ownedEntities = team.responsibilities.ownedEntities;
 
 // Quality metrics
 let totalScore = 0;
 let assessedEntities = 0;
 const scoreDistribution: Record<string, number> = {
 '90-100': 0,
 '80-89': 0,
 '70-79': 0,
 '60-69': 0,
 '0-59': 0
 };
 const topPerformers: Array<{ entityId: string; score: number }> = [];
 const needsAttention: Array<{ entityId: string; score: number; issues: string[] }> = [];

 // Analyze each owned entity
 for (const entityId of ownedEntities) {
 const assessment = soundcheckEngine.getLatestAssessment(entityId);
 if (assessment) {
 totalScore += assessment.overallScore;
 assessedEntities++;

 // Update score distribution
 if (assessment.overallScore >= 90) scoreDistribution['90-100']++;
 else if (assessment.overallScore >= 80) scoreDistribution['80-89']++;
 else if (assessment.overallScore >= 70) scoreDistribution['70-79']++;
 else if (assessment.overallScore >= 60) scoreDistribution['60-69']++;
 else scoreDistribution['0-59']++;

 // Track top performers and entities needing attention
 if (assessment.overallScore >= 95) {
 topPerformers.push({ entityId, score: assessment.overallScore });
 } else if (assessment.overallScore < 70) {
 const criticalIssues = assessment.checkResults
 .filter(r => r.status === 'fail')
 .map(r => soundcheckEngine.getCheck(r.checkId)?.name || 'Unknown check')
 .slice(0, 3);
 
 needsAttention.push({
 entityId,
 score: assessment.overallScore,
 issues: criticalIssues
 });
 }
 }
 }

 const averageScore = assessedEntities > 0 ? Math.round(totalScore / assessedEntities) : 0;

 // Sort top performers and limit to top 5
 topPerformers.sort((a, b) => b.score - a.score);
 const top5Performers = topPerformers.slice(0, 5);

 // Compliance metrics (simplified for now)
 const complianceRate = averageScore >= 70 ? 85 : 60;
 const violations = Math.floor((100 - complianceRate) / 10);
 const criticalViolations = Math.floor(violations / 3);

 // Certification metrics (simplified for now)
 const certificationsByLevel = {
 platinum: topPerformers.filter(p => p.score >= 98).length,
 gold: topPerformers.filter(p => p.score >= 95 && p.score < 98).length,
 silver: Math.floor(scoreDistribution['80-89'] * 0.7),
 bronze: Math.floor(scoreDistribution['70-79'] * 0.5)
 };

 // Calculate trends (simplified - would compare with previous period)
 const previousMetrics = this.teamMetrics.get(teamId)?.slice(-1)[0];
 const scoreChange = previousMetrics 
 ? ((averageScore - previousMetrics.quality.averageScore) / previousMetrics.quality.averageScore) * 100
 : 0;

 const metrics: TeamMetrics = {
 teamId,
 period,
 ownership: {
 totalEntities: ownedEntities.length,
 activeEntities: ownedEntities.length, // Simplified
 archivedEntities: 0,
 newEntitiesAdded: 0
 },
 quality: {
 averageScore,
 scoreDistribution,
 topPerformers: top5Performers,
 needsAttention
 },
 compliance: {
 policiesApplied: 3, // Simplified
 complianceRate,
 violations,
 criticalViolations
 },
 certifications: {
 total: Object.values(certificationsByLevel).reduce((a, b) => a + b, 0),
 byLevel: certificationsByLevel,
 expiringSoon: Math.floor(certificationsByLevel.bronze * 0.2),
 recentlyAchieved: [] // Simplified
 },
 trends: {
 scoreChange: Math.round(scoreChange),
 complianceChange: 0,
 newIssues: needsAttention.length,
 resolvedIssues: 0
 }
 };

 // Store metrics
 if (!this.teamMetrics.has(teamId)) {
 this.teamMetrics.set(teamId, []);
 }
 this.teamMetrics.get(teamId)!.push(metrics);

 return metrics;
 }

 /**
 * Compare teams
 */
 async compareTeams(teamIds: string[]): Promise<TeamComparison> {
 const metrics: Record<string, TeamMetrics> = {};
 
 // Calculate metrics for each team
 for (const teamId of teamIds) {
 try {
 metrics[teamId] = await this.calculateTeamMetrics(teamId);
 } catch (error) {
 console.error(`Failed to calculate metrics for team ${teamId}:`, error);
 }
 }

 // Extract comparison data
 const averageScores: Record<string, number> = {};
 const complianceRates: Record<string, number> = {};
 const entityCounts: Record<string, number> = {};
 const certificationCounts: Record<string, number> = {};

 for (const [teamId, teamMetrics] of Object.entries(metrics)) {
 averageScores[teamId] = teamMetrics.quality.averageScore;
 complianceRates[teamId] = teamMetrics.compliance.complianceRate;
 entityCounts[teamId] = teamMetrics.ownership.totalEntities;
 certificationCounts[teamId] = teamMetrics.certifications.total;
 }

 // Create rankings
 const qualityRanking = Object.entries(averageScores)
 .map(([teamId, score]) => ({ teamId, score, rank: 0 }))
 .sort((a, b) => b.score - a.score);
 
 const complianceRanking = Object.entries(complianceRates)
 .map(([teamId, rate]) => ({ teamId, rate, rank: 0 }))
 .sort((a, b) => b.rate - a.rate);
 
 const certificationRanking = Object.entries(certificationCounts)
 .map(([teamId, count]) => ({ teamId, count, rank: 0 }))
 .sort((a, b) => b.count - a.count);

 // Assign ranks
 qualityRanking.forEach((item, index) => item.rank = index + 1);
 complianceRanking.forEach((item, index) => item.rank = index + 1);
 certificationRanking.forEach((item, index) => item.rank = index + 1);

 return {
 teams: teamIds,
 metrics: {
 averageScores,
 complianceRates,
 entityCounts,
 certificationCounts
 },
 rankings: {
 quality: qualityRanking,
 compliance: complianceRanking,
 certifications: certificationRanking
 }
 };
 }

 /**
 * Get team metrics history
 */
 getTeamMetricsHistory(
 teamId: string,
 limit?: number
 ): TeamMetrics[] {
 const history = this.teamMetrics.get(teamId) || [];
 if (limit) {
 return history.slice(-limit);
 }
 return history;
 }

 /**
 * Get ownership history
 */
 getOwnershipHistory(
 filters?: {
 entityId?: string;
 teamId?: string;
 changedBy?: string;
 dateRange?: { start: Date; end: Date };
 }
 ): OwnershipChange[] {
 let history = [...this.ownershipHistory];

 if (filters) {
 if (filters.entityId) {
 history = history.filter(h => h.entityId === filters.entityId);
 }
 if (filters.teamId) {
 history = history.filter(h => 
 h.previousOwner === filters.teamId || h.newOwner === filters.teamId
 );
 }
 if (filters.changedBy) {
 history = history.filter(h => h.changedBy === filters.changedBy);
 }
 if (filters.dateRange) {
 history = history.filter(h => {
 const changeDate = new Date(h.changedAt);
 return changeDate >= filters.dateRange!.start && changeDate <= filters.dateRange!.end;
 });
 }
 }

 return history.sort((a, b) => 
 new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
 );
 }

 /**
 * Rotate on-call for a team
 */
 rotateOnCall(teamId: string): void {
 const team = this.teams.get(teamId);
 if (!team || !team.responsibilities.onCallRotation) {
 return;
 }

 const rotation = team.responsibilities.onCallRotation;
 const currentIndex = rotation.members.indexOf(rotation.currentOnCall);
 const nextIndex = (currentIndex + 1) % rotation.members.length;
 
 rotation.currentOnCall = rotation.members[nextIndex];
 
 // Calculate next rotation date
 const daysToAdd = rotation.schedule === 'weekly' ? 7 
 : rotation.schedule === 'biweekly' ? 14 
 : 30;
 
 const nextDate = new Date();
 nextDate.setDate(nextDate.getDate() + daysToAdd);
 rotation.nextRotation = nextDate.toISOString();

 team.metadata.updatedAt = new Date().toISOString();
 }

 /**
 * Get current on-call member for a team
 */
 getCurrentOnCall(teamId: string): TeamMember | undefined {
 const team = this.teams.get(teamId);
 if (!team || !team.responsibilities.onCallRotation) {
 return undefined;
 }

 const memberId = team.responsibilities.onCallRotation.currentOnCall;
 return team.members.find(m => m.id === memberId);
 }

 /**
 * Search teams
 */
 searchTeams(query: string): Team[] {
 const lowerQuery = query.toLowerCase();
 
 return Array.from(this.teams.values()).filter(team => 
 team.name.toLowerCase().includes(lowerQuery) ||
 team.description?.toLowerCase().includes(lowerQuery) ||
 team.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
 team.members.some(member => 
 member.name.toLowerCase().includes(lowerQuery) ||
 member.email.toLowerCase().includes(lowerQuery)
 )
 );
 }

 /**
 * Get team recommendations for an entity
 */
 getTeamRecommendations(
 entity: SoundcheckEntity
 ): Array<{ team: Team; score: number; reasons: string[] }> {
 const recommendations: Array<{ team: Team; score: number; reasons: string[] }> = [];

 for (const team of this.teams.values()) {
 let score = 0;
 const reasons: string[] = [];

 // Check if team already supports similar entities
 const similarEntities = team.responsibilities.ownedEntities.filter(e => 
 // Simple similarity check based on entity metadata
 e.includes(entity.metadata.system || '') ||
 entity.metadata.tags?.some(tag => e.includes(tag))
 );

 if (similarEntities.length > 0) {
 score += 30;
 reasons.push(`Owns ${similarEntities.length} similar entities`);
 }

 // Check team expertise based on tags
 const matchingTags = team.metadata.tags?.filter(tag => 
 entity.metadata.tags?.includes(tag)
 ) || [];

 if (matchingTags.length > 0) {
 score += matchingTags.length * 10;
 reasons.push(`Expertise in: ${matchingTags.join(', ')}`);
 }

 // Check team capacity (simplified)
 const teamLoad = team.responsibilities.ownedEntities.length / team.members.length;
 if (teamLoad < 5) {
 score += 20;
 reasons.push('Team has capacity for new ownership');
 }

 if (score > 0) {
 recommendations.push({ team, score, reasons });
 }
 }

 return recommendations.sort((a, b) => b.score - a.score);
 }
}

// Export singleton instance
export const teamOwnershipService = new TeamOwnershipService();