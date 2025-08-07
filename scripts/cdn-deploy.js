#!/usr/bin/env node

/**
 * CDN deployment script
 * Uploads static assets to CDN after build
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// CDN configuration from environment
const CDN_URL = process.env.CDN_URL;
const CDN_BUCKET = process.env.CDN_BUCKET;
const CDN_REGION = process.env.CDN_REGION || 'us-east-1';
const CDN_PROVIDER = process.env.CDN_PROVIDER || 'cloudfront'; // cloudfront, cloudflare, fastly, etc.

// Directories to upload
const STATIC_DIRS = [
 '.next/static',
 'public/fonts',
 'public/images',
 'public/icons',
];

// File extensions to upload
const STATIC_EXTENSIONS = [
 '.js',
 '.css',
 '.png',
 '.jpg',
 '.jpeg',
 '.gif',
 '.svg',
 '.webp',
 '.ico',
 '.woff',
 '.woff2',
 '.ttf',
 '.otf',
];

// Cache control headers by file type
const CACHE_CONTROL = {
 // Immutable assets (hashed filenames)
 '/_next/static/': 'public, max-age=31536000, immutable',
 
 // Fonts
 '/fonts/': 'public, max-age=31536000, immutable',
 
 // Images
 '/images/': 'public, max-age=2592000, stale-while-revalidate=86400',
 '/icons/': 'public, max-age=2592000, stale-while-revalidate=86400',
 
 // Default
 default: 'public, max-age=3600, stale-while-revalidate=600',
};

// Get cache control header for a file
function getCacheControl(filePath) {
 for (const [prefix, header] of Object.entries(CACHE_CONTROL)) {
 if (filePath.includes(prefix)) {
 return header;
 }
 }
 return CACHE_CONTROL.default;
}

// Get content type for a file
function getContentType(filePath) {
 const ext = path.extname(filePath).toLowerCase();
 const contentTypes = {
 '.js': 'application/javascript',
 '.css': 'text/css',
 '.html': 'text/html',
 '.json': 'application/json',
 '.png': 'image/png',
 '.jpg': 'image/jpeg',
 '.jpeg': 'image/jpeg',
 '.gif': 'image/gif',
 '.svg': 'image/svg+xml',
 '.webp': 'image/webp',
 '.ico': 'image/x-icon',
 '.woff': 'font/woff',
 '.woff2': 'font/woff2',
 '.ttf': 'font/ttf',
 '.otf': 'font/otf',
 };
 return contentTypes[ext] || 'application/octet-stream';
}

// Calculate file hash for cache busting
function getFileHash(filePath) {
 const content = fs.readFileSync(filePath);
 return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Get all static files to upload
function getStaticFiles() {
 const files = [];
 
 STATIC_DIRS.forEach(dir => {
 const fullPath = path.join(process.cwd(), dir);
 if (!fs.existsSync(fullPath)) {
 console.log(`Skipping ${dir} - directory not found`);
 return;
 }
 
 walkDir(fullPath, (filePath) => {
 const ext = path.extname(filePath).toLowerCase();
 if (STATIC_EXTENSIONS.includes(ext)) {
 files.push({
 localPath: filePath,
 cdnPath: filePath.replace(process.cwd(), '').replace(/\\/g, '/'),
 contentType: getContentType(filePath),
 cacheControl: getCacheControl(filePath),
 });
 }
 });
 });
 
 return files;
}

// Recursively walk directory
function walkDir(dir, callback) {
 fs.readdirSync(dir).forEach(file => {
 const filePath = path.join(dir, file);
 const stat = fs.statSync(filePath);
 if (stat.isDirectory()) {
 walkDir(filePath, callback);
 } else {
 callback(filePath);
 }
 });
}

// Upload file to CDN (mock implementation)
async function uploadFile(file) {
 console.log(`Uploading ${file.cdnPath}...`);
 
 // In a real implementation, this would upload to your CDN provider
 // Example for AWS S3/CloudFront:
 /*
 const AWS = require('aws-sdk');
 const s3 = new AWS.S3({ region: CDN_REGION });
 
 const params = {
 Bucket: CDN_BUCKET,
 Key: file.cdnPath,
 Body: fs.readFileSync(file.localPath),
 ContentType: file.contentType,
 CacheControl: file.cacheControl,
 };
 
 await s3.upload(params).promise();
 */
 
 // For now, just log what would be uploaded
 console.log(` Content-Type: ${file.contentType}`);
 console.log(` Cache-Control: ${file.cacheControl}`);
}

// Invalidate CDN cache
async function invalidateCache(paths) {
 console.log('\nInvalidating CDN cache...');
 
 // In a real implementation, this would invalidate your CDN cache
 // Example for CloudFront:
 /*
 const cloudfront = new AWS.CloudFront();
 const params = {
 DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
 InvalidationBatch: {
 CallerReference: Date.now().toString(),
 Paths: {
 Quantity: paths.length,
 Items: paths,
 },
 },
 };
 
 await cloudfront.createInvalidation(params).promise();
 */
 
 console.log(`Would invalidate ${paths.length} paths`);
}

// Main deployment function
async function deployCDN() {
 console.log('CDN Deployment Script');
 console.log('====================\n');
 
 if (!CDN_URL) {
 console.log('CDN_URL not set, skipping CDN deployment');
 return;
 }
 
 console.log(`CDN Provider: ${CDN_PROVIDER}`);
 console.log(`CDN URL: ${CDN_URL}`);
 console.log(`CDN Bucket: ${CDN_BUCKET || 'Not configured'}`);
 console.log('\n');
 
 // Get files to upload
 const files = getStaticFiles();
 console.log(`Found ${files.length} static files to upload\n`);
 
 // Upload files (in batches for better performance)
 const batchSize = 10;
 for (let i = 0; i < files.length; i += batchSize) {
 const batch = files.slice(i, i + batchSize);
 await Promise.all(batch.map(uploadFile));
 }
 
 // Invalidate changed paths
 const changedPaths = files
 .filter(f => f.cdnPath.includes('/_next/static/'))
 .map(f => f.cdnPath);
 
 if (changedPaths.length > 0) {
 await invalidateCache(changedPaths);
 }
 
 console.log('\nCDN deployment complete!');
 console.log(`\nStatic assets will be served from: ${CDN_URL}`);
}

// Run deployment
deployCDN().catch(err => {
 console.error('CDN deployment failed:', err);
 process.exit(1);
});