import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function POST(request: NextRequest) {
 try {
 const { databaseUrl } = await request.json();

 if (!databaseUrl) {
 return NextResponse.json(
 { success: false, error: 'Database URL is required' },
 { status: 400 }
 );
 }

 // Create a new Prisma client with the provided URL
 const prisma = new PrismaClient({
 datasources: {
 db: {
 url: databaseUrl,
 },
 },
 });

 try {
 // Test the connection
 await prisma.$connect();
 
 // Try a simple query to verify the connection works
 await prisma.$queryRaw`SELECT 1`;

 // Disconnect
 await prisma.$disconnect();

 return NextResponse.json({
 success: true,
 message: 'Successfully connected to the database',
 });
 } catch (dbError) {
 await prisma.$disconnect();
 throw dbError;
 }
 } catch (error) {
 console.error('Database connection test error:', error);
 
 if (error instanceof Error) {
 // Parse common database errors
 if (error.message.includes('P1001')) {
 return NextResponse.json(
 { success: false, error: 'Cannot reach database server. Please check host and port.' },
 { status: 400 }
 );
 }
 if (error.message.includes('P1002')) {
 return NextResponse.json(
 { success: false, error: 'Database server was reached but timed out.' },
 { status: 400 }
 );
 }
 if (error.message.includes('P1003')) {
 return NextResponse.json(
 { success: false, error: 'Database does not exist. Please create it first.' },
 { status: 400 }
 );
 }
 if (error.message.includes('P1010')) {
 return NextResponse.json(
 { success: false, error: 'Access denied. Please check username and password.' },
 { status: 400 }
 );
 }
 
 return NextResponse.json(
 { success: false, error: error.message },
 { status: 400 }
 );
 }

 return NextResponse.json(
 { success: false, error: 'Failed to connect to database' },
 { status: 500 }
 );
 }
}