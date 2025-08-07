import { NextResponse } from 'next/server';

const BACKSTAGE_API_URL = process.env.BACKSTAGE_BACKEND_URL || 'http://localhost:4402';

export async function GET() {
 try {
 // Try to get version from Backstage API
 const response = await fetch(`${BACKSTAGE_API_URL}/api/version`, {
 headers: {
 'Accept': 'application/json',
 },
 });

 if (response.ok) {
 const data = await response.json();
 return NextResponse.json(data);
 }

 // If version endpoint doesn't exist, try to detect from other endpoints
 // This is a fallback for older Backstage versions
 const catalogResponse = await fetch(`${BACKSTAGE_API_URL}/api/catalog`, {
 headers: {
 'Accept': 'application/json',
 },
 });

 if (catalogResponse.ok) {
 // Default to a supported version if we can connect but can't detect version
 return NextResponse.json({
 version: '1.20.0',
 detected: false,
 message: 'Version detected from API availability'
 });
 }

 return NextResponse.json({
 version: '1.20.0',
 detected: false,
 message: 'Using default version'
 });
 } catch (error) {
 console.error('Failed to detect Backstage version:', error);
 return NextResponse.json({
 version: '1.20.0',
 detected: false,
 message: 'Failed to detect version, using default'
 });
 }
}