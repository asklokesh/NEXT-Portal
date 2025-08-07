#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Fallback: Create simple placeholder if canvas module not available
function createPlaceholderIcons() {
 const iconsDir = path.join(__dirname, '../public/icons');
 
 if (!fs.existsSync(iconsDir)) {
 fs.mkdirSync(iconsDir, { recursive: true });
 }

 // Create a simple 1x1 blue PNG as placeholder
 const pngData = Buffer.from([
 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT chunk
 0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0xf8, 0x0f,
 0x00, 0x00, 0x01, 0x01, 0x01, 0x00, 0x1b, 0xb6,
 0xee, 0x56, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
 ]);

 for (const size of sizes) {
 fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), pngData);
 console.log(`Created placeholder icon-${size}x${size}.png`);
 }
 
 fs.writeFileSync(path.join(iconsDir, 'badge-72x72.png'), pngData);
 console.log('Created placeholder badge-72x72.png');
}

// Main execution
try {
 // Try to use canvas if available
 const { createCanvas, loadImage } = require('canvas');
 
 // Redefine generateIcons with canvas available
 async function generateIconsWithCanvas() {
 const iconsDir = path.join(__dirname, '../public/icons');
 
 // Ensure directory exists
 if (!fs.existsSync(iconsDir)) {
 fs.mkdirSync(iconsDir, { recursive: true });
 }

 for (const size of sizes) {
 const canvas = createCanvas(size, size);
 const ctx = canvas.getContext('2d');
 
 // Background
 ctx.fillStyle = '#2196F3';
 ctx.fillRect(0, 0, size, size);
 
 // Add rounded corners
 const radius = size * 0.125;
 ctx.globalCompositeOperation = 'destination-in';
 ctx.beginPath();
 ctx.roundRect(0, 0, size, size, radius);
 ctx.fill();
 ctx.globalCompositeOperation = 'source-over';
 
 // Center circle
 ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
 ctx.beginPath();
 ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
 ctx.fill();
 
 // Inner circle
 ctx.fillStyle = '#2196F3';
 ctx.beginPath();
 ctx.arc(size / 2, size / 2, size * 0.15, 0, Math.PI * 2);
 ctx.fill();
 
 // Text for larger sizes
 if (size >= 128) {
 ctx.fillStyle = 'white';
 ctx.font = `bold ${size * 0.2}px Inter, -apple-system, sans-serif`;
 ctx.textAlign = 'center';
 ctx.textBaseline = 'bottom';
 ctx.fillText('IDP', size / 2, size * 0.85);
 }
 
 // Save PNG
 const buffer = canvas.toBuffer('image/png');
 fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), buffer);
 console.log(`Generated icon-${size}x${size}.png`);
 }
 
 // Also create a badge icon
 const badgeCanvas = createCanvas(72, 72);
 const badgeCtx = badgeCanvas.getContext('2d');
 
 badgeCtx.fillStyle = '#2196F3';
 badgeCtx.beginPath();
 badgeCtx.arc(36, 36, 36, 0, Math.PI * 2);
 badgeCtx.fill();
 
 badgeCtx.fillStyle = 'white';
 badgeCtx.font = 'bold 32px Inter, -apple-system, sans-serif';
 badgeCtx.textAlign = 'center';
 badgeCtx.textBaseline = 'middle';
 badgeCtx.fillText('B', 36, 36);
 
 const badgeBuffer = badgeCanvas.toBuffer('image/png');
 fs.writeFileSync(path.join(iconsDir, 'badge-72x72.png'), badgeBuffer);
 console.log('Generated badge-72x72.png');
 }
 
 generateIconsWithCanvas().catch(err => {
 console.log('Canvas module error, creating placeholders');
 createPlaceholderIcons();
 });
} catch (e) {
 console.log('Canvas module not installed, creating placeholder icons');
 createPlaceholderIcons();
}