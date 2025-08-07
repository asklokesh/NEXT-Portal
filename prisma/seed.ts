/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-misused-promises */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
 console.log(' Seeding database...');

 // Create admin user
 const adminUser = await prisma.user.upsert({
 where: { email: 'admin@company.com' },
 update: {},
 create: {
 email: 'admin@company.com',
 name: 'Admin User',
 username: 'admin',
 provider: 'local',
 providerId: 'admin-001',
 role: 'ADMIN',
 },
 });

 console.log(' Created admin user:', adminUser.email);

 // Create platform team
 const platformTeam = await prisma.team.upsert({
 where: { name: 'platform-team' },
 update: {},
 create: {
 name: 'platform-team',
 displayName: 'Platform Team',
 description: 'Team responsible for platform infrastructure and developer tools',
 },
 });

 // Create backend team
 const backendTeam = await prisma.team.upsert({
 where: { name: 'backend-team' },
 update: {},
 create: {
 name: 'backend-team',
 displayName: 'Backend Team',
 description: 'Team responsible for backend services and APIs',
 },
 });

 // Create frontend team
 const frontendTeam = await prisma.team.upsert({
 where: { name: 'frontend-team' },
 update: {},
 create: {
 name: 'frontend-team',
 displayName: 'Frontend Team',
 description: 'Team responsible for frontend applications and user interfaces',
 },
 });

 console.log(' Created teams');

 // Add admin to platform team
 await prisma.teamMember.upsert({
 where: {
 userId_teamId: {
 userId: adminUser.id,
 teamId: platformTeam.id,
 },
 },
 update: {},
 create: {
 userId: adminUser.id,
 teamId: platformTeam.id,
 role: 'OWNER',
 },
 });

 // Create some sample services
 const services = [
 {
 name: 'user-service',
 displayName: 'User Service',
 description: 'Manages user authentication and profiles',
 type: 'SERVICE' as const,
 lifecycle: 'PRODUCTION' as const,
 teamId: backendTeam.id,
 gitRepo: 'https://github.com/company/user-service',
 tags: ['auth', 'users', 'api'],
 },
 {
 name: 'notification-service',
 displayName: 'Notification Service',
 description: 'Handles email, SMS, and push notifications',
 type: 'SERVICE' as const,
 lifecycle: 'PRODUCTION' as const,
 teamId: backendTeam.id,
 gitRepo: 'https://github.com/company/notification-service',
 tags: ['notifications', 'messaging', 'api'],
 },
 {
 name: 'web-app',
 displayName: 'Main Web Application',
 description: 'Customer-facing web application',
 type: 'WEBSITE' as const,
 lifecycle: 'PRODUCTION' as const,
 teamId: frontendTeam.id,
 gitRepo: 'https://github.com/company/web-app',
 tags: ['frontend', 'react', 'customer'],
 },
 {
 name: 'admin-dashboard',
 displayName: 'Admin Dashboard',
 description: 'Internal admin dashboard for managing the platform',
 type: 'WEBSITE' as const,
 lifecycle: 'PRODUCTION' as const,
 teamId: platformTeam.id,
 gitRepo: 'https://github.com/company/admin-dashboard',
 tags: ['admin', 'internal', 'dashboard'],
 },
 ];

 for (const serviceData of services) {
 await prisma.service.upsert({
 where: { name: serviceData.name },
 update: {},
 create: {
 ...serviceData,
 ownerId: adminUser.id,
 },
 });
 console.log(` Created service: ${serviceData.displayName}`);
 }

 // Create some sample templates
 const templates = [
 {
 name: 'node-service',
 displayName: 'Node.js Service',
 description: 'Template for creating Node.js microservices',
 type: 'SERVICE' as const,
 ownerId: adminUser.id,
 teamId: platformTeam.id,
 content: {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'node-service',
 title: 'Node.js Service',
 description: 'Create a new Node.js microservice',
 },
 spec: {
 type: 'service',
 parameters: [
 {
 title: 'Basic Information',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name for the service',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'What does this service do?',
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Base',
 action: 'fetch:template',
 input: {
 url: './skeleton',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 },
 },
 },
 ],
 },
 },
 tags: ['nodejs', 'service', 'microservice'],
 isPublic: true,
 },
 {
 name: 'react-app',
 displayName: 'React Application',
 description: 'Template for creating React applications',
 type: 'WEBSITE' as const,
 ownerId: adminUser.id,
 teamId: frontendTeam.id,
 content: {
 apiVersion: 'scaffolder.backstage.io/v1beta3',
 kind: 'Template',
 metadata: {
 name: 'react-app',
 title: 'React Application',
 description: 'Create a new React application',
 },
 spec: {
 type: 'website',
 parameters: [
 {
 title: 'Application Details',
 required: ['name', 'description'],
 properties: {
 name: {
 title: 'Name',
 type: 'string',
 description: 'Unique name for the application',
 },
 description: {
 title: 'Description',
 type: 'string',
 description: 'What is this application for?',
 },
 },
 },
 ],
 steps: [
 {
 id: 'fetch',
 name: 'Fetch Template',
 action: 'fetch:template',
 input: {
 url: './content',
 values: {
 name: '${{ parameters.name }}',
 description: '${{ parameters.description }}',
 },
 },
 },
 ],
 },
 },
 tags: ['react', 'frontend', 'spa'],
 isPublic: true,
 },
 ];

 for (const templateData of templates) {
 await prisma.template.upsert({
 where: { name: templateData.name },
 update: {},
 create: templateData,
 });
 console.log(` Created template: ${templateData.displayName}`);
 }

 // Create some sample health checks
 const userService = await prisma.service.findUnique({ where: { name: 'user-service' } });
 if (userService) {
 await prisma.serviceHealthCheck.upsert({
 where: { 
 serviceId_name: {
 serviceId: userService.id,
 name: 'API Health Check'
 }
 },
 update: {},
 create: {
 serviceId: userService.id,
 name: 'API Health Check',
 type: 'HTTP',
 endpoint: 'https://user-service.company.com/health',
 method: 'GET',
 interval: 60,
 timeout: 30,
 retries: 3,
 isEnabled: true,
 },
 });

 // Create some health check results
 const healthCheck = await prisma.serviceHealthCheck.findFirst({
 where: { serviceId: userService.id },
 });

 if (healthCheck) {
 const now = new Date();
 for (let i = 0; i < 10; i++) {
 await prisma.healthCheckResult.create({
 data: {
 healthCheckId: healthCheck.id,
 status: i < 8 ? 'HEALTHY' : i < 9 ? 'DEGRADED' : 'UNHEALTHY',
 responseTime: Math.floor(Math.random() * 500) + 50,
 message: i < 8 ? 'OK' : i < 9 ? 'Slow response' : 'Service unavailable',
 checkedAt: new Date(now.getTime() - i * 60000), // Every minute
 },
 });
 }
 }
 }

 // Create some sample budgets
 await prisma.budget.upsert({
 where: { name: 'Platform Team Monthly Budget' },
 update: {},
 create: {
 name: 'Platform Team Monthly Budget',
 amount: 5000.00,
 currency: 'USD',
 period: 'MONTHLY',
 scope: { teamId: platformTeam.id },
 threshold: 0.8,
 isActive: true,
 },
 });

 console.log(' Created sample budget');

 // Create some sample permissions
 await prisma.permission.upsert({
 where: {
 teamId_resource_action: {
 teamId: platformTeam.id,
 resource: 'service',
 action: 'create',
 },
 },
 update: {},
 create: {
 teamId: platformTeam.id,
 resource: 'service',
 action: 'create',
 scope: { global: true },
 },
 });

 await prisma.permission.upsert({
 where: {
 teamId_resource_action: {
 teamId: backendTeam.id,
 resource: 'service',
 action: 'read',
 },
 },
 update: {},
 create: {
 teamId: backendTeam.id,
 resource: 'service',
 action: 'read',
 scope: { teamOnly: true },
 },
 });

 console.log(' Created sample permissions');

 console.log(' Database seeded successfully!');
}

main()
 .catch((e) => {
 console.error(e);
 process.exit(1);
 })
 .finally(async () => {
 await prisma.$disconnect();
 });