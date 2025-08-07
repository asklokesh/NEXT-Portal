import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
 try {
 const { databaseUrl } = await request.json();

 if (!databaseUrl) {
 return NextResponse.json(
 { success: false, error: 'Database URL is required' },
 { status: 400 }
 );
 }

 // Set the DATABASE_URL environment variable for Prisma
 process.env.DATABASE_URL = databaseUrl;

 try {
 // Run Prisma migrations
 const { stdout, stderr } = await execAsync(
 'npx prisma migrate deploy',
 {
 cwd: process.cwd(),
 env: {
 ...process.env,
 DATABASE_URL: databaseUrl,
 },
 }
 );

 if (stderr && !stderr.includes('Already in sync')) {
 console.error('Migration stderr:', stderr);
 }

 console.log('Migration stdout:', stdout);

 // Generate Prisma client
 await execAsync('npx prisma generate', {
 cwd: process.cwd(),
 env: {
 ...process.env,
 DATABASE_URL: databaseUrl,
 },
 });

 return NextResponse.json({
 success: true,
 message: 'Database migrations completed successfully',
 output: stdout,
 });
 } catch (migrationError) {
 console.error('Migration error:', migrationError);
 
 // If migrations fail, try to run prisma db push as fallback
 try {
 const { stdout } = await execAsync(
 'npx prisma db push --accept-data-loss',
 {
 cwd: process.cwd(),
 env: {
 ...process.env,
 DATABASE_URL: databaseUrl,
 },
 }
 );

 return NextResponse.json({
 success: true,
 message: 'Database schema synchronized successfully',
 output: stdout,
 });
 } catch (pushError) {
 throw pushError;
 }
 }
 } catch (error) {
 console.error('Run migrations error:', error);
 
 if (error instanceof Error) {
 return NextResponse.json(
 { success: false, error: error.message },
 { status: 400 }
 );
 }

 return NextResponse.json(
 { success: false, error: 'Failed to run database migrations' },
 { status: 500 }
 );
 }
}