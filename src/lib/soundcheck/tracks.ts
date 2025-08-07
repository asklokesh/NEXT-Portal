/**
 * Soundcheck Tracks System
 * Group related quality checks into tracks (scorecards) for focused quality management
 */

import {
 QualityCheck,
 QualityCategory,
 QualityAssessment,
 SoundcheckEntity,
 CheckResult
} from '@/types/soundcheck';
import { soundcheckEngine } from './soundcheck-engine';
import { teamOwnershipService } from './team-ownership';

export interface Track {
 id: string;
 name: string;
 description: string;
 category: 'readiness' | 'compliance' | 'excellence' | 'custom';
 icon: string;
 checks: string[]; // Check IDs included in this track
 gates?: string[]; // Optional gate IDs
 weight: number; // Importance weight for overall scoring
 enabled: boolean;
 metadata: {
 owner?: string;
 createdAt: string;
 updatedAt: string;
 tags?: string[];
 documentation?: string;
 };
}

export interface TrackAssessment {
 trackId: string;
 entityId: string;
 score: number;
 status: 'pass' | 'warning' | 'fail';
 checkResults: CheckResult[];
 improvements: string[];
 timestamp: string;
 trendDirection?: 'improving' | 'declining' | 'stable';
 percentile?: number; // Where this entity ranks among all entities
}

export interface TrackProgress {
 entityId: string;
 trackId: string;
 currentScore: number;
 targetScore: number;
 milestones: Array<{
 score: number;
 achievedAt?: string;
 reward?: string;
 }>;
 nextMilestone?: {
 score: number;
 checksNeeded: string[];
 estimatedEffort: 'low' | 'medium' | 'high';
 };
}

export interface TrackLeaderboard {
 trackId: string;
 period: 'week' | 'month' | 'quarter' | 'all-time';
 entries: Array<{
 rank: number;
 entityId: string;
 entityName: string;
 teamId?: string;
 score: number;
 change: number; // Position change from previous period
 trend: 'up' | 'down' | 'stable';
 }>;
 updatedAt: string;
}

export class SoundcheckTracksService {
 private tracks: Map<string, Track> = new Map();
 private trackAssessments: Map<string, TrackAssessment[]> = new Map();
 private trackProgress: Map<string, TrackProgress> = new Map();

 constructor() {
 this.initializeDefaultTracks();
 }

