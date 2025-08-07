/* eslint-disable @typescript-eslint/no-unused-vars */
import { mockBackend } from '../mock/backend';

// Mock Prisma client for when database is not available
export const mockPrisma = {
 template: {
 findMany: async (args?: any) => {
 const templates = await mockBackend.getTemplates();
 return templates;
 },
 findFirst: async (args?: any) => {
 const templates = await mockBackend.getTemplates();
 if (args?.where?.id) {
 return templates.find(t => t.id === args.where.id);
 }
 if (args?.where?.name) {
 return templates.find(t => t.name === args.where.name);
 }
 return templates[0];
 },
 create: async (args: any) => {
 const newTemplate = {
 id: `template-${Date.now()}`,
 ...args.data,
 createdAt: new Date(),
 updatedAt: new Date(),
 };
 mockBackend.database.templates.push(newTemplate);
 return newTemplate;
 },
 update: async (args: any) => {
 const index = mockBackend.database.templates.findIndex(t => t.id === args.where.id);
 if (index !== -1) {
 mockBackend.database.templates[index] = {
 ...mockBackend.database.templates[index],
 ...args.data,
 updatedAt: new Date(),
 };
 return mockBackend.database.templates[index];
 }
 throw new Error('Template not found');
 },
 },
 service: {
 findMany: async (args?: any) => {
 const services = await mockBackend.getServices();
 return services;
 },
 findFirst: async (args?: any) => {
 const services = await mockBackend.getServices();
 if (args?.where?.id) {
 return services.find(s => s.id === args.where.id);
 }
 if (args?.where?.name) {
 return services.find(s => s.name === args.where.name);
 }
 return services[0];
 },
 },
 user: {
 findFirst: async (args?: any) => {
 return mockBackend.database.users[0];
 },
 findMany: async (args?: any) => {
 return mockBackend.database.users;
 },
 },
 team: {
 findFirst: async (args?: any) => {
 return mockBackend.database.teams[0];
 },
 findMany: async (args?: any) => {
 return mockBackend.database.teams;
 },
 },
 serviceCost: {
 findMany: async (args?: any) => {
 return [];
 },
 aggregate: async (args?: any) => {
 return {
 _sum: {
 cost: 0,
 },
 };
 },
 },
 costAlert: {
 findMany: async (args?: any) => {
 return [];
 },
 findFirst: async (args?: any) => {
 return null;
 },
 create: async (args: any) => {
 return {
 id: `alert-${Date.now()}`,
 ...args.data,
 createdAt: new Date(),
 updatedAt: new Date(),
 };
 },
 },
 budget: {
 findMany: async (args?: any) => {
 return [];
 },
 },
 costThreshold: {
 findMany: async (args?: any) => {
 return [];
 },
 },
 templateExecution: {
 create: async (args: any) => {
 return {
 id: args.data.id || `exec-${Date.now()}`,
 ...args.data,
 createdAt: new Date(),
 updatedAt: new Date(),
 };
 },
 update: async (args: any) => {
 return {
 id: args.where.id,
 ...args.data,
 updatedAt: new Date(),
 };
 },
 },
 $queryRaw: async (query: any) => {
 return [];
 },
 $disconnect: async () => {
 // No-op
 },
};

// Mock Redis client
export const mockRedis = {
 get: async (key: string) => null,
 set: async (key: string, value: string) => 'OK',
 setex: async (key: string, ttl: number, value: string) => 'OK',
 del: async (key: string) => 1,
 ping: async () => 'PONG',
 disconnect: () => {},
};

// Mock session Redis
export const mockSessionRedis = {
 get: async (key: string) => null,
 set: async (key: string, value: string) => 'OK',
 setex: async (key: string, ttl: number, value: string) => 'OK',
 del: async (key: string) => 1,
 disconnect: () => {},
};