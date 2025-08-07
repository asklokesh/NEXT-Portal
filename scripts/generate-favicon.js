#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'favicon.svg');
const icoPath = path.join(publicDir, 'favicon.ico');

async function generateFavicon() {
  try {
    // Check if SVG exists
    if (!fs.existsSync(svgPath)) {
      console.error('favicon.svg not found in public directory');
      process.exit(1);
    }

    // Read SVG file
    const svgBuffer = fs.readFileSync(svgPath);

    // Generate different sizes for ICO format
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    for (const size of sizes) {
      const pngBuffer = await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(pngBuffer);
    }

    // Generate main favicon.ico (using 32x32 as standard)
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(icoPath.replace('.ico', '.png'));

    // Copy PNG as ICO (browsers accept PNG renamed as ICO)
    fs.copyFileSync(icoPath.replace('.ico', '.png'), icoPath);
    fs.unlinkSync(icoPath.replace('.ico', '.png'));

    // Generate apple-touch-icon (180x180)
    await sharp(svgBuffer)
      .resize(180, 180)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));

    // Generate favicon-16x16.png
    await sharp(svgBuffer)
      .resize(16, 16)
      .png()
      .toFile(path.join(publicDir, 'favicon-16x16.png'));

    // Generate favicon-32x32.png
    await sharp(svgBuffer)
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon-32x32.png'));

    // Generate android-chrome-192x192.png
    await sharp(svgBuffer)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'android-chrome-192x192.png'));

    // Generate android-chrome-512x512.png
    await sharp(svgBuffer)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'android-chrome-512x512.png'));

    console.log('Successfully generated favicon files:');
    console.log('- favicon.ico');
    console.log('- apple-touch-icon.png');
    console.log('- favicon-16x16.png');
    console.log('- favicon-32x32.png');
    console.log('- android-chrome-192x192.png');
    console.log('- android-chrome-512x512.png');

  } catch (error) {
    console.error('Error generating favicon:', error);
    process.exit(1);
  }
}

generateFavicon();