 /**
 * Initialize default quality tracks
 */
 private initializeDefaultTracks(): void {
 const defaultTracks: Track[] = [
 {
 id: 'production-readiness',
 name: 'Production Readiness',
 description: 'Essential checks for production deployment',
 category: 'readiness',
 icon: 'rocket',
 checks: [
 'security-api-authentication',
 'security-tls-enabled',
 'reliability-health-check',
 'reliability-error-rate',
 'performance-response-time',
 'docs-readme-exists',
 'docs-runbook-exists'
 ],
 gates: ['production-gate'],
 weight: 1.5,
 enabled: true,
 metadata: {
 owner: 'platform-team',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 tags: ['production', 'deployment', 'critical'],
 documentation: 'https://docs.company.com/production-readiness'
 }
 },
 {
 id: 'security-compliance',
 name: 'Security Compliance',
 description: 'Security standards and compliance requirements',
 category: 'compliance',
 icon: 'shield',
 checks: [
 'security-api-authentication',
 'security-secrets-scanner',
 'security-vulnerability-scan',
 'security-tls-enabled',
 'security-dependency-check'
 ],
 weight: 1.3,
 enabled: true,
 metadata: {
 owner: 'security-team',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 tags: ['security', 'compliance', 'risk']
 }
 },
 {
 id: 'engineering-excellence',
 name: 'Engineering Excellence',
 description: 'Best practices for high-quality software',
 category: 'excellence',
 icon: 'star',
 checks: [
 'testing-unit-coverage',
 'testing-integration-tests',
 'testing-mutation-score',
 'docs-api-coverage',
 'performance-load-test',
 'reliability-sla-defined'
 ],
 weight: 1.0,
 enabled: true,
 metadata: {
 owner: 'engineering-leadership',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 tags: ['quality', 'excellence', 'best-practices']
 }
 },
 {
 id: 'operational-maturity',
 name: 'Operational Maturity',
 description: 'Operational readiness and monitoring capabilities',
 category: 'readiness',
 icon: 'activity',
 checks: [
 'reliability-health-check',
 'reliability-uptime-check',
 'reliability-backup-configured',
 'performance-resource-usage',
 'docs-runbook-exists'
 ],
 weight: 1.2,
 enabled: true,
 metadata: {
 owner: 'sre-team',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 tags: ['operations', 'monitoring', 'reliability']
 }
 },
 {
 id: 'api-standards',
 name: 'API Standards',
 description: 'API design and documentation standards',
 category: 'excellence',
 icon: 'code',
 checks: [
 'docs-api-coverage',
 'security-api-authentication',
 'performance-response-time',
 'reliability-error-rate'
 ],
 weight: 1.0,
 enabled: true,
 metadata: {
 owner: 'api-team',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 tags: ['api', 'standards', 'documentation']
 }
 },
 {
 id: 'data-governance',
 name: 'Data Governance',
 description: 'Data handling and privacy compliance',
 category: 'compliance',
 icon: 'database',
 checks: [
 'security-tls-enabled',
 'reliability-backup-configured',
 'docs-data-retention-policy'
 ],
 weight: 1.1,
 enabled: true,
 metadata: {
 owner: 'data-team',
 createdAt: new Date().toISOString(),
 updatedAt: new Date().toISOString(),
 tags: ['data', 'privacy', 'governance']
 }
 }
 ];

 defaultTracks.forEach(track => this.tracks.set(track.id, track));
 }

 /**
 * Create a custom track
 */
 createTrack(track: Track): Track {
 if (this.tracks.has(track.id)) {
 throw new Error(`Track with ID ${track.id} already exists`);
 }

 track.metadata.createdAt = new Date().toISOString();
 track.metadata.updatedAt = track.metadata.createdAt;

 this.tracks.set(track.id, track);
 return track;
 }

 /**
 * Update a track
 */
 updateTrack(trackId: string, updates: Partial<Track>): Track {
 const track = this.tracks.get(trackId);
 if (!track) {
 throw new Error(`Track ${trackId} not found`);
 }

 const updatedTrack = {
 ...track,
 ...updates,
 id: trackId, // Ensure ID cannot be changed
 metadata: {
 ...track.metadata,
 ...updates.metadata,
 updatedAt: new Date().toISOString()
 }
 };

 this.tracks.set(trackId, updatedTrack);
 return updatedTrack;
 }

 /**
 * Delete a track
 */
 deleteTrack(trackId: string): boolean {
 return this.tracks.delete(trackId);
 }

 /**
 * Get all tracks
 */
 getAllTracks(): Track[] {
 return Array.from(this.tracks.values());
 }

 /**
 * Get track by ID
 */
 getTrack(trackId: string): Track | undefined {
 return this.tracks.get(trackId);
 }

 /**
 * Get tracks by category
 */
 getTracksByCategory(category: Track['category']): Track[] {
 return Array.from(this.tracks.values()).filter(t => t.category === category);
 }

 /**
 * Assess entity against a track
 */
 async assessEntityForTrack(
 entity: SoundcheckEntity,
 trackId: string
 ): Promise<TrackAssessment> {
 const track = this.tracks.get(trackId);
 if (!track) {
 throw new Error(`Track ${trackId} not found`);
 }

 // Get latest assessment or run new one
 const fullAssessment = soundcheckEngine.getLatestAssessment(entity.id) ||
 await soundcheckEngine.runAssessment(entity);

 // Filter check results for this track
 const trackCheckResults = fullAssessment.checkResults.filter(r =>
 track.checks.includes(r.checkId)
 );

 // Calculate track-specific score
 const totalScore = trackCheckResults.reduce((sum, r) => sum + r.score, 0);
 const averageScore = trackCheckResults.length > 0 
 ? Math.round(totalScore / trackCheckResults.length)
 : 0;

 // Determine status
 const failedCriticalChecks = trackCheckResults.filter(r => {
 const check = soundcheckEngine.getCheck(r.checkId);
 return r.status === 'fail' && check?.severity === 'critical';
 }).length;

 const status = failedCriticalChecks > 0 ? 'fail' :
 averageScore >= 80 ? 'pass' :
 averageScore >= 60 ? 'warning' : 'fail';

 // Generate improvement suggestions
 const improvements = this.generateImprovements(trackCheckResults, track);

 // Calculate trend
 const previousAssessments = this.getTrackAssessmentHistory(entity.id, trackId);
 const trendDirection = this.calculateTrend(averageScore, previousAssessments);

 // Calculate percentile ranking
 const percentile = await this.calculatePercentile(trackId, averageScore);

 const assessment: TrackAssessment = {
 trackId,
 entityId: entity.id,
 score: averageScore,
 status,
 checkResults: trackCheckResults,
 improvements,
 timestamp: new Date().toISOString(),
 trendDirection,
 percentile
 };

 // Store assessment
 const key = `${trackId}-${entity.id}`;
 if (!this.trackAssessments.has(key)) {
 this.trackAssessments.set(key, []);
 }
 this.trackAssessments.get(key)!.push(assessment);

 // Update progress
 this.updateProgress(entity.id, trackId, assessment);

 return assessment;
 }

 /**
 * Assess entity against all enabled tracks
 */
 async assessEntityForAllTracks(
 entity: SoundcheckEntity
 ): Promise<TrackAssessment[]> {
 const enabledTracks = Array.from(this.tracks.values()).filter(t => t.enabled);
 const assessments: TrackAssessment[] = [];

 for (const track of enabledTracks) {
 try {
 const assessment = await this.assessEntityForTrack(entity, track.id);
 assessments.push(assessment);
 } catch (error) {
 console.error(`Failed to assess entity for track ${track.id}:`, error);
 }
 }

 return assessments;
 }

 /**
 * Generate improvement suggestions
 */
 private generateImprovements(
 checkResults: CheckResult[],
 track: Track
 ): string[] {
 const improvements: string[] = [];
 const failedChecks = checkResults.filter(r => r.status === 'fail');

 // Sort by severity and impact
 failedChecks.sort((a, b) => {
 const checkA = soundcheckEngine.getCheck(a.checkId);
 const checkB = soundcheckEngine.getCheck(b.checkId);
 
 const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
 const severityA = severityOrder[checkA?.severity || 'medium'];
 const severityB = severityOrder[checkB?.severity || 'medium'];
 
 return severityA - severityB;
 });

 // Generate top 3 improvements
 failedChecks.slice(0, 3).forEach(result => {
 const check = soundcheckEngine.getCheck(result.checkId);
 if (check) {
 improvements.push(`Fix ${check.name}: ${result.message}`);
 }
 });

 return improvements;
 }

 /**
 * Calculate trend direction
 */
 private calculateTrend(
 currentScore: number,
 history: TrackAssessment[]
 ): 'improving' | 'declining' | 'stable' {
 if (history.length < 2) return 'stable';

 const recentScores = history.slice(-5).map(a => a.score);
 recentScores.push(currentScore);

 // Simple linear regression to determine trend
 const n = recentScores.length;
 const indices = Array.from({ length: n }, (_, i) => i);
 
 const sumX = indices.reduce((a, b) => a + b, 0);
 const sumY = recentScores.reduce((a, b) => a + b, 0);
 const sumXY = indices.reduce((sum, x, i) => sum + x * recentScores[i], 0);
 const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);

 const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

 if (Math.abs(slope) < 0.5) return 'stable';
 return slope > 0 ? 'improving' : 'declining';
 }

 /**
 * Calculate percentile ranking
 */
 private async calculatePercentile(
 trackId: string,
 score: number
 ): Promise<number> {
 // Get all assessments for this track
 const allScores: number[] = [];
 
 for (const [key, assessments] of this.trackAssessments) {
 if (key.startsWith(`${trackId}-`) && assessments.length > 0) {
 const latestAssessment = assessments[assessments.length - 1];
 allScores.push(latestAssessment.score);
 }
 }

 if (allScores.length === 0) return 100;

 // Calculate percentile
 const scoresBelowOrEqual = allScores.filter(s => s <= score).length;
 const percentile = Math.round((scoresBelowOrEqual / allScores.length) * 100);

 return percentile;
 }

 /**
 * Update progress tracking
 */
 private updateProgress(
 entityId: string,
 trackId: string,
 assessment: TrackAssessment
 ): void {
 const key = `${entityId}-${trackId}`;
 let progress = this.trackProgress.get(key);

 if (!progress) {
 progress = {
 entityId,
 trackId,
 currentScore: assessment.score,
 targetScore: 90,
 milestones: [
 { score: 60 },
 { score: 70 },
 { score: 80 },
 { score: 90 },
 { score: 95 }
 ]
 };
 } else {
 progress.currentScore = assessment.score;
 }

 // Update achieved milestones
 progress.milestones.forEach(milestone => {
 if (!milestone.achievedAt && progress!.currentScore >= milestone.score) {
 milestone.achievedAt = new Date().toISOString();
 }
 });

 // Calculate next milestone
 const nextMilestone = progress.milestones.find(m => !m.achievedAt);
 if (nextMilestone) {
 const failedChecks = assessment.checkResults
 .filter(r => r.status === 'fail')
 .map(r => r.checkId);

 progress.nextMilestone = {
 score: nextMilestone.score,
 checksNeeded: failedChecks.slice(0, 3),
 estimatedEffort: failedChecks.length <= 2 ? 'low' :
 failedChecks.length <= 5 ? 'medium' : 'high'
 };
 }

 this.trackProgress.set(key, progress);
 }

 /**
 * Get track assessment history
 */
 getTrackAssessmentHistory(
 entityId: string,
 trackId: string,
 limit?: number
 ): TrackAssessment[] {
 const key = `${trackId}-${entityId}`;
 const history = this.trackAssessments.get(key) || [];
 
 if (limit) {
 return history.slice(-limit);
 }
 
 return history;
 }

 /**
 * Get entity progress for a track
 */
 getEntityProgress(
 entityId: string,
 trackId: string
 ): TrackProgress | undefined {
 return this.trackProgress.get(`${entityId}-${trackId}`);
 }

 /**
 * Get track leaderboard
 */
 async getTrackLeaderboard(
 trackId: string,
 period: TrackLeaderboard['period'] = 'all-time'
 ): Promise<TrackLeaderboard> {
 const entries: TrackLeaderboard['entries'] = [];
 
 // Collect latest scores for all entities
 const entityScores: Map<string, { score: number; name: string; teamId?: string }> = new Map();
 
 for (const [key, assessments] of this.trackAssessments) {
 if (key.startsWith(`${trackId}-`) && assessments.length > 0) {
 const entityId = key.substring(trackId.length + 1);
 const latestAssessment = assessments[assessments.length - 1];
 
 // Get entity details (simplified for now)
 const team = teamOwnershipService.getTeamByEntity(entityId);
 
 entityScores.set(entityId, {
 score: latestAssessment.score,
 name: entityId, // In real implementation, fetch entity name
 teamId: team?.id
 });
 }
 }

 // Sort by score and create leaderboard entries
 const sortedEntities = Array.from(entityScores.entries())
 .sort(([, a], [, b]) => b.score - a.score);

 sortedEntities.forEach(([entityId, data], index) => {
 entries.push({
 rank: index + 1,
 entityId,
 entityName: data.name,
 teamId: data.teamId,
 score: data.score,
 change: 0, // Simplified for now
 trend: 'stable'
 });
 });

 return {
 trackId,
 period,
 entries: entries.slice(0, 20), // Top 20
 updatedAt: new Date().toISOString()
 };
 }

 /**
 * Get recommended tracks for an entity
 */
 getRecommendedTracks(
 entity: SoundcheckEntity
 ): Array<{ track: Track; relevance: number; reason: string }> {
 const recommendations: Array<{ track: Track; relevance: number; reason: string }> = [];

 for (const track of this.tracks.values()) {
 let relevance = 0;
 const reasons: string[] = [];

 // Check entity type relevance
 if (entity.kind === 'API' && track.id === 'api-standards') {
 relevance += 50;
 reasons.push('Specific to API entities');
 }

 // Check lifecycle relevance
 if (entity.metadata.lifecycle === 'production' && 
 track.id === 'production-readiness') {
 relevance += 40;
 reasons.push('Essential for production services');
 }

 // Check tag relevance
 if (entity.metadata.tags?.includes('security') && 
 track.id === 'security-compliance') {
 relevance += 30;
 reasons.push('Security-tagged service');
 }

 // General tracks
 if (['engineering-excellence', 'operational-maturity'].includes(track.id)) {
 relevance += 20;
 reasons.push('Recommended for all services');
 }

 if (relevance > 0) {
 recommendations.push({
 track,
 relevance,
 reason: reasons.join('; ')
 });
 }
 }

 return recommendations.sort((a, b) => b.relevance - a.relevance);
 }

 /**
 * Get entity summary across all tracks
 */
 async getEntityTrackSummary(
 entityId: string
 ): Promise<{
 overallScore: number;
 trackScores: Array<{ trackId: string; trackName: string; score: number; status: string }>;
 strongestTrack?: { trackId: string; score: number };
 weakestTrack?: { trackId: string; score: number };
 recommendedFocus?: string;
 }> {
 const trackScores: Array<{ trackId: string; trackName: string; score: number; status: string }> = [];
 let totalScore = 0;
 let totalWeight = 0;

 for (const track of this.tracks.values()) {
 if (!track.enabled) continue;

 const key = `${track.id}-${entityId}`;
 const assessments = this.trackAssessments.get(key);
 
 if (assessments && assessments.length > 0) {
 const latest = assessments[assessments.length - 1];
 trackScores.push({
 trackId: track.id,
 trackName: track.name,
 score: latest.score,
 status: latest.status
 });

 totalScore += latest.score * track.weight;
 totalWeight += track.weight;
 }
 }

 const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;

 // Find strongest and weakest tracks
 trackScores.sort((a, b) => b.score - a.score);
 const strongestTrack = trackScores[0] ? { trackId: trackScores[0].trackId, score: trackScores[0].score } : undefined;
 const weakestTrack = trackScores[trackScores.length - 1] ? { trackId: trackScores[trackScores.length - 1].trackId, score: trackScores[trackScores.length - 1].score } : undefined;

 // Recommend focus area
 let recommendedFocus: string | undefined;
 if (weakestTrack && weakestTrack.score < 60) {
 const track = this.tracks.get(weakestTrack.trackId);
 recommendedFocus = `Focus on improving ${track?.name} (currently at ${weakestTrack.score}%)`;
 }

 return {
 overallScore,
 trackScores,
 strongestTrack,
 weakestTrack,
 recommendedFocus
 };
 }
}

// Export singleton instance
export const soundcheckTracksService = new SoundcheckTracksService();