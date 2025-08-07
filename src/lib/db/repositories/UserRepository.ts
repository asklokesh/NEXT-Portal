/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/consistent-type-imports, import/order, @typescript-eslint/no-misused-promises, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await, no-console, no-dupe-else-if, no-return-await, import/no-self-import */
import type { User, UserRole, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../client';

export interface CreateUserData {
 email: string;
 name: string;
 username?: string;
 avatar?: string;
 provider: string;
 providerId: string;
 password?: string;
 role?: UserRole;
}

export interface UpdateUserData {
 name?: string;
 username?: string;
 avatar?: string;
 role?: UserRole;
 isActive?: boolean;
 lastLogin?: Date;
}

export class UserRepository {
 async create(data: CreateUserData): Promise<User> {
 return prisma.user.create({
 data: {
 ...data,
 role: data.role || 'DEVELOPER',
 },
 });
 }

 async findById(id: string): Promise<User | null> {
 return prisma.user.findUnique({
 where: { id },
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 ownedServices: true,
 },
 });
 }

 async findByEmail(email: string): Promise<User | null> {
 return prisma.user.findUnique({
 where: { email },
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 },
 });
 }

 async findByProvider(provider: string, providerId: string): Promise<User | null> {
 return prisma.user.findFirst({
 where: {
 provider,
 providerId,
 },
 });
 }

 async findByUsername(username: string): Promise<User | null> {
 return prisma.user.findUnique({
 where: { username },
 });
 }

 async update(id: string, data: UpdateUserData): Promise<User> {
 return prisma.user.update({
 where: { id },
 data,
 });
 }

 async updateLastLogin(id: string): Promise<User> {
 return prisma.user.update({
 where: { id },
 data: {
 lastLogin: new Date(),
 },
 });
 }

 async findMany(options?: {
 skip?: number;
 take?: number;
 where?: Prisma.UserWhereInput;
 orderBy?: Prisma.UserOrderByWithRelationInput;
 }): Promise<User[]> {
 return prisma.user.findMany({
 ...options,
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 ownedServices: {
 select: {
 id: true,
 name: true,
 displayName: true,
 },
 },
 },
 });
 }

 async count(where?: Prisma.UserWhereInput): Promise<number> {
 return prisma.user.count({ where });
 }

 async delete(id: string): Promise<User> {
 return prisma.user.update({
 where: { id },
 data: {
 isActive: false,
 email: `deleted_${Date.now()}_${id}@deleted.local`,
 username: null,
 },
 });
 }

 async hardDelete(id: string): Promise<User> {
 return prisma.user.delete({
 where: { id },
 });
 }

 async search(query: string, options?: {
 skip?: number;
 take?: number;
 }): Promise<User[]> {
 return prisma.user.findMany({
 where: {
 OR: [
 { name: { contains: query, mode: 'insensitive' } },
 { email: { contains: query, mode: 'insensitive' } },
 { username: { contains: query, mode: 'insensitive' } },
 ],
 isActive: true,
 },
 ...options,
 include: {
 teamMemberships: {
 include: {
 team: true,
 },
 },
 },
 });
 }

 async getUserStats(userId: string): Promise<{
 servicesOwned: number;
 templatesCreated: number;
 lastLogin: Date | null;
 teamCount: number;
 }> {
 const [servicesOwned, templatesCreated, teamCount, user] = await Promise.all([
 prisma.service.count({ where: { ownerId: userId, isActive: true } }),
 prisma.template.count({ where: { ownerId: userId, isActive: true } }),
 prisma.teamMember.count({ where: { userId } }),
 prisma.user.findUnique({ where: { id: userId }, select: { lastLogin: true } }),
 ]);

 return {
 servicesOwned,
 templatesCreated,
 teamCount,
 lastLogin: user?.lastLogin || null,
 };
 }
